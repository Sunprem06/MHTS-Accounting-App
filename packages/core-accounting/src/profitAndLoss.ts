import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { computeLedgerBalances } from './ledgerBalances';
import type { ProfitAndLoss, ProfitAndLossRow } from './types';

export interface ProfitAndLossOptions {
  /** Omit for "since inception" — used internally by the Balance Sheet's Current Earnings line. */
  fromDate?: string;
  toDate?: string;
}

/**
 * Income and Expense are "flow" figures for a period, not running balances —
 * unlike the Trial Balance, opening balances are deliberately excluded here
 * (income/expense ledgers aren't meant to carry a balance across periods;
 * this phase doesn't implement period-closing entries, so there's nothing
 * to exclude in practice, but the intent is explicit either way).
 */
export async function computeProfitAndLoss(
  companyDb: Kysely<CompanyDatabase>,
  options: ProfitAndLossOptions = {},
): Promise<ProfitAndLoss> {
  const balances = await computeLedgerBalances(companyDb, {
    natures: ['INCOME', 'EXPENSE'],
    fromDate: options.fromDate,
    toDate: options.toDate,
    includeOpening: false,
  });

  const incomeRows: ProfitAndLossRow[] = [];
  const expenseRows: ProfitAndLossRow[] = [];
  let totalIncome = 0;
  let totalExpense = 0;

  for (const balance of balances) {
    // Income is credit-normal (netSigned is debit-positive, so flip it); expense is debit-normal already.
    const amount = balance.nature === 'INCOME' ? -balance.netSigned : balance.netSigned;
    const row: ProfitAndLossRow = { ledgerId: balance.ledgerId, ledgerName: balance.ledgerName, groupName: balance.groupName, amount };
    if (balance.nature === 'INCOME') {
      incomeRows.push(row);
      totalIncome += amount;
    } else {
      expenseRows.push(row);
      totalExpense += amount;
    }
  }

  return { incomeRows, expenseRows, totalIncome, totalExpense, netProfit: totalIncome - totalExpense };
}
