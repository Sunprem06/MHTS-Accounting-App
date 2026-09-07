import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { computeBranchProfitAndLoss } from './branchProfitAndLoss';
import type { AccountNature } from './types';

export interface BranchBalanceSheetRow {
  branchId: string | null;
  branchName: string;
  ledgerId: string;
  ledgerName: string;
  nature: AccountNature;
  /** Debit-positive for ASSET rows, credit-positive for LIABILITY/EQUITY rows — same presentation convention as BalanceSheetRow. */
  amount: number;
}

export interface BranchBalanceSheetSummary {
  branchId: string | null;
  branchName: string;
  totalAssets: number;
  /** Includes this branch's own currentEarnings. */
  totalLiabilitiesAndEquity: number;
  currentEarnings: number;
}

export interface BranchBalanceSheet {
  asOfDate: string;
  rows: BranchBalanceSheetRow[];
  branchSummaries: BranchBalanceSheetSummary[];
  /** Sum of every branch summary's totalAssets. Must equal the whole-company computeBalanceSheet's totalAssets exactly (see doc comment below). */
  consolidatedTotalAssets: number;
  consolidatedTotalLiabilitiesAndEquity: number;
}

/**
 * A branch-wise Balance Sheet. Real subtlety, unlike branchProfitAndLoss.ts:
 * `ledger_account.opening_balance` predates branch tagging entirely, so it
 * can't be attributed to any one branch. Every ledger's opening balance
 * (plus any voucher_line never tagged to a branch) is carried in an explicit
 * "Head Office / Unassigned" bucket (branchId: null) rather than silently
 * dropped or arbitrarily assigned.
 *
 * Because every branch-tagged voucher_line belongs to EXACTLY one branch
 * bucket (or the Unassigned bucket) and opening balances are counted
 * exactly once (in Unassigned), summing every branch's totals reproduces
 * the exact same figures as the whole-company computeBalanceSheet — this is
 * the literal, honest form of the Blueprint's "consolidated multi-branch
 * reports tie out" exit criterion, not a hand-wave.
 */
export async function computeBranchBalanceSheet(companyDb: Kysely<CompanyDatabase>, asOfDate: string): Promise<BranchBalanceSheet> {
  const ledgers = await companyDb
    .selectFrom('ledger_account')
    .innerJoin('account_group', 'account_group.id', 'ledger_account.group_id')
    .where('account_group.nature', 'in', ['ASSET', 'LIABILITY', 'EQUITY'])
    .select([
      'ledger_account.id as ledgerId',
      'ledger_account.name as ledgerName',
      'account_group.nature as nature',
      'ledger_account.opening_balance as openingBalance',
      'ledger_account.opening_balance_side as openingBalanceSide',
    ])
    .execute();

  const movements = await companyDb
    .selectFrom('voucher_line')
    .innerJoin('voucher', 'voucher.id', 'voucher_line.voucher_id')
    .innerJoin('ledger_account', 'ledger_account.id', 'voucher_line.ledger_id')
    .innerJoin('account_group', 'account_group.id', 'ledger_account.group_id')
    .leftJoin('branch', 'branch.id', 'voucher_line.branch_id')
    .where('account_group.nature', 'in', ['ASSET', 'LIABILITY', 'EQUITY'])
    .where('voucher.voucher_date', '<=', asOfDate)
    .select(({ fn }) => [
      'voucher_line.ledger_id as ledgerId',
      'voucher_line.branch_id as branchId',
      'branch.name as branchName',
      fn.sum<number>('voucher_line.debit_amount').as('totalDebit'),
      fn.sum<number>('voucher_line.credit_amount').as('totalCredit'),
    ])
    .groupBy(['voucher_line.ledger_id', 'voucher_line.branch_id'])
    .execute();

  const movementKey = (ledgerId: string, branchKey: string) => `${ledgerId}::${branchKey}`;
  const movementByKey = new Map(movements.map((m) => [movementKey(m.ledgerId, m.branchId ?? '__unassigned__'), m]));
  const branchNameByKey = new Map<string, string>([['__unassigned__', 'Head Office / Unassigned']]);
  for (const m of movements) {
    if (m.branchId) {
      branchNameByKey.set(m.branchId, m.branchName ?? m.branchId);
    }
  }

  const rows: BranchBalanceSheetRow[] = [];
  const assetsByBranch = new Map<string, number>();
  const liabEquityByBranch = new Map<string, number>();

  for (const ledger of ledgers) {
    const openingSigned = ledger.openingBalanceSide === 'CREDIT' ? -ledger.openingBalance : ledger.openingBalance;
    const branchKeysForLedger = new Set<string>(['__unassigned__']);
    for (const m of movements) {
      if (m.ledgerId === ledger.ledgerId) {
        branchKeysForLedger.add(m.branchId ?? '__unassigned__');
      }
    }

    for (const branchKey of branchKeysForLedger) {
      const movement = movementByKey.get(movementKey(ledger.ledgerId, branchKey));
      const openingContribution = branchKey === '__unassigned__' ? openingSigned : 0;
      const netSigned = openingContribution + Number(movement?.totalDebit ?? 0) - Number(movement?.totalCredit ?? 0);
      if (netSigned === 0) {
        continue;
      }

      const amount = ledger.nature === 'ASSET' ? netSigned : -netSigned;
      rows.push({
        branchId: branchKey === '__unassigned__' ? null : branchKey,
        branchName: branchNameByKey.get(branchKey) ?? branchKey,
        ledgerId: ledger.ledgerId,
        ledgerName: ledger.ledgerName,
        nature: ledger.nature as AccountNature,
        amount,
      });

      if (ledger.nature === 'ASSET') {
        assetsByBranch.set(branchKey, (assetsByBranch.get(branchKey) ?? 0) + amount);
      } else {
        liabEquityByBranch.set(branchKey, (liabEquityByBranch.get(branchKey) ?? 0) + amount);
      }
    }
  }

  const branchProfitAndLoss = await computeBranchProfitAndLoss(companyDb, { toDate: asOfDate });
  const netByBranchKey = new Map(branchProfitAndLoss.map((r) => [r.branchId ?? '__unassigned__', r.net]));

  const allBranchKeys = new Set<string>(['__unassigned__', ...assetsByBranch.keys(), ...liabEquityByBranch.keys(), ...netByBranchKey.keys()]);
  const branchSummaries: BranchBalanceSheetSummary[] = [...allBranchKeys].map((branchKey) => {
    const currentEarnings = netByBranchKey.get(branchKey) ?? 0;
    return {
      branchId: branchKey === '__unassigned__' ? null : branchKey,
      branchName: branchNameByKey.get(branchKey) ?? branchKey,
      totalAssets: assetsByBranch.get(branchKey) ?? 0,
      totalLiabilitiesAndEquity: (liabEquityByBranch.get(branchKey) ?? 0) + currentEarnings,
      currentEarnings,
    };
  });
  branchSummaries.sort((a, b) => a.branchName.localeCompare(b.branchName));

  const consolidatedTotalAssets = branchSummaries.reduce((sum, b) => sum + b.totalAssets, 0);
  const consolidatedTotalLiabilitiesAndEquity = branchSummaries.reduce((sum, b) => sum + b.totalLiabilitiesAndEquity, 0);

  return { asOfDate, rows, branchSummaries, consolidatedTotalAssets, consolidatedTotalLiabilitiesAndEquity };
}
