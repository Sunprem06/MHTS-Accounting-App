import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export interface BranchProfitAndLossRow {
  branchId: string | null;
  /** 'Head Office / Unassigned' when branchId is null — voucher lines never tagged to any branch. */
  branchName: string;
  /** Paise. Credit-normal, flipped positive (same convention as ProfitAndLossRow). */
  totalIncome: number;
  /** Paise. Debit-normal. */
  totalExpense: number;
  /** totalIncome - totalExpense. */
  net: number;
}

/**
 * A branch-wise P&L: the same INCOME/EXPENSE nature split profitAndLoss.ts
 * uses, grouped by voucher_line.branch_id instead of by ledger — direct
 * parallel to costCentreReport.ts's computeCostCentreSummary.
 */
export async function computeBranchProfitAndLoss(
  companyDb: Kysely<CompanyDatabase>,
  options: { fromDate?: string; toDate?: string } = {},
): Promise<BranchProfitAndLossRow[]> {
  let query = companyDb
    .selectFrom('voucher_line')
    .innerJoin('voucher', 'voucher.id', 'voucher_line.voucher_id')
    .innerJoin('ledger_account', 'ledger_account.id', 'voucher_line.ledger_id')
    .innerJoin('account_group', 'account_group.id', 'ledger_account.group_id')
    .leftJoin('branch', 'branch.id', 'voucher_line.branch_id')
    .where('account_group.nature', 'in', ['INCOME', 'EXPENSE'])
    .select(({ fn }) => [
      'voucher_line.branch_id as branchId',
      'branch.name as branchName',
      'account_group.nature as nature',
      fn.sum<number>('voucher_line.debit_amount').as('totalDebit'),
      fn.sum<number>('voucher_line.credit_amount').as('totalCredit'),
    ])
    .groupBy(['voucher_line.branch_id', 'account_group.nature']);
  if (options.fromDate) {
    query = query.where('voucher.voucher_date', '>=', options.fromDate);
  }
  if (options.toDate) {
    query = query.where('voucher.voucher_date', '<=', options.toDate);
  }

  const rows = await query.execute();

  const byBranch = new Map<string, BranchProfitAndLossRow>();
  for (const row of rows) {
    const key = row.branchId ?? '__unassigned__';
    const existing = byBranch.get(key) ?? {
      branchId: row.branchId,
      branchName: row.branchName ?? 'Head Office / Unassigned',
      totalIncome: 0,
      totalExpense: 0,
      net: 0,
    };
    if (row.nature === 'INCOME') {
      existing.totalIncome += Number(row.totalCredit) - Number(row.totalDebit);
    } else {
      existing.totalExpense += Number(row.totalDebit) - Number(row.totalCredit);
    }
    existing.net = existing.totalIncome - existing.totalExpense;
    byBranch.set(key, existing);
  }

  return [...byBranch.values()].sort((a, b) => a.branchName.localeCompare(b.branchName));
}
