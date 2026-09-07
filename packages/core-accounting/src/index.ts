// Phase 1 (Accounting Core): chart of accounts, ledgers, vouchers, double-entry, TB/P&L/BS.
// Pure TypeScript, zero Electron/UI dependency (Rule #1) — enforced by Nx module boundaries.
export { ACCOUNT_NATURES, BALANCE_SIDES, VOUCHER_TYPES } from './types';
export type {
  AccountNature,
  BalanceSide,
  VoucherType,
  AccountGroupSummary,
  LedgerAccountSummary,
  VoucherLineInput,
  CreateVoucherInput,
  TrialBalanceRow,
  TrialBalance,
  ProfitAndLossRow,
  ProfitAndLoss,
  BalanceSheetRow,
  BalanceSheet,
  VoucherSummary,
} from './types';
export {
  ACCOUNTING_PERMISSIONS,
  grantAccountingPermissions,
  seedChartOfAccounts,
  listAccountGroups,
  listLedgerAccounts,
  createLedgerAccount,
} from './chartOfAccounts';
export type { CreateLedgerAccountInput } from './chartOfAccounts';
export { createVoucher, createVoucherInTransaction, listVouchers, cancelVoucher, cancelVoucherInTransaction } from './vouchers';
export { computeTrialBalance } from './trialBalance';
export { computeProfitAndLoss } from './profitAndLoss';
export type { ProfitAndLossOptions } from './profitAndLoss';
export { computeBalanceSheet } from './balanceSheet';
export { computeFinancialYearLabel, computeFinancialYearDateBounds } from './financialYear';
export { computeLedgerBalances } from './ledgerBalances';
export type { LedgerBalanceRow, LedgerBalanceOptions } from './ledgerBalances';
export { createCostCentre, listCostCentres, updateCostCentre } from './costCentres';
export type { CostCentreSummary, CreateCostCentreInput, UpdateCostCentreInput } from './costCentres';
export { computeCostCentreSummary } from './costCentreReport';
export type { CostCentreSummaryRow } from './costCentreReport';
export { createBudget, listBudgets, updateBudgetLine, splitAnnualBudgetEvenly } from './budgets';
export type { BudgetLineInput, CreateBudgetInput, BudgetSummary } from './budgets';
export { computeBudgetVsActual } from './budgetVsActual';
export type { BudgetVsActualRow } from './budgetVsActual';
