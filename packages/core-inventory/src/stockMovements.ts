import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { createFifoLayerInTransaction, consumeFifoLayersInTransaction } from './stockLayers';
import { computeWeightedAverageIssueCost } from './weightedAverage';
import { getOrCreateBatch } from './batches';
import type { MovementType, RecordOpeningStockInput, StockMovementSummary } from './types';

interface StockableItemRow {
  id: string;
  item_type: string;
  is_batch_tracked: number | boolean;
  valuation_method: string | null;
  is_active: number | boolean;
}

async function getStockableItemOrThrow(trx: Transaction<CompanyDatabase>, itemId: string): Promise<StockableItemRow> {
  const item = await trx.selectFrom('item').selectAll().where('id', '=', itemId).executeTakeFirst();
  if (!item) {
    throw new Error('Item not found');
  }
  if (item.item_type !== 'STOCKABLE') {
    throw new Error('This item is not stockable');
  }
  if (!item.is_active) {
    throw new Error('This item is inactive');
  }
  return item as StockableItemRow;
}

function assertPositiveIntegerQuantity(quantityThousandths: number): void {
  if (!Number.isInteger(quantityThousandths) || quantityThousandths <= 0) {
    throw new Error('Quantity must be a positive whole number of thousandths of a unit');
  }
}

function assertNonNegativeIntegerRate(ratePaise: number): void {
  if (!Number.isInteger(ratePaise) || ratePaise < 0) {
    throw new Error('Rate must be a non-negative whole-paise amount');
  }
}

export interface PostPurchaseReceiptInput {
  itemId: string;
  warehouseId: string;
  quantityThousandths: number;
  ratePaise: number;
  /** Required if the item is batch-tracked. */
  batchNumber?: string;
  expiryDate?: string;
  manufactureDate?: string;
  movementDate: string;
  referenceType?: string;
  referenceId?: string;
}

/** Posts an inbound movement for a purchase receipt and, for a FIFO item, opens a new cost layer at this rate. Weighted-average items need no layer — their cost is derived on the fly from full movement history. */
export async function postPurchaseReceiptInTransaction(trx: Transaction<CompanyDatabase>, input: PostPurchaseReceiptInput, actorUserId: string | null): Promise<{ movementId: string }> {
  assertPositiveIntegerQuantity(input.quantityThousandths);
  assertNonNegativeIntegerRate(input.ratePaise);

  const item = await getStockableItemOrThrow(trx, input.itemId);
  const warehouse = await trx.selectFrom('warehouse').select('id').where('id', '=', input.warehouseId).executeTakeFirst();
  if (!warehouse) {
    throw new Error('Warehouse not found');
  }

  let batchId: string | null = null;
  if (item.is_batch_tracked) {
    if (!input.batchNumber) {
      throw new Error('A batch number is required for a batch-tracked item');
    }
    batchId = await getOrCreateBatch(trx, input.itemId, input.batchNumber, input.expiryDate ?? null, input.manufactureDate ?? null);
  }

  const valuePaise = Math.round((input.quantityThousandths * input.ratePaise) / 1000);
  const movementId = randomUUID();
  await trx
    .insertInto('stock_movement')
    .values({
      id: movementId,
      item_id: input.itemId,
      warehouse_id: input.warehouseId,
      batch_id: batchId,
      movement_type: 'PURCHASE_RECEIPT',
      quantity_thousandths: input.quantityThousandths,
      rate_paise: input.ratePaise,
      value_paise: valuePaise,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      movement_date: input.movementDate,
      created_by: actorUserId,
    })
    .execute();

  if (item.valuation_method === 'FIFO') {
    await createFifoLayerInTransaction(trx, { itemId: input.itemId, warehouseId: input.warehouseId, batchId }, input.quantityThousandths, input.ratePaise, valuePaise, movementId, input.movementDate);
  }

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'StockMovement',
    entityId: movementId,
    afterData: { movementType: 'PURCHASE_RECEIPT', itemId: input.itemId, warehouseId: input.warehouseId, batchId, quantityThousandths: input.quantityThousandths, ratePaise: input.ratePaise, valuePaise },
  });

  return { movementId };
}

