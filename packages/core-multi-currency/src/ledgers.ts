import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

/** Realized (booking-vs-settlement rate) and unrealized (period-end revaluation) gain/loss are kept as two separate ledgers, not one, so financial statements distinguish the two — a real CA-relevant distinction. Both can swing debit/credit (a loss vs. a gain), same convention as core-fixed-assets's "Profit/Loss on Sale of Assets". */
export const REALIZED_FOREX_GAIN_LOSS_LEDGER = 'Realized Forex Gain/Loss';
export const UNREALIZED_FOREX_GAIN_LOSS_LEDGER = 'Unrealized Forex Gain/Loss';

/** Seeded once at company creation, alongside every other module's own ledgers (see @mhts/core-fixed-assets's seedFixedAssetLedgers for the identical pattern). */
export async function seedMultiCurrencyLedgers(companyDb: Kysely<CompanyDatabase>): Promise<void> {
  const indirectIncomeGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Indirect Income').executeTakeFirst();
  if (!indirectIncomeGroup) {
    throw new Error('Indirect Income group not found — seedChartOfAccounts must run before seedMultiCurrencyLedgers');
  }

  await companyDb
    .insertInto('ledger_account')
    .values([
      { id: randomUUID(), name: REALIZED_FOREX_GAIN_LOSS_LEDGER, group_id: indirectIncomeGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: UNREALIZED_FOREX_GAIN_LOSS_LEDGER, group_id: indirectIncomeGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
    ])
    .execute();
}

async function ledgerIdByName(companyDb: Kysely<CompanyDatabase>, name: string): Promise<string> {
  const row = await companyDb.selectFrom('ledger_account').select('id').where('name', '=', name).executeTakeFirst();
  if (!row) {
    throw new Error(`"${name}" ledger not found — seedMultiCurrencyLedgers must run at company creation`);
  }
  return row.id;
}

export interface MultiCurrencyLedgerIds {
  realizedForexGainLossLedgerId: string;
  unrealizedForexGainLossLedgerId: string;
}

export async function getMultiCurrencyLedgerIds(companyDb: Kysely<CompanyDatabase>): Promise<MultiCurrencyLedgerIds> {
  return {
    realizedForexGainLossLedgerId: await ledgerIdByName(companyDb, REALIZED_FOREX_GAIN_LOSS_LEDGER),
    unrealizedForexGainLossLedgerId: await ledgerIdByName(companyDb, UNREALIZED_FOREX_GAIN_LOSS_LEDGER),
  };
}
