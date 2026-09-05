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
export { createVoucher, listVouchers, cancelVoucher } from './vouchers';
export { computeTrialBalance } from './trialBalance';
export { computeProfitAndLoss } from './profitAndLoss';
export type { ProfitAndLossOptions } from './profitAndLoss';
export { computeBalanceSheet } from './balanceSheet';
export { computeFinancialYearLabel } from './financialYear';
