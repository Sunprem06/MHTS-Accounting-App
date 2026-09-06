import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { StockPositionQuery, StockPositionRow } from './types';

const INBOUND_TYPES = ['OPENING_STOCK', 'PURCHASE_RECEIPT', 'ADJUSTMENT_IN', 'TRANSFER_IN'] as const;

/**
 * Derived on-hand qty/value per (item, warehouse, batch) — the same
 * on-the-fly philosophy as core-accounting's computeLedgerBalances, no
 * cached balance table. Aggregation (grouping + summing per movement_type)
 * happens in SQL; only the final inbound-minus-outbound combination happens
 * in JS, mirroring computeLedgerBalances' own debit/credit combination step.
 */
export async function computeStockPosition(companyDb: Kysely<CompanyDatabase>, query: StockPositionQuery = {}): Promise<StockPositionRow[]> {
  let movementQuery = companyDb
    .selectFrom('stock_movement')
    .select(({ fn }) => [
      'item_id as itemId',
      'warehouse_id as warehouseId',
      'batch_id as batchId',
      'movement_type as movementType',
      fn.sum<number>('quantity_thousandths').as('totalQuantity'),
      fn.sum<number>('value_paise').as('totalValue'),
    ])
    .groupBy(['item_id', 'warehouse_id', 'batch_id', 'movement_type']);

  if (query.itemId) movementQuery = movementQuery.where('item_id', '=', query.itemId);
  if (query.warehouseId) movementQuery = movementQuery.where('warehouse_id', '=', query.warehouseId);
  if (query.batchId) movementQuery = movementQuery.where('batch_id', '=', query.batchId);
  if (query.asOfDate) movementQuery = movementQuery.where('movement_date', '<=', query.asOfDate);

  const rows = await movementQuery.execute();

  const positions = new Map<string, { itemId: string; warehouseId: string; batchId: string | null; quantityThousandths: number; valuePaise: number }>();
  for (const row of rows) {
    const key = `${row.itemId}::${row.warehouseId}::${row.batchId ?? ''}`;
    const existing = positions.get(key) ?? { itemId: row.itemId, warehouseId: row.warehouseId, batchId: row.batchId, quantityThousandths: 0, valuePaise: 0 };
    const sign = (INBOUND_TYPES as readonly string[]).includes(row.movementType) ? 1 : -1;
    existing.quantityThousandths += sign * Number(row.totalQuantity);
    existing.valuePaise += sign * Number(row.totalValue);
    positions.set(key, existing);
  }

  const nonZeroPositions = [...positions.values()].filter((p) => p.quantityThousandths !== 0 || p.valuePaise !== 0);
  if (nonZeroPositions.length === 0) {
    return [];
  }

  const itemIds = [...new Set(nonZeroPositions.map((p) => p.itemId))];
  const warehouseIds = [...new Set(nonZeroPositions.map((p) => p.warehouseId))];
  const batchIds = [...new Set(nonZeroPositions.map((p) => p.batchId).filter((id): id is string => id !== null))];

  const items = await companyDb.selectFrom('item').select(['id', 'name']).where('id', 'in', itemIds).execute();
  const warehouses = await companyDb.selectFrom('warehouse').select(['id', 'name']).where('id', 'in', warehouseIds).execute();
  const batches = batchIds.length > 0 ? await companyDb.selectFrom('item_batch').select(['id', 'batch_number']).where('id', 'in', batchIds).execute() : [];

  const itemNameById = new Map(items.map((i) => [i.id, i.name]));
  const warehouseNameById = new Map(warehouses.map((w) => [w.id, w.name]));
  const batchNumberById = new Map(batches.map((b) => [b.id, b.batch_number]));

  return nonZeroPositions.map((position) => ({
    itemId: position.itemId,
    itemName: itemNameById.get(position.itemId) ?? 'Unknown item',
    warehouseId: position.warehouseId,
    warehouseName: warehouseNameById.get(position.warehouseId) ?? 'Unknown warehouse',
    batchId: position.batchId,
    batchNumber: position.batchId ? (batchNumberById.get(position.batchId) ?? null) : null,
    quantityThousandths: position.quantityThousandths,
    valuePaise: position.valuePaise,
  }));
}
