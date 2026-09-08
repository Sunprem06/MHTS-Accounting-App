import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { seedChartOfAccounts } from '@mhts/core-accounting';
import { createUnitOfMeasure, createWarehouse, createItem, postPurchaseReceipt, seedInventoryLedgers } from '@mhts/core-inventory';
import { createBillOfMaterial } from './billOfMaterials';
import { postManufacturingJournal } from './manufacturingJournal';
import { computeTrialBalance } from '@mhts/core-accounting';
import { computeStockPosition } from '@mhts/core-inventory';

describe('core-manufacturing: BOM + consume/produce journal (smoke)', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let warehouseId: string;
  let outputItemId: string;
  let componentItemId: string;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
    await seedChartOfAccounts(companyDb);
    await seedInventoryLedgers(companyDb);

    const unitId = await createUnitOfMeasure(companyDb, { name: 'Piece', symbol: 'pc' });
    warehouseId = await createWarehouse(companyDb, { name: 'Factory' });
    componentItemId = await createItem(companyDb, { itemCode: 'COMP-1', name: 'Raw Material', itemType: 'STOCKABLE', unitId, valuationMethod: 'FIFO' });
    outputItemId = await createItem(companyDb, { itemCode: 'OUT-1', name: 'Finished Widget', itemType: 'STOCKABLE', unitId, valuationMethod: 'FIFO' });

    // Stock the raw material so there's something to consume.
    await postPurchaseReceipt(companyDb, { itemId: componentItemId, warehouseId, quantityThousandths: 1_000_000, ratePaise: 10_00, movementDate: '2025-12-01' }, null);
  });

  afterEach(async () => {
    await handle.close();
  });

  it('a consume/produce journal scales BOM lines to the quantity produced, values the output at the sum of components consumed, and nets to zero on the Trial Balance', async () => {
    // 1 output unit needs 2 units of the component.
    const bomId = await createBillOfMaterial(companyDb, { outputItemId, outputQuantityThousandths: 1_000, lines: [{ componentItemId, quantityThousandths: 2_000 }] }, null);

    const { journalId, voucherId } = await postManufacturingJournal(
      companyDb,
      { bomId, warehouseId, quantityProducedThousandths: 10_000, financialYear: '2025-2026', journalDate: '2025-12-05' },
      null,
    );
    expect(journalId).toBeTruthy();
    expect(voucherId).toBeTruthy();

    // 10 output units produced -> 20 component units consumed @ Rs 10 each = Rs 200 cost, output valued at Rs 200.
    const componentPosition = await computeStockPosition(companyDb, { itemId: componentItemId, warehouseId });
    expect(componentPosition[0].quantityThousandths).toBe(1_000_000 - 20_000);

    const outputPosition = await computeStockPosition(companyDb, { itemId: outputItemId, warehouseId });
    expect(outputPosition[0].quantityThousandths).toBe(10_000);
    expect(outputPosition[0].valuePaise).toBe(20_000 * 10_00 / 1000); // exactly the components' consumed cost

    // Dr/Cr both hit Stock-in-Hand for the same amount — zero net GL impact by construction, but Trial Balance still balances.
    const tb = await computeTrialBalance(companyDb);
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });

  it('over-consuming beyond available component stock throws and leaves no partial journal/voucher behind', async () => {
    const bomId = await createBillOfMaterial(companyDb, { outputItemId, outputQuantityThousandths: 1_000, lines: [{ componentItemId, quantityThousandths: 2_000 }] }, null);

    // Requesting far more output than the component stock can support.
    await expect(
      postManufacturingJournal(companyDb, { bomId, warehouseId, quantityProducedThousandths: 10_000_000, financialYear: '2025-2026', journalDate: '2025-12-05' }, null),
    ).rejects.toThrow();

    const outputPosition = await computeStockPosition(companyDb, { itemId: outputItemId, warehouseId });
    expect(outputPosition).toHaveLength(0); // nothing was produced — atomic rollback
  });

  it('a BOM cannot list its own output item as one of its components', async () => {
    await expect(createBillOfMaterial(companyDb, { outputItemId, outputQuantityThousandths: 1_000, lines: [{ componentItemId: outputItemId, quantityThousandths: 1_000 }] }, null)).rejects.toThrow(/own components/);
  });
});
