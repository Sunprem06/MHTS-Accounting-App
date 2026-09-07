import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { createLedgerAccount, listAccountGroups } from '@mhts/core-accounting';
import type { AssetClassSummary, CreateAssetClassInput } from './types';

async function requireGroupId(companyDb: Kysely<CompanyDatabase>, groupName: string): Promise<string> {
  const groups = await listAccountGroups(companyDb);
  const group = groups.find((g) => g.name === groupName);
  if (!group) {
    throw new Error(`Expected default account group "${groupName}" not found — this company's Chart of Accounts may predate Phase 8.`);
  }
  return group.id;
}

/**
 * Creates the asset class's two dedicated ledgers (gross block under Fixed
 * Assets, accumulated depreciation under Fixed Assets > Accumulated
 * Depreciation) and the asset_class row atomically — same "own dedicated
 * ledger, atomic creation" pattern as business_party/bank_account/employee.
 */
export async function createAssetClass(companyDb: Kysely<CompanyDatabase>, input: CreateAssetClassInput): Promise<string> {
  if (!input.name.trim()) {
    throw new Error('Asset class name is required');
  }
  if (!input.schedule2RateCategory.trim() || !input.itWdvBlockCategory.trim()) {
    throw new Error('Both a Schedule II rate category and an IT WDV block category are required');
  }

  const fixedAssetsGroupId = await requireGroupId(companyDb, 'Fixed Assets');
  const accumulatedDepreciationGroupId = await requireGroupId(companyDb, 'Accumulated Depreciation');

  const grossBlockLedgerId = await createLedgerAccount(companyDb, {
    name: input.name.trim(),
    groupId: fixedAssetsGroupId,
    openingBalance: 0,
    openingBalanceSide: 'DEBIT',
  });
  const accumulatedDepreciationLedgerId = await createLedgerAccount(companyDb, {
    name: `Accumulated Depreciation - ${input.name.trim()}`,
    groupId: accumulatedDepreciationGroupId,
    openingBalance: 0,
    openingBalanceSide: 'DEBIT',
  });

  const id = randomUUID();
  await companyDb
    .insertInto('asset_class')
    .values({
      id,
      name: input.name.trim(),
      schedule2_rate_category: input.schedule2RateCategory.trim(),
      it_wdv_block_category: input.itWdvBlockCategory.trim(),
      gross_block_ledger_id: grossBlockLedgerId,
      accumulated_depreciation_ledger_id: accumulatedDepreciationLedgerId,
      is_active: 1,
    })
    .execute();

  return id;
}

export async function listAssetClasses(companyDb: Kysely<CompanyDatabase>): Promise<AssetClassSummary[]> {
  const rows = await companyDb
    .selectFrom('asset_class')
    .innerJoin('ledger_account as gross_block', 'gross_block.id', 'asset_class.gross_block_ledger_id')
    .innerJoin('ledger_account as accumulated_depreciation', 'accumulated_depreciation.id', 'asset_class.accumulated_depreciation_ledger_id')
    .select([
      'asset_class.id as id',
      'asset_class.name as name',
      'asset_class.schedule2_rate_category as schedule2RateCategory',
      'asset_class.it_wdv_block_category as itWdvBlockCategory',
      'asset_class.gross_block_ledger_id as grossBlockLedgerId',
      'gross_block.name as grossBlockLedgerName',
      'asset_class.accumulated_depreciation_ledger_id as accumulatedDepreciationLedgerId',
      'accumulated_depreciation.name as accumulatedDepreciationLedgerName',
      'asset_class.is_active as isActive',
    ])
    .orderBy('asset_class.name')
    .execute();

  return rows.map((row) => ({ ...row, isActive: Boolean(row.isActive) }));
}
