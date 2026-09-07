import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export interface CostCentreSummaryRow {
  costCentreId: string | null;
  /** 'Unassigned' when costCentreId is null — voucher lines never tagged to any cost centre. */
  costCentreName: string;
  /** Paise. Credit-normal, flipped positive (same convention as ProfitAndLossRow). */
  totalIncome: number;
  /** Paise. Debit-normal. */
  totalExpense: number;
  /** totalIncome - totalExpense. */
  net: number;
}

/**
 * A cost-centre-wise P&L: the same INCOME/EXPENSE nature split
 * profitAndLoss.ts uses, grouped by voucher_line.cost_centre_id instead of
 * by ledger. Deliberately its own query rather than a reuse of
 * computeLedgerBalances, which groups by ledger_id and has no cost-centre
 * dimension to group by instead.
 */
export async function computeCostCentreSummary(
  companyDb: Kysely<CompanyDatabase>,
  options: { fromDate?: string; toDate?: string } = {},
): Promise<CostCentreSummaryRow[]> {
  let query = companyDb
    .selectFrom('voucher_line')
    .innerJoin('voucher', 'voucher.id', 'voucher_line.voucher_id')
    .innerJoin('ledger_account', 'ledger_account.id', 'voucher_line.ledger_id')
    .innerJoin('account_group', 'account_group.id', 'ledger_account.group_id')
    .leftJoin('cost_centre', 'cost_centre.id', 'voucher_line.cost_centre_id')
    .where('account_group.nature', 'in', ['INCOME', 'EXPENSE'])
    .select(({ fn }) => [
      'voucher_line.cost_centre_id as costCentreId',
      'cost_centre.name as costCentreName',
      'account_group.nature as nature',
      fn.sum<number>('voucher_line.debit_amount').as('totalDebit'),
      fn.sum<number>('voucher_line.credit_amount').as('totalCredit'),
    ])
    .groupBy(['voucher_line.cost_centre_id', 'account_group.nature']);
  if (options.fromDate) {
    query = query.where('voucher.voucher_date', '>=', options.fromDate);
  }
  if (options.toDate) {
    query = query.where('voucher.voucher_date', '<=', options.toDate);
  }

  const rows = await query.execute();

  const byCostCentre = new Map<string, CostCentreSummaryRow>();
  for (const row of rows) {
    const key = row.costCentreId ?? '__unassigned__';
    const existing = byCostCentre.get(key) ?? {
      costCentreId: row.costCentreId,
      costCentreName: row.costCentreName ?? 'Unassigned',
      totalIncome: 0,
      totalExpense: 0,
      net: 0,
    };
    // Income is credit-normal (flip to positive); expense is debit-normal already — same convention as profitAndLoss.ts.
    if (row.nature === 'INCOME') {
      existing.totalIncome += Number(row.totalCredit) - Number(row.totalDebit);
    } else {
      existing.totalExpense += Number(row.totalDebit) - Number(row.totalCredit);
    }
    existing.net = existing.totalIncome - existing.totalExpense;
    byCostCentre.set(key, existing);
  }

  return [...byCostCentre.values()].sort((a, b) => a.costCentreName.localeCompare(b.costCentreName));
}
