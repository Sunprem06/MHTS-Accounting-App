import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { ItemBatchSummary } from './types';

/** Batches are created implicitly the first time a batch number is received for an item — there's no standalone "create batch" screen. Returns the existing batch id if this (item, batchNumber) pair already exists. */
export async function getOrCreateBatch(
  companyDb: Kysely<CompanyDatabase>,
  itemId: string,
  batchNumber: string,
  expiryDate: string | null,
  manufactureDate: string | null,
): Promise<string> {
  const trimmed = batchNumber.trim();
  if (!trimmed) {
    throw new Error('Batch number is required for a batch-tracked item');
  }

  const existing = await companyDb.selectFrom('item_batch').select('id').where('item_id', '=', itemId).where('batch_number', '=', trimmed).executeTakeFirst();
  if (existing) {
    return existing.id;
  }

  const id = randomUUID();
  await companyDb
    .insertInto('item_batch')
    .values({ id, item_id: itemId, batch_number: trimmed, expiry_date: expiryDate, manufacture_date: manufactureDate })
    .execute();
  return id;
}

export async function listBatchesForItem(companyDb: Kysely<CompanyDatabase>, itemId: string): Promise<ItemBatchSummary[]> {
  const rows = await companyDb.selectFrom('item_batch').selectAll().where('item_id', '=', itemId).orderBy('batch_number').execute();
  return rows.map((row) => ({ id: row.id, itemId: row.item_id, batchNumber: row.batch_number, expiryDate: row.expiry_date, manufactureDate: row.manufacture_date }));
}