export async function postPurchaseReceipt(companyDb: Kysely<CompanyDatabase>, input: PostPurchaseReceiptInput, actorUserId: string | null): Promise<{ movementId: string }> {
  return companyDb.transaction().execute((trx) => postPurchaseReceiptInTransaction(trx, input, actorUserId));
}

export interface PostSalesIssueInput {
  itemId: string;
  warehouseId: string;
  quantityThousandths: number;
  /** Required if the item is batch-tracked — the caller must pick which existing batch to issue from. */
  batchId?: string;
  movementDate: string;
  referenceType?: string;
  referenceId?: string;
}

/** Posts an outbound movement for a sale, computing its cost via FIFO layer consumption or weighted-average lookup, and returns that cost so the caller can post a matching COGS voucher entry. */
export async function postSalesIssueInTransaction(trx: Transaction<CompanyDatabase>, input: PostSalesIssueInput, actorUserId: string | null): Promise<{ movementId: string; costPaise: number }> {
  assertPositiveIntegerQuantity(input.quantityThousandths);

  const item = await getStockableItemOrThrow(trx, input.itemId);
  const warehouse = await trx.selectFrom('warehouse').select('id').where('id', '=', input.warehouseId).executeTakeFirst();
  if (!warehouse) {
    throw new Error('Warehouse not found');
  }

  let batchId: string | null = null;
  if (item.is_batch_tracked) {
    if (!input.batchId) {
      throw new Error('A batch must be specified to issue a batch-tracked item');
    }
    batchId = input.batchId;
  }

  const scope = { itemId: input.itemId, warehouseId: input.warehouseId, batchId };
  const { costPaise, consumptions } =
    item.valuation_method === 'FIFO'
      ? await consumeFifoLayersInTransaction(trx, scope, input.quantityThousandths)
      : { costPaise: await computeWeightedAverageIssueCost(trx, scope, input.quantityThousandths), consumptions: [] };

  const ratePaise = Math.round((costPaise * 1000) / input.quantityThousandths);
  const movementId = randomUUID();
  await trx
    .insertInto('stock_movement')
    .values({
      id: movementId,
      item_id: input.itemId,
      warehouse_id: input.warehouseId,
      batch_id: batchId,
      movement_type: 'SALES_ISSUE',
      quantity_thousandths: input.quantityThousandths,
      rate_paise: ratePaise,
      value_paise: costPaise,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      movement_date: input.movementDate,
      created_by: actorUserId,
    })
    .execute();

  for (const consumption of consumptions) {
    await trx
      .insertInto('stock_movement_layer_consumption')
      .values({ id: randomUUID(), movement_id: movementId, layer_id: consumption.layerId, quantity_consumed_thousandths: consumption.quantityThousandths, value_consumed_paise: consumption.valuePaise })
      .execute();
  }

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'StockMovement',
    entityId: movementId,
    afterData: { movementType: 'SALES_ISSUE', itemId: input.itemId, warehouseId: input.warehouseId, batchId, quantityThousandths: input.quantityThousandths, costPaise },
  });

  return { movementId, costPaise };
}

export async function postSalesIssue(companyDb: Kysely<CompanyDatabase>, input: PostSalesIssueInput, actorUserId: string | null): Promise<{ movementId: string; costPaise: number }> {
  return companyDb.transaction().execute((trx) => postSalesIssueInTransaction(trx, input, actorUserId));
}

