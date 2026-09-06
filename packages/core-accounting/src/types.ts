/**
 * The five classical double-entry categories. Unlike GST rates or payroll
 * formulas (CLAUDE.md Rule #2), this is a fixed accounting primitive that
 * doesn't change with legislation — validated against this closed set in
 * application code rather than modeled as versioned RuleSet data.
 */
export const ACCOUNT_NATURES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const;
export type AccountNature = (typeof ACCOUNT_NATURES)[number];

export const BALANCE_SIDES = ['DEBIT', 'CREDIT'] as const;
export type BalanceSide = (typeof BALANCE_SIDES)[number];

/** SALES_INVOICE/PURCHASE_INVOICE added in Phase 2 (@mhts/core-sales-purchase); STOCK_ADJUSTMENT added in Phase 3 (@mhts/core-inventory); EXPENSE_CLAIM added in Phase 6 (@mhts/core-expense) — all posted via createVoucherInTransaction, same engine as every other voucher type. */
export const VOUCHER_TYPES = ['JOURNAL', 'PAYMENT', 'RECEIPT', 'CONTRA', 'SALES_INVOICE', 'PURCHASE_INVOICE', 'STOCK_ADJUSTMENT', 'EXPENSE_CLAIM'] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];

export interface AccountGroupSummary {
  id: string;
  name: string;
  parentGroupId: string | null;
  nature: AccountNature;
  isSystemGroup: boolean;
}

export interface LedgerAccountSummary {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  nature: AccountNature;
  openingBalance: number;
  openingBalanceSide: BalanceSide;
  isSystemLedger: boolean;
}

export interface VoucherLineInput {
  ledgerId: string;
  /** Paise. Exactly one of debitAmount/creditAmount must be > 0. */
  debitAmount: number;
  creditAmount: number;
  lineNarration?: string;
}

export interface CreateVoucherInput {
  voucherType: VoucherType;
  /** e.g. '2026-27' — computed by the caller from the company's financial_year_start_month (system DB). */
  financialYear: string;
  voucherDate: string;
  narration?: string;
  lines: VoucherLineInput[];
}

export interface VoucherSummary {
  id: string;
  voucherType: VoucherType;
  voucherNumber: number;
  financialYear: string;
  voucherDate: string;
  narration: string | null;
  /** Paise. Sum of the debit side (== sum of the credit side, by construction). */
  totalAmount: number;
  cancelledAt: string | null;
  cancelledByVoucherId: string | null;
  /** Non-null if this voucher IS a reversal of another one. */
  reversesVoucherId: string | null;
}

export interface TrialBalanceRow {
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  nature: AccountNature;
  debitBalance: number;
  creditBalance: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
}

export interface ProfitAndLossRow {
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  /** Positive = income earned / expense incurred. Never negative in the ordinary case (a net-negative row usually means a return/reversal). */
  amount: number;
}

export interface ProfitAndLoss {
  incomeRows: ProfitAndLossRow[];
  expenseRows: ProfitAndLossRow[];
  totalIncome: number;
  totalExpense: number;
  /** totalIncome - totalExpense. Negative means a loss for the period. */
  netProfit: number;
}

export interface BalanceSheetRow {
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  nature: AccountNature;
  /** Debit-positive for ASSET rows, credit-positive for LIABILITY/EQUITY rows — the presentation convention where both sides of the sheet read as positive numbers. */
  amount: number;
}

export interface BalanceSheet {
  asOfDate: string;
  assetRows: BalanceSheetRow[];
  liabilityRows: BalanceSheetRow[];
  equityRows: BalanceSheetRow[];
  /** Net profit/loss since inception up to asOfDate, not yet closed into a real equity ledger — shown as a synthetic "Current Earnings" line so the sheet balances without requiring period-closing journal entries. */
  currentEarnings: number;
  totalAssets: number;
  /** liabilityRows + equityRows + currentEarnings. Should equal totalAssets when the books are consistent. */
  totalLiabilitiesAndEquity: number;
}
