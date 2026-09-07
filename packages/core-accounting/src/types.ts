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

/** SALES_INVOICE/PURCHASE_INVOICE added in Phase 2 (@mhts/core-sales-purchase); STOCK_ADJUSTMENT added in Phase 3 (@mhts/core-inventory); EXPENSE_CLAIM added in Phase 6 (@mhts/core-expense); PAYROLL and GRATUITY_PROVISION added in Phase 7 (@mhts/core-payroll-engine); ASSET_ACQUISITION/DEPRECIATION/ASSET_DISPOSAL and MANUFACTURING_JOURNAL added in Phase 8 (@mhts/core-fixed-assets and @mhts/core-manufacturing respectively) — all posted via createVoucherInTransaction, same engine as every other voucher type. */
export const VOUCHER_TYPES = [
  'JOURNAL',
  'PAYMENT',
  'RECEIPT',
  'CONTRA',
  'SALES_INVOICE',
  'PURCHASE_INVOICE',
  'STOCK_ADJUSTMENT',
  'EXPENSE_CLAIM',
  'PAYROLL',
  'GRATUITY_PROVISION',
  'ASSET_ACQUISITION',
  'DEPRECIATION',
  'ASSET_DISPOSAL',
  /** Phase 8 Increment 2 (multi-currency) — see @mhts/core-multi-currency's revaluation.ts. */
  'FX_REVALUATION',
  /** Phase 8 Increment 2 (multi-branch) — see @mhts/core-accounting's interBranchTransfer.ts. */
  'INTER_BRANCH_TRANSFER',
  /** Phase 8 Increment 3 (manufacturing) — see @mhts/core-manufacturing's manufacturingJournal.ts. Dr/Cr the same Stock-in-Hand ledger; net GL impact is zero by construction, kept as a real voucher for its own audit trail entry. */
  'MANUFACTURING_JOURNAL',
] as const;
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
  /** Paise. Exactly one of debitAmount/creditAmount must be > 0. When foreignCurrency is set, this must exactly equal convertForeignToBase(foreignAmount, exchangeRateMicros) — validated in vouchers.ts. */
  debitAmount: number;
  creditAmount: number;
  lineNarration?: string;
  /** Phase 8 (Advanced ERP) — optional dimension tag, see costCentres.ts. */
  costCentreId?: string;
  /** Phase 8 Increment 2 — optional dimension tag, see branches.ts. Unlike costCentreId, valid on Contra lines too. */
  branchId?: string;
  /** Phase 8 Increment 2 (multi-currency) — all three of foreignCurrency/foreignAmount/exchangeRateMicros must be set together or not at all. See fx.ts. */
  foreignCurrency?: string;
  /** Minor units of foreignCurrency (e.g. USD cents). */
  foreignAmount?: number;
  /** Base-currency units per 1 foreign unit, scaled x1,000,000. */
  exchangeRateMicros?: number;
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

/** Phase 8 Increment 2 — a branch, or null/'__unassigned__' meaning "Head Office / Unassigned" (see branchBalanceSheet.ts's doc comment for why opening balances and untagged lines can't be attributed to any one branch). */
export interface BranchSummary {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  interBranchLedgerId: string;
  isActive: boolean;
}
