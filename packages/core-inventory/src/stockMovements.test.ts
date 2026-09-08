import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { createUnitOfMeasure } from './units';
import { createWarehouse } from './warehouses';
import { createItem } from './items';
import { postPurchaseReceipt, postSalesIssue } from './stockMovements';
import { computeStockPosition } from './stockPosition';

/**
 * core-inventory's FIFO/weighted-average consumption is the most stateful,
 * order-dependent math in the codebase — explicitly flagged in the Phase
 * Tracker's Open Questions (since Phase 3) as needing exactly this kind of
 * persisted test harness, not just a throwaway manual verification pass.
 */
describe('core-inventory: FIFO layer consumption', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let warehouseId: string;
  let fifoItemId: string;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
    const unitId = await createUnitOfMeasure(companyDb, { name: 'Piece', symbol: 'pc' });
    warehouseId = await createWarehouse(companyDb, { name: 'Main Warehouse' });
    fifoItemId = await createItem(companyDb, { itemCode: 'ITM-1', name: 'Widget', itemType: 'STOCKABLE', unitId, valuationMethod: 'FIFO' });
  });

  afterEach(async () => {
    await handle.close();
  });

  it('a single-layer sale costs at exactly that layer\'s receipt rate', async () => {
    await postPurchaseReceipt(companyDb, { itemId: fifoItemId, warehouseId, quantityThousandths: 100_000, ratePaise: 50_00, movementDate: '2025-12-01' }, null);
    const { costPaise } = await postSalesIssue(companyDb, { itemId: fifoItemId, warehouseId, quantityThousandths: 40_000, movementDate: '2025-12-05' }, null);
    expect(costPaise).toBe(Math.round((40_000 * 50_00) / 1000));
  });

  it('a multi-layer sale consumes the OLDEST layer first (FIFO) at each layer\'s own rate', async () => {
    // Layer 1: 50 units @ Rs 10, Layer 2: 50 units @ Rs 20.
    await postPurchaseReceipt(companyDb, { itemId: fifoItemId, warehouseId, quantityThousandths: 50_000, ratePaise: 10_00, movementDate: '2025-12-01' }, null);
    await postPurchaseReceipt(companyDb, { itemId: fifoItemId, warehouseId, quantityThousandths: 50_000, ratePaise: 20_00, movementDate: '2025-12-02' }, null);

    // Sell 70 units: should consume all 50 from layer 1 (@10) + 20 from layer 2 (@20).
    const { costPaise } = await postSalesIssue(companyDb, { itemId: fifoItemId, warehouseId, quantityThousandths: 70_000, movementDate: '2025-12-05' }, null);
    const expectedCost = 50_000 * 10_00 / 1000 + 20_000 * 20_00 / 1000;
    expect(costPaise).toBe(expectedCost);
  });

  it('throws (and posts nothing) when selling more than is in stock — no negative stock, no partial movement', async () => {
    await postPurchaseReceipt(companyDb, { itemId: fifoItemId, warehouseId, quantityThousandths: 10_000, ratePaise: 10_00, movementDate: '2025-12-01' }, null);
    await expect(postSalesIssue(companyDb, { itemId: fifoItemId, warehouseId, quantityThousandths: 20_000, movementDate: '2025-12-05' }, null)).rejects.toThrow();

    const position = await computeStockPosition(companyDb, { itemId: fifoItemId, warehouseId });
    expect(position[0]?.quantityThousandths ?? 0).toBe(10_000); // unchanged — the failed sale left no partial trace
  });

  it('computeStockPosition reflects the net on-hand quantity and value after a purchase + partial sale', async () => {
    await postPurchaseReceipt(companyDb, { itemId: fifoItemId, warehouseId, quantityThousandths: 100_000, ratePaise: 15_00, movementDate: '2025-12-01' }, null);
    await postSalesIssue(companyDb, { itemId: fifoItemId, warehouseId, quantityThousandths: 30_000, movementDate: '2025-12-05' }, null);

    const [position] = await computeStockPosition(companyDb, { itemId: fifoItemId, warehouseId });
    expect(position.quantityThousandths).toBe(70_000);
    expect(position.valuePaise).toBe(70_000 * 15_00 / 1000);
  });

  it('rejects posting a movement for a non-stockable (SERVICE) item', async () => {
    const unitId = (await companyDb.selectFrom('unit_of_measure').select('id').executeTakeFirst())!.id;
    const serviceItemId = await createItem(companyDb, { itemCode: 'SVC-1', name: 'Consulting', itemType: 'SERVICE' });
    await expect(postPurchaseReceipt(companyDb, { itemId: serviceItemId, warehouseId, quantityThousandths: 1_000, ratePaise: 100_00, movementDate: '2025-12-01' }, null)).rejects.toThrow(/not stockable/);
    void unitId;
  });
});

describe('core-inventory: weighted-average valuation', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let warehouseId: string;
  let waItemId: string;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
    const unitId = await createUnitOfMeasure(companyDb, { name: 'Kilogram', symbol: 'kg' });
    warehouseId = await createWarehouse(companyDb, { name: 'Main Warehouse' });
    waItemId = await createItem(companyDb, { itemCode: 'ITM-WA', name: 'Bulk Grain', itemType: 'STOCKABLE', unitId, valuationMethod: 'WEIGHTED_AVERAGE' });
  });

  afterEach(async () => {
    await handle.close();
  });

  it('issue cost is the blended weighted-average rate across all receipts to date, not a specific layer\'s rate', async () => {
    // 50kg @ Rs 10 + 50kg @ Rs 20 => weighted average Rs 15/kg over 100kg.
    await postPurchaseReceipt(companyDb, { itemId: waItemId, warehouseId, quantityThousandths: 50_000, ratePaise: 10_00, movementDate: '2025-12-01' }, null);
    await postPurchaseReceipt(companyDb, { itemId: waItemId, warehouseId, quantityThousandths: 50_000, ratePaise: 20_00, movementDate: '2025-12-02' }, null);

    const { costPaise } = await postSalesIssue(companyDb, { itemId: waItemId, warehouseId, quantityThousandths: 10_000, movementDate: '2025-12-05' }, null);
    const expectedAverageCost = Math.round((10_000 * 15_00) / 1000);
    expect(costPaise).toBe(expectedAverageCost);
  });
});
