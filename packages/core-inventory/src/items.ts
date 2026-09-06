import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { ITEM_TYPES, VALUATION_METHODS } from './types';
import type { CreateItemInput, ItemSummary } from './types';

export async function createItem(companyDb: Kysely<CompanyDatabase>, input: CreateItemInput): Promise<string> {
  if (!ITEM_TYPES.includes(input.itemType)) {
    throw new Error(`Unknown item type: ${input.itemType}`);
  }
  const itemCode = input.itemCode.trim();
  const name = input.name.trim();
  if (!itemCode) {
    throw new Error('Item code is required');
  }
  if (!name) {
    throw new Error('Item name is required');
  }

  const isStockable = input.itemType === 'STOCKABLE';
  if (isStockable) {
    if (!input.unitId) {
      throw new Error('A stockable item needs a unit of measure');
    }
    if (!input.valuationMethod || !VALUATION_METHODS.includes(input.valuationMethod)) {
      throw new Error('A stockable item needs a valuation method (FIFO or Weighted Average)');
    }
    const unit = await companyDb.selectFrom('unit_of_measure').select('id').where('id', '=', input.unitId).executeTakeFirst();
    if (!unit) {
      throw new Error('Unit of measure not found');
    }
  }

  const id = randomUUID();
  await companyDb
    .insertInto('item')
    .values({
      id,
      item_code: itemCode,
      name,
      item_type: input.itemType,
      unit_id: isStockable ? (input.unitId ?? null) : null,
      hsn_sac_code: input.hsnSacCode?.trim() || null,
      is_batch_tracked: isStockable && input.isBatchTracked ? 1 : 0,
      valuation_method: isStockable ? (input.valuationMethod ?? null) : null,
      default_sales_ledger_id: input.defaultSalesLedgerId ?? null,
      is_active: 1,
    })
    .execute();
  return id;
}

export async function listItems(companyDb: Kysely<CompanyDatabase>): Promise<ItemSummary[]> {
  const rows = await companyDb
    .selectFrom('item')
    .leftJoin('unit_of_measure', 'unit_of_measure.id', 'item.unit_id')
    .select([
      'item.id as id',
      'item.item_code as itemCode',
      'item.name as name',
      'item.item_type as itemType',
      'item.unit_id as unitId',
      'unit_of_measure.name as unitName',
      'item.hsn_sac_code as hsnSacCode',
      'item.is_batch_tracked as isBatchTracked',
      'item.valuation_method as valuationMethod',
      'item.default_sales_ledger_id as defaultSalesLedgerId',
      'item.is_active as isActive',
    ])
    .orderBy('item.name')
    .execute();

  return rows.map((row) => ({
    ...row,
    itemType: row.itemType as ItemSummary['itemType'],
    valuationMethod: row.valuationMethod as ItemSummary['valuationMethod'],
    isBatchTracked: Boolean(row.isBatchTracked),
    isActive: Boolean(row.isActive),
  }));
}

export async function getItemOrThrow(companyDb: Kysely<CompanyDatabase>, itemId: string) {
  const item = await companyDb.selectFrom('item').selectAll().where('id', '=', itemId).executeTakeFirst();
  if (!item) {
    throw new Error('Item not found');
  }
  return item;
}
