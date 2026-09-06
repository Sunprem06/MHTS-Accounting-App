// Phase 6 (Expenses, Travel, Documents): employees, expense claim lifecycle,
// reimbursement. Pure TypeScript, zero Electron/UI dependency (Rule #1) —
// enforced by Nx module boundaries.
export { EXPENSE_CLAIM_STATUSES } from './types';
export type {
  ExpenseClaimStatus,
  EmployeeSummary,
  CreateEmployeeInput,
  ExpenseClaimLineInput,
  CreateExpenseClaimInput,
  ExpenseClaimLineSummary,
  ExpenseClaimSummary,
  OutstandingReimbursementRow,
  ReimburseExpenseClaimInput,
} from './types';

export { EXPENSE_PERMISSIONS, grantExpensePermissions } from './permissions';
export { EMPLOYEE_REIMBURSEMENTS_GROUP, seedExpenseLedgers } from './seedLedgers';
export { createEmployee, listEmployees } from './employees';
export { createExpenseClaim, listExpenseClaims, submitExpenseClaim, rejectExpenseClaim, approveExpenseClaim, cancelExpenseClaim } from './claims';
export { listOutstandingReimbursements, reimburseExpenseClaim } from './settlements';
