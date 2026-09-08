import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import {
  createEmployee as coreCreateEmployee,
  listEmployees as coreListEmployees,
  createExpenseClaim as coreCreateExpenseClaim,
  listExpenseClaims as coreListExpenseClaims,
  submitExpenseClaim as coreSubmitExpenseClaim,
  approveExpenseClaim as coreApproveExpenseClaim,
  rejectExpenseClaim as coreRejectExpenseClaim,
  cancelExpenseClaim as coreCancelExpenseClaim,
  listOutstandingReimbursements as coreListOutstandingReimbursements,
  reimburseExpenseClaim as coreReimburseExpenseClaim,
} from '@mhts/core-expense';
import { computeFinancialYearLabel } from '@mhts/core-accounting';
import { requireSessionWithCompanyDb } from './session';
import type {
  CreateEmployeeInput,
  CreateExpenseClaimInput,
  EmployeeSummary,
  ExpenseClaimSummary,
  OutstandingReimbursementRow,
  RejectExpenseClaimInput,
  ReimburseExpenseClaimInput,
} from '../shared/ipc';

const PAISE_PER_RUPEE = 100;
const rupeesToPaise = (rupees: number): number => Math.round(rupees * PAISE_PER_RUPEE);
const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;

async function financialYearStartMonth(systemDb: Kysely<SystemDatabase>, companyId: string): Promise<number> {
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', companyId).executeTakeFirstOrThrow();
  return company.financial_year_start_month;
}

export async function listEmployees(): Promise<EmployeeSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('EXPENSE.MANAGE_EMPLOYEES');
  const employees = await coreListEmployees(companyDb);
  return employees.map((employee) => ({ ...employee, outstandingBalance: paiseToRupees(employee.outstandingBalance) }));
}

export async function createEmployee(input: CreateEmployeeInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('EXPENSE.MANAGE_EMPLOYEES');
  return coreCreateEmployee(companyDb, input, info.userId);
}

function toIpcClaimSummary(claim: Awaited<ReturnType<typeof coreListExpenseClaims>>[number]): ExpenseClaimSummary {
  return {
    ...claim,
    totalAmount: paiseToRupees(claim.totalAmount),
    lines: claim.lines.map((line) => ({ ...line, amount: paiseToRupees(line.amount) })),
  };
}

export async function listExpenseClaims(): Promise<ExpenseClaimSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('EXPENSE.VIEW_REPORTS');
  const claims = await coreListExpenseClaims(companyDb);
  return claims.map(toIpcClaimSummary);
}

export async function createExpenseClaim(systemDb: Kysely<SystemDatabase>, input: CreateExpenseClaimInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('EXPENSE.CREATE_CLAIM');

  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(input.claimDate));

  return coreCreateExpenseClaim(
    companyDb,
    {
      employeeId: input.employeeId,
      financialYear,
      claimDate: input.claimDate,
      purpose: input.purpose,
      lines: input.lines.map((line) => ({
        expenseLedgerId: line.expenseLedgerId,
        description: line.description,
        expenseDate: line.expenseDate,
        amount: rupeesToPaise(line.amountRupees),
        lineNarration: line.lineNarration,
      })),
    },
    info.userId,
  );
}

export async function submitExpenseClaim(expenseClaimId: string): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('EXPENSE.CREATE_CLAIM');
  await coreSubmitExpenseClaim(companyDb, expenseClaimId, info.userId);
}

export async function approveExpenseClaim(systemDb: Kysely<SystemDatabase>, expenseClaimId: string): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('EXPENSE.APPROVE_CLAIM');

  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const approvalDate = new Date().toISOString().slice(0, 10);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(approvalDate));

  return coreApproveExpenseClaim(companyDb, expenseClaimId, approvalDate, financialYear, info.userId);
}

export async function rejectExpenseClaim(input: RejectExpenseClaimInput): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('EXPENSE.APPROVE_CLAIM');
  await coreRejectExpenseClaim(companyDb, input.expenseClaimId, input.reason, info.userId);
}

export async function cancelExpenseClaim(systemDb: Kysely<SystemDatabase>, expenseClaimId: string): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('EXPENSE.APPROVE_CLAIM');

  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const reversalDate = new Date().toISOString().slice(0, 10);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(reversalDate));

  await coreCancelExpenseClaim(companyDb, expenseClaimId, financialYear, reversalDate, info.userId);
}

export async function reimburseExpenseClaim(systemDb: Kysely<SystemDatabase>, input: ReimburseExpenseClaimInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('EXPENSE.REIMBURSE_CLAIM');
  if (input.instrument && !info.permissions.includes('BANKING.RECORD_PAYMENT_INSTRUMENT')) {
    throw new Error('You do not have permission (BANKING.RECORD_PAYMENT_INSTRUMENT) for this action');
  }

  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(input.paymentDate));

  return coreReimburseExpenseClaim(
    companyDb,
    {
      expenseClaimId: input.expenseClaimId,
      paymentLedgerId: input.paymentLedgerId,
      paymentDate: input.paymentDate,
      financialYear,
      narration: input.narration,
      amount: rupeesToPaise(input.amountRupees),
      instrument: input.instrument,
    },
    info.userId,
  );
}

export async function listOutstandingReimbursements(employeeId?: string): Promise<OutstandingReimbursementRow[]> {
  const { companyDb } = requireSessionWithCompanyDb('EXPENSE.VIEW_REPORTS');
  const rows = await coreListOutstandingReimbursements(companyDb, employeeId);
  return rows.map((row) => ({ ...row, netAmount: paiseToRupees(row.netAmount), settledAmount: paiseToRupees(row.settledAmount), outstandingAmount: paiseToRupees(row.outstandingAmount) }));
}
