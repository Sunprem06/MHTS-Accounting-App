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

/** More types (SALES, PURCHASE, ...) land in later phases alongside their own modules. */
export const VOUCHER_TYPES = ['JOURNAL', 'PAYMENT', 'RECEIPT', 'CONTRA'] as const;
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
