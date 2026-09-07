import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export interface CostCentreSummary {
  id: string;
  name: string;
  code: string | null;
  parentCostCentreId: string | null;
  isActive: boolean;
}

export interface CreateCostCentreInput {
  name: string;
  code?: string;
  parentCostCentreId?: string;
}

/**
 * No delete — a cost centre may already be referenced by voucher_line rows
 * (append-only, same reasoning as every other referenced dimension in this
 * schema). `updateCostCentre` only ever touches name/code/isActive, never
 * re-parents a centre with existing tagged vouchers out from under a report
 * that's already been run against it.
 */
export async function createCostCentre(companyDb: Kysely<CompanyDatabase>, input: CreateCostCentreInput): Promise<string> {
  if (!input.name.trim()) {
    throw new Error('Cost centre name is required');
  }
  if (input.parentCostCentreId) {
    const parent = await companyDb.selectFrom('cost_centre').select('id').where('id', '=', input.parentCostCentreId).executeTakeFirst();
    if (!parent) {
      throw new Error('Parent cost centre not found');
    }
  }

  const id = randomUUID();
  await companyDb
    .insertInto('cost_centre')
    .values({
      id,
      name: input.name.trim(),
      code: input.code?.trim() ?? null,
      parent_cost_centre_id: input.parentCostCentreId ?? null,
      is_active: 1,
    })
    .execute();
  return id;
}

export async function listCostCentres(companyDb: Kysely<CompanyDatabase>): Promise<CostCentreSummary[]> {
  const rows = await companyDb.selectFrom('cost_centre').selectAll().orderBy('name').execute();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    parentCostCentreId: row.parent_cost_centre_id,
    isActive: Boolean(row.is_active),
  }));
}

export interface UpdateCostCentreInput {
  name?: string;
  code?: string | null;
  isActive?: boolean;
}

export async function updateCostCentre(companyDb: Kysely<CompanyDatabase>, id: string, input: UpdateCostCentreInput): Promise<void> {
  const existing = await companyDb.selectFrom('cost_centre').select('id').where('id', '=', id).executeTakeFirst();
  if (!existing) {
    throw new Error('Cost centre not found');
  }
  if (input.name !== undefined && !input.name.trim()) {
    throw new Error('Cost centre name is required');
  }

  await companyDb
    .updateTable('cost_centre')
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive ? 1 : 0 } : {}),
    })
    .where('id', '=', id)
    .execute();
}
