import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { CreateUnitOfMeasureInput, UnitOfMeasureSummary } from './types';

export async function createUnitOfMeasure(companyDb: Kysely<CompanyDatabase>, input: CreateUnitOfMeasureInput): Promise<string> {
  const name = input.name.trim();
  const symbol = input.symbol.trim();
  if (!name) {
    throw new Error('Unit name is required');
  }
  if (!symbol) {
    throw new Error('Unit symbol is required');
  }

  const id = randomUUID();
  await companyDb.insertInto('unit_of_measure').values({ id, name, symbol, is_active: 1 }).execute();
  return id;
}

export async function listUnitsOfMeasure(companyDb: Kysely<CompanyDatabase>): Promise<UnitOfMeasureSummary[]> {
  const rows = await companyDb.selectFrom('unit_of_measure').selectAll().orderBy('name').execute();
  return rows.map((row) => ({ id: row.id, name: row.name, symbol: row.symbol, isActive: Boolean(row.is_active) }));
}
