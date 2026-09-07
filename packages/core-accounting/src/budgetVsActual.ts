import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { listBudgets, type BudgetSummary } from './budgets';

export interface BudgetVsActualRow {
  periodMonth: number;
  budgetedPaise: number;
  actualPaise: number;
  /** actualPaise - budgetedPaise. Positive = over budget. */
  variancePaise: number;
  /** Null when budgetedPaise is 0 (division by zero avoided, not a 0% claim). */
  variancePercent: number | null;
}

/** e.g. financialYearStartMonth=4, financialYear='2026-27', periodMonth=6 (June) -> {fromDate:'2026-06-01', toDate:'2026-06-30'}; periodMonth=2 (Feb) -> the 2027 calendar year instead. */
function monthDateBounds(financialYearStartMonth: number, financialYear: string, periodMonth: number): { fromDate: string; toDate: string } {
  const startYear = Number(financialYear.slice(0, 4));
  const calendarYear = periodMonth >= financialYearStartMonth ? startYear : startYear + 1;
  const fromDate = new Date(Date.UTC(calendarYear, periodMonth - 1, 1));
  const toDate = new Date(Date.UTC(calendarYear, periodMonth, 0)); // day 0 of next month = last day of this month
  return { fromDate: fromDate.toISOString().slice(0, 10), toDate: toDate.toISOString().slice(0, 10) };
}

/**
 * Compares a budget's monthly lines against actual posted voucher_line
 * amounts for the same scope (ledger and/or cost centre) and month — no
 * separate "actual" table, re-querying voucher_line the same way every
 * other report in this package does.
 *
 * Design choice: when a budget names a ledger, "actual" is that ledger's own
 * debit-credit movement for the month (flipped positive for an INCOME-nature
 * ledger, so a revenue budget and its actual both read as positive
 * comparable figures). When a budget is cost-centre-only (no specific
 * ledger — the more common department-budget case), "actual" is that cost
 * centre's total EXPENSE-nature spend for the month — budgets track spend
 * per department, not the department's own revenue attribution, which this
 * pass doesn't attempt to allocate.
 */
export async function computeBudgetVsActual(
  companyDb: Kysely<CompanyDatabase>,
  budgetId: string,
  financialYearStartMonth: number,
): Promise<{ budget: BudgetSummary; rows: BudgetVsActualRow[] }> {
  const budgets = await listBudgets(companyDb);
  const budget = budgets.find((b) => b.id === budgetId);
  if (!budget) {
    throw new Error('Budget not found');
  }

  let ledgerNature: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE' | null = null;
  if (budget.ledgerId) {
    const ledger = await companyDb
      .selectFrom('ledger_account')
      .innerJoin('account_group', 'account_group.id', 'ledger_account.group_id')
      .select('account_group.nature as nature')
      .where('ledger_account.id', '=', budget.ledgerId)
      .executeTakeFirst();
    ledgerNature = ledger ? (ledger.nature as NonNullable<typeof ledgerNature>) : null;
  }

  const rows: BudgetVsActualRow[] = [];
  for (const line of budget.lines) {
    const { fromDate, toDate } = monthDateBounds(financialYearStartMonth, budget.financialYear, line.periodMonth);

    let query = companyDb
      .selectFrom('voucher_line')
      .innerJoin('voucher', 'voucher.id', 'voucher_line.voucher_id')
      .innerJoin('ledger_account', 'ledger_account.id', 'voucher_line.ledger_id')
      .innerJoin('account_group', 'account_group.id', 'ledger_account.group_id')
      .select(({ fn }) => [fn.sum<number>('voucher_line.debit_amount').as('totalDebit'), fn.sum<number>('voucher_line.credit_amount').as('totalCredit')])
      .where('voucher.voucher_date', '>=', fromDate)
      .where('voucher.voucher_date', '<=', toDate);

    if (budget.ledgerId) {
      query = query.where('voucher_line.ledger_id', '=', budget.ledgerId);
    } else {
      query = query.where('account_group.nature', '=', 'EXPENSE');
    }
    if (budget.costCentreId) {
      query = query.where('voucher_line.cost_centre_id', '=', budget.costCentreId);
    }

    const result = await query.executeTakeFirst();
    const netDebitPositive = Number(result?.totalDebit ?? 0) - Number(result?.totalCredit ?? 0);
    const actualPaise = ledgerNature === 'INCOME' ? -netDebitPositive : netDebitPositive;

    const variancePaise = actualPaise - line.amountPaise;
    rows.push({
      periodMonth: line.periodMonth,
      budgetedPaise: line.amountPaise,
      actualPaise,
      variancePaise,
      variancePercent: line.amountPaise === 0 ? null : Math.round((variancePaise / line.amountPaise) * 10000) / 100,
    });
  }

  return { budget, rows };
}
