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
export { createVoucher } from './vouchers';
export { computeTrialBalance } from './trialBalance';
export { computeFinancialYearLabel } from './financialYear';
