import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { createLedgerAccount, listAccountGroups } from './chartOfAccounts';
import type { BranchSummary } from './types';

export interface CreateBranchInput {
  name: string;
  code?: string;
  address?: string;
}

/**
 * Creates the branch's own dedicated "Inter-Branch Current Account" ledger
 * (under the "Inter-Branch Accounts" group) and the branch row atomically —
 * same "own dedicated ledger, atomic creation" pattern as
 * business_party/bank_account/employee/asset_class.
 */
export async function createBranch(companyDb: Kysely<CompanyDatabase>, input: CreateBranchInput): Promise<string> {
  if (!input.name.trim()) {
    throw new Error('Branch name is required');
  }

  const groups = await listAccountGroups(companyDb);
  const interBranchGroup = groups.find((g) => g.name === 'Inter-Branch Accounts');
  if (!interBranchGroup) {
    throw new Error('Expected default account group "Inter-Branch Accounts" not found — this company\'s Chart of Accounts may predate Phase 8 Increment 2.');
  }

  const interBranchLedgerId = await createLedgerAccount(companyDb, {
    name: `Inter-Branch Current A/c - ${input.name.trim()}`,
    groupId: interBranchGroup.id,
    openingBalance: 0,
    openingBalanceSide: 'DEBIT',
  });

  const id = randomUUID();
  await companyDb
    .insertInto('branch')
    .values({
      id,
      name: input.name.trim(),
      code: input.code?.trim() ?? null,
      address: input.address?.trim() ?? null,
      inter_branch_ledger_id: interBranchLedgerId,
      is_active: 1,
    })
    .execute();

  return id;
}

export async function listBranches(companyDb: Kysely<CompanyDatabase>): Promise<BranchSummary[]> {
  const rows = await companyDb.selectFrom('branch').selectAll().orderBy('name').execute();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
    interBranchLedgerId: row.inter_branch_ledger_id,
    isActive: Boolean(row.is_active),
  }));
}

export interface UpdateBranchInput {
  name?: string;
  code?: string | null;
  address?: string | null;
  isActive?: boolean;
}

/** Never touches inter_branch_ledger_id — a branch's dedicated ledger, once created, is permanent (same reasoning as updateCostCentre never re-parenting a centre with existing tagged vouchers). */
export async function updateBranch(companyDb: Kysely<CompanyDatabase>, id: string, input: UpdateBranchInput): Promise<void> {
  const existing = await companyDb.selectFrom('branch').select('id').where('id', '=', id).executeTakeFirst();
  if (!existing) {
    throw new Error('Branch not found');
  }
  if (input.name !== undefined && !input.name.trim()) {
    throw new Error('Branch name is required');
  }

  await companyDb
    .updateTable('branch')
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive ? 1 : 0 } : {}),
    })
    .where('id', '=', id)
    .execute();
}
