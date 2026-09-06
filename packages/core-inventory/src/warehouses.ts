import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { CreateWarehouseInput, WarehouseSummary } from './types';

export async function createWarehouse(companyDb: Kysely<CompanyDatabase>, input: CreateWarehouseInput): Promise<string> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Warehouse name is required');
  }

  const id = randomUUID();
  await companyDb.insertInto('warehouse').values({ id, name, address: input.address?.trim() || null, is_active: 1 }).execute();
  return id;
}

export async function listWarehouses(companyDb: Kysely<CompanyDatabase>): Promise<WarehouseSummary[]> {
  const rows = await companyDb.selectFrom('warehouse').selectAll().orderBy('name').execute();
  return rows.map((row) => ({ id: row.id, name: row.name, address: row.address, isActive: Boolean(row.is_active) }));
}
