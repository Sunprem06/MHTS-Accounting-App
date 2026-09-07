import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

/** Shared across every asset class — a class-specific gross-block/accumulated-depreciation pair is created per class instead (see assetClasses.ts). */
export const DEPRECIATION_EXPENSE_LEDGER = 'Depreciation';
/** Can carry either a debit (net loss) or credit (net gain) balance across different disposals — same contra-style ledger reasoning as GST/TDS payable ledgers elsewhere in this codebase. */
export const PROFIT_LOSS_ON_ASSET_SALE_LEDGER = 'Profit/Loss on Sale of Assets';

/** Depreciation sits under the existing "Indirect Expenses" group; Profit/Loss on Sale of Assets sits under the existing "Indirect Income" group (a loss simply nets that ledger negative, same convention documented on the Accumulated Depreciation group in chartOfAccounts.ts). Neither asset-class-specific ledger is seeded here — those are created per class by createAssetClass. */
export async function seedFixedAssetLedgers(companyDb: Kysely<CompanyDatabase>): Promise<void> {
  const indirectExpensesGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Indirect Expenses').executeTakeFirst();
  if (!indirectExpensesGroup) {
    throw new Error('Indirect Expenses group not found — seedChartOfAccounts must run before seedFixedAssetLedgers');
  }
  const indirectIncomeGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Indirect Income').executeTakeFirst();
  if (!indirectIncomeGroup) {
    throw new Error('Indirect Income group not found — seedChartOfAccounts must run before seedFixedAssetLedgers');
  }

  await companyDb
    .insertInto('ledger_account')
    .values([
      { id: randomUUID(), name: DEPRECIATION_EXPENSE_LEDGER, group_id: indirectExpensesGroup.id, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
      { id: randomUUID(), name: PROFIT_LOSS_ON_ASSET_SALE_LEDGER, group_id: indirectIncomeGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
    ])
    .execute();
}

async function ledgerIdByName(companyDb: Kysely<CompanyDatabase>, name: string): Promise<string> {
  const row = await companyDb.selectFrom('ledger_account').select('id').where('name', '=', name).executeTakeFirst();
  if (!row) {
    throw new Error(`"${name}" ledger not found — seedFixedAssetLedgers must run at company creation`);
  }
  return row.id;
}

export interface FixedAssetLedgerIds {
  depreciationExpenseLedgerId: string;
  profitLossOnAssetSaleLedgerId: string;
}

export async function getFixedAssetLedgerIds(companyDb: Kysely<CompanyDatabase>): Promise<FixedAssetLedgerIds> {
  return {
    depreciationExpenseLedgerId: await ledgerIdByName(companyDb, DEPRECIATION_EXPENSE_LEDGER),
    profitLossOnAssetSaleLedgerId: await ledgerIdByName(companyDb, PROFIT_LOSS_ON_ASSET_SALE_LEDGER),
  };
}