/** Records opening stock — a movement only, no GL entry. Matches the existing accepted gap where ledger_account.opening_balance is separately, manually entered with no cross-ledger netting enforced (Phase 1 Open Question) — reconciling the Stock-in-Hand ledger's own opening_balance to match total opening stock value is the user's responsibility this pass. */
export async function recordOpeningStockInTransaction(trx: Transaction<CompanyDatabase>, input: RecordOpeningStockInput, actorUserId: string | null): Promise<{ movementId: string }> {
  assertPositiveIntegerQuantity(input.quantityThousandths);
  assertNonNegativeIntegerRate(input.ratePaise);

  const item = await getStockableItemOrThrow(trx, input.itemId);
  const warehouse = await trx.selectFrom('warehouse').select('id').where('id', '=', input.warehouseId).executeTakeFirst();
  if (!warehouse) {
    throw new Error('Warehouse not found');
  }

  let batchId: string | null = null;
  if (item.is_batch_tracked) {
    if (!input.batchNumber) {
      throw new Error('A batch number is required for a batch-tracked item');
    }
    batchId = await getOrCreateBatch(trx, input.itemId, input.batchNumber, input.expiryDate ?? null, input.manufactureDate ?? null);
  }

  const valuePaise = Math.round((input.quantityThousandths * input.ratePaise) / 1000);
  const movementId = randomUUID();
  await trx
    .insertInto('stock_movement')
    .values({
      id: movementId,
      item_id: input.itemId,
      warehouse_id: input.warehouseId,
      batch_id: batchId,
      movement_type: 'OPENING_STOCK',
      quantity_thousandths: input.quantityThousandths,
      rate_paise: input.ratePaise,
      value_paise: valuePaise,
      reference_type: null,
      reference_id: null,
      movement_date: input.movementDate,
      created_by: actorUserId,
    })
    .execute();

  if (item.valuation_method === 'FIFO') {
    await createFifoLayerInTransaction(trx, { itemId: input.itemId, warehouseId: input.warehouseId, batchId }, input.quantityThousandths, input.ratePaise, valuePaise, movementId, input.movementDate);
  }

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'StockMovement',
    entityId: movementId,
    afterData: { movementType: 'OPENING_STOCK', itemId: input.itemId, warehouseId: input.warehouseId, batchId, quantityThousandths: input.quantityThousandths, ratePaise: input.ratePaise, valuePaise },
  });

  return { movementId };
}

export async function recordOpeningStock(companyDb: Kysely<CompanyDatabase>, input: RecordOpeningStockInput, actorUserId: string | null): Promise<{ movementId: string }> {
  return companyDb.transaction().execute((trx) => recordOpeningStockInTransaction(trx, input, actorUserId));
}

/** Used by core-sales-purchase's cancellation guard: an invoice with any linked stock movement cannot be safely cancelled through the generic voucher-reversal path in this pass (see Phase Tracker Open Questions — full stock reversal is a flagged follow-up, not silently skipped). */
export async function hasStockMovementsForReference(companyDb: Kysely<CompanyDatabase>, referenceType: string, referenceId: string): Promise<boolean> {
  const row = await companyDb.selectFrom('stock_movement').select('id').where('reference_type', '=', referenceType).where('reference_id', '=', referenceId).executeTakeFirst();
  return row !== undefined;
}

export async function listStockMovements(companyDb: Kysely<CompanyDatabase>): Promise<StockMovementSummary[]> {
  const rows = await companyDb
    .selectFrom('stock_movement')
    .innerJoin('item', 'item.id', 'stock_movement.item_id')
    .innerJoin('warehouse', 'warehouse.id', 'stock_movement.warehouse_id')
    .leftJoin('item_batch', 'item_batch.id', 'stock_movement.batch_id')
    .select([
      'stock_movement.id as id',
      'stock_movement.item_id as itemId',
      'item.name as itemName',
      'stock_movement.warehouse_id as warehouseId',
      'warehouse.name as warehouseName',
      'stock_movement.batch_id as batchId',
      'item_batch.batch_number as batchNumber',
      'stock_movement.movement_type as movementType',
      'stock_movement.quantity_thousandths as quantityThousandths',
      'stock_movement.rate_paise as ratePaise',
      'stock_movement.value_paise as valuePaise',
      'stock_movement.reference_type as referenceType',
      'stock_movement.reference_id as referenceId',
      'stock_movement.movement_date as movementDate',
    ])
    .orderBy('stock_movement.movement_date', 'desc')
    .orderBy('stock_movement.created_at', 'desc')
    .execute();

  return rows.map((row) => ({ ...row, movementType: row.movementType as MovementType }));
}
