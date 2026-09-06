import type { PaymentInstrumentInput } from '@mhts/core-banking';

/** Closed list, JS-validated (core-expense) — not a DB CHECK, same convention as voucher_type/party_type/order.status. */
export const EXPENSE_CLAIM_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED', 'CANCELLED'] as const;
export type ExpenseClaimStatus = (typeof EXPENSE_CLAIM_STATUSES)[number];

export interface EmployeeSummary {
  id: string;
  employeeCode: string;
  name: string;
  department: string | null;
  ledgerAccountId: string;
  isActive: boolean;
  /** Paise. Current amount owed to this employee (their ledger's credit-positive balance). */
  outstandingBalance: number;
}

export interface CreateEmployeeInput {
  employeeCode: string;
  name: string;
  department?: string;
}

export interface ExpenseClaimLineInput {
  expenseLedgerId: string;
  description: string;
  expenseDate: string;
  /** Paise. */
  amount: number;
  lineNarration?: string;
}

export interface CreateExpenseClaimInput {
  employeeId: string;
  financialYear: string;
  claimDate: string;
  purpose?: string;
  lines: ExpenseClaimLineInput[];
}

export interface ExpenseClaimLineSummary {
  id: string;
  expenseLedgerId: string;
  expenseLedgerName: string;
  description: string;
  expenseDate: string;
  amount: number;
  lineNarration: string | null;
}

export interface ExpenseClaimSummary {
  id: string;
  employeeId: string;
  employeeName: string;
  financialYear: string;
  claimNumber: number;
  claimDate: string;
  purpose: string | null;
  status: ExpenseClaimStatus;
  voucherId: string | null;
  rejectedReason: string | null;
  /** Paise. Sum of the claim's lines. */
  totalAmount: number;
  lines: ExpenseClaimLineSummary[];
}

export interface OutstandingReimbursementRow {
  expenseClaimId: string;
  voucherId: string;
  voucherNumber: number;
  claimDate: string;
  employeeId: string;
  employeeName: string;
  /** Paise. The claim's total accrued amount. */
  netAmount: number;
  /** Paise. Sum of prior settlements against non-cancelled vouchers. */
  settledAmount: number;
  /** Paise. netAmount - settledAmount. Only claims with outstandingAmount > 0 are returned. */
  outstandingAmount: number;
}

export interface ReimburseExpenseClaimInput {
  expenseClaimId: string;
  /** Cash/Bank ledger the money leaves from. */
  paymentLedgerId: string;
  paymentDate: string;
  financialYear: string;
  narration?: string;
  /** Paise. Must not exceed the claim's current outstanding amount. */
  amount: number;
  instrument?: PaymentInstrumentInput;
}
