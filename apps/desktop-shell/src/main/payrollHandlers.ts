import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import {
  listEmployeePayrollProfiles as coreListEmployeePayrollProfiles,
  updateEmployeePayrollProfile as coreUpdateEmployeePayrollProfile,
  createSalaryComponentDefinition as coreCreateSalaryComponentDefinition,
  listSalaryComponentDefinitions as coreListSalaryComponentDefinitions,
  assignSalaryStructure as coreAssignSalaryStructure,
  listSalaryStructuresForEmployee as coreListSalaryStructuresForEmployee,
  getCompanyPayrollSettings as coreGetCompanyPayrollSettings,
  updateCompanyPayrollSettings as coreUpdateCompanyPayrollSettings,
  resolveApplicability,
  resolveWageDefinitionCap,
  createOrUpdatePayrollRule as coreCreateOrUpdatePayrollRule,
  listActivePayrollRules as coreListActivePayrollRules,
  listPayrollRuleVersions as coreListPayrollRuleVersions,
  createLeaveType as coreCreateLeaveType,
  listLeaveTypes as coreListLeaveTypes,
  applyLeave as coreApplyLeave,
  listLeaveApplications as coreListLeaveApplications,
  approveLeave as coreApproveLeave,
  rejectLeave as coreRejectLeave,
  listLeaveBalances as coreListLeaveBalances,
  markAttendance as coreMarkAttendance,
  listAttendanceForEmployee as coreListAttendanceForEmployee,
  createPayrollRun as coreCreatePayrollRun,
  processPayrollRun as coreProcessPayrollRun,
  overridePayslipTdsAmount as coreOverridePayslipTdsAmount,
  getPayrollRun as coreGetPayrollRun,
  listPayrollRuns as coreListPayrollRuns,
  postPayrollRun as corePostPayrollRun,
  disbursePayslip as coreDisbursePayslip,
  runGratuityProvisioning as coreRunGratuityProvisioning,
  recordSeparation as coreRecordSeparation,
  settleGratuity as coreSettleGratuity,
  listGratuityRecords as coreListGratuityRecords,
} from '@mhts/core-payroll-engine';
import type { PayrollRunSummary, PayslipSummary } from '@mhts/core-payroll-engine';
import { computeFinancialYearLabel } from '@mhts/core-accounting';
import { session } from './session';
import type {
  AssignSalaryStructureInput,
  ApplyLeaveInput,
  CompanyPayrollSettingsSummary,
  CreateOrUpdatePayrollRuleInput,
  CreatePayrollRunInput,
  DisbursePayslipInput,
  EmployeePayrollProfileSummary,
  GratuityRecordSummary,
  LeaveApplicationSummary,
  LeaveBalanceSummary,
  LeaveTypeInput,
  LeaveTypeSummary,
  ListAttendanceForEmployeeInput,
  MarkAttendanceInput,
  OverridePayslipTdsInput,
  PayrollRuleVersionSummary,
  PayrollRunSummary as IpcPayrollRunSummary,
  PayslipSummary as IpcPayslipSummary,
  RecordSeparationInput,
  RejectLeaveInput,
  RunGratuityProvisioningInput,
  SalaryComponentDefinitionInput,
  SalaryComponentDefinitionSummary,
  SalaryStructureSummary,
  SettleGratuityInput,
  UpdateCompanyPayrollSettingsInput,
  UpdateEmployeePayrollProfileInput,
} from '../shared/ipc';

const PAISE_PER_RUPEE = 100;
const rupeesToPaise = (rupees: number): number => Math.round(rupees * PAISE_PER_RUPEE);
const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;
const tenthsToDays = (tenths: number): number => tenths / 10;

function requireSessionWithCompanyDb(requiredPermission: string) {
  const info = session.get();
  const companyDb = session.getCompanyDb();
  if (!info || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!info.permissions.includes(requiredPermission)) {
    throw new Error(`You do not have permission (${requiredPermission}) for this action`);
  }
  return { info, companyDb };
}

async function financialYearStartMonth(systemDb: Kysely<SystemDatabase>, companyId: string): Promise<number> {
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', companyId).executeTakeFirstOrThrow();
  return company.financial_year_start_month;
}

function toIpcPayslip(payslip: PayslipSummary): IpcPayslipSummary {
  return {
    ...payslip,
    paidDays: tenthsToDays(payslip.paidDays),
    lopDays: tenthsToDays(payslip.lopDays),
    grossEarnings: paiseToRupees(payslip.grossEarnings),
    totalDeductions: paiseToRupees(payslip.totalDeductions),
    employerContributions: paiseToRupees(payslip.employerContributions),
    netPay: paiseToRupees(payslip.netPay),
    outstandingAmount: paiseToRupees(payslip.outstandingAmount),
    lines: payslip.lines.map((line) => ({ ...line, amount: paiseToRupees(line.amount) })),
  };
}

function toIpcPayrollRun(run: PayrollRunSummary): IpcPayrollRunSummary {
  return { ...run, payslips: run.payslips.map(toIpcPayslip) };
}

export async function listEmployeePayrollProfiles(): Promise<EmployeePayrollProfileSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_EMPLOYEE_PROFILE');
  return coreListEmployeePayrollProfiles(companyDb);
}

export async function updateEmployeePayrollProfile(input: UpdateEmployeePayrollProfileInput): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_EMPLOYEE_PROFILE');
  const { employeeId, ...profile } = input;
  await coreUpdateEmployeePayrollProfile(companyDb, employeeId, profile, info.userId);
}

export async function createSalaryComponent(input: SalaryComponentDefinitionInput): Promise<string> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_SALARY_STRUCTURE');
  return coreCreateSalaryComponentDefinition(companyDb, {
    name: input.name,
    componentType: input.componentType,
    calculationType: input.calculationType,
    flatAmountPaise: input.flatAmountRupees !== undefined ? rupeesToPaise(input.flatAmountRupees) : undefined,
    percent: input.percent,
    isStatutoryWageBase: input.isStatutoryWageBase,
    displayOrder: input.displayOrder,
    expenseLedgerId: input.expenseLedgerId,
  });
}

export async function listSalaryComponents(): Promise<SalaryComponentDefinitionSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_SALARY_STRUCTURE');
  const rows = await coreListSalaryComponentDefinitions(companyDb);
  return rows.map((row) => ({
    ...row,
    flatAmountRupees: row.flatAmountPaise !== null ? paiseToRupees(row.flatAmountPaise) : null,
    percent: row.percentBasisPoints !== null ? row.percentBasisPoints / 100 : null,
  }));
}

export async function assignSalaryStructure(input: AssignSalaryStructureInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_SALARY_STRUCTURE');
  return coreAssignSalaryStructure(companyDb, { employeeId: input.employeeId, effectiveFrom: input.effectiveFrom, annualCtc: rupeesToPaise(input.annualCtcRupees) }, info.userId);
}

export async function listSalaryStructuresForEmployee(systemDb: Kysely<SystemDatabase>, employeeId: string): Promise<SalaryStructureSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_SALARY_STRUCTURE');
  const today = new Date().toISOString().slice(0, 10);
  const wageCap = await resolveWageDefinitionCap(systemDb, today);
  const rows = await coreListSalaryStructuresForEmployee(companyDb, employeeId, wageCap);
  return rows.map((row) => ({
    ...row,
    annualCtc: paiseToRupees(row.annualCtc),
    monthlyStatutoryWageBase: paiseToRupees(row.monthlyStatutoryWageBase),
    lines: row.lines.map((line) => ({ ...line, monthlyAmount: paiseToRupees(line.monthlyAmount) })),
  }));
}

export async function getCompanyPayrollSettings(systemDb: Kysely<SystemDatabase>): Promise<CompanyPayrollSettingsSummary> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_RULES');
  const settings = await coreGetCompanyPayrollSettings(companyDb);
  const today = new Date().toISOString().slice(0, 10);
  const resolvedApplicability = await resolveApplicability(companyDb, systemDb, today);
  return { ...settings, resolvedApplicability };
}

export async function updateCompanyPayrollSettings(input: UpdateCompanyPayrollSettingsInput): Promise<void> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_RULES');
  await coreUpdateCompanyPayrollSettings(companyDb, input);
}

export async function createOrUpdatePayrollRule(systemDb: Kysely<SystemDatabase>, input: CreateOrUpdatePayrollRuleInput): Promise<string> {
  const { info } = requireSessionWithCompanyDb('PAYROLL.MANAGE_RULES');
  return coreCreateOrUpdatePayrollRule(systemDb, input, info.userId);
}

export async function listActivePayrollRules(systemDb: Kysely<SystemDatabase>): Promise<PayrollRuleVersionSummary[]> {
  requireSessionWithCompanyDb('PAYROLL.MANAGE_RULES');
  return coreListActivePayrollRules(systemDb);
}

export async function listPayrollRuleVersions(systemDb: Kysely<SystemDatabase>, ruleType: string): Promise<PayrollRuleVersionSummary[]> {
  requireSessionWithCompanyDb('PAYROLL.MANAGE_RULES');
  return coreListPayrollRuleVersions(systemDb, ruleType);
}

export async function createLeaveType(input: LeaveTypeInput): Promise<string> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_ATTENDANCE');
  return coreCreateLeaveType(companyDb, input);
}

export async function listLeaveTypes(): Promise<LeaveTypeSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.APPLY_LEAVE');
  return coreListLeaveTypes(companyDb);
}

export async function applyLeave(input: ApplyLeaveInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.APPLY_LEAVE');
  return coreApplyLeave(companyDb, input, info.userId);
}

export async function listLeaveApplications(employeeId?: string): Promise<LeaveApplicationSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.APPLY_LEAVE');
  return coreListLeaveApplications(companyDb, employeeId);
}

export async function approveLeave(systemDb: Kysely<SystemDatabase>, leaveApplicationId: string): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.APPROVE_LEAVE');
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date());
  await coreApproveLeave(companyDb, leaveApplicationId, financialYear, info.userId);
}

export async function rejectLeave(input: RejectLeaveInput): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.APPROVE_LEAVE');
  await coreRejectLeave(companyDb, input.leaveApplicationId, input.reason, info.userId);
}

export async function listLeaveBalances(systemDb: Kysely<SystemDatabase>, employeeId: string): Promise<LeaveBalanceSummary[]> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.APPLY_LEAVE');
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date());
  return coreListLeaveBalances(companyDb, employeeId, financialYear);
}

export async function markAttendance(input: MarkAttendanceInput): Promise<void> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_ATTENDANCE');
  await coreMarkAttendance(companyDb, input);
}

export async function listAttendanceForEmployee(input: ListAttendanceForEmployeeInput) {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_ATTENDANCE');
  return coreListAttendanceForEmployee(companyDb, input.employeeId, input.periodYear, input.periodMonth);
}

export async function createPayrollRun(systemDb: Kysely<SystemDatabase>, input: CreatePayrollRunInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.RUN_PAYROLL');
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const periodDate = new Date(Date.UTC(input.periodYear, input.periodMonth - 1, 1));
  const financialYear = computeFinancialYearLabel(startMonth, periodDate);
  return coreCreatePayrollRun(companyDb, { periodMonth: input.periodMonth, periodYear: input.periodYear, financialYear }, info.userId);
}

export async function processPayrollRun(systemDb: Kysely<SystemDatabase>, payrollRunId: string): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.RUN_PAYROLL');
  await coreProcessPayrollRun(companyDb, systemDb, payrollRunId, info.userId);
}

export async function overridePayslipTds(input: OverridePayslipTdsInput): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.RUN_PAYROLL');
  await coreOverridePayslipTdsAmount(companyDb, input.payslipId, rupeesToPaise(input.amountRupees), info.userId);
}

export async function getPayrollRun(payrollRunId: string): Promise<IpcPayrollRunSummary> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.VIEW_REPORTS');
  const run = await coreGetPayrollRun(companyDb, payrollRunId);
  return toIpcPayrollRun(run);
}

export async function listPayrollRuns(): Promise<IpcPayrollRunSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.VIEW_REPORTS');
  const runs = await coreListPayrollRuns(companyDb);
  return runs.map(toIpcPayrollRun);
}

export async function postPayrollRun(payrollRunId: string): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.RUN_PAYROLL');
  const voucherDate = new Date().toISOString().slice(0, 10);
  return corePostPayrollRun(companyDb, payrollRunId, voucherDate, info.userId);
}

export async function disbursePayslip(systemDb: Kysely<SystemDatabase>, input: DisbursePayslipInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.DISBURSE_SALARY');
  if (input.instrument && !info.permissions.includes('BANKING.RECORD_PAYMENT_INSTRUMENT')) {
    throw new Error('You do not have permission (BANKING.RECORD_PAYMENT_INSTRUMENT) for this action');
  }
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(input.paymentDate));

  return coreDisbursePayslip(
    companyDb,
    { payslipId: input.payslipId, paymentLedgerId: input.paymentLedgerId, paymentDate: input.paymentDate, financialYear, narration: input.narration, amount: rupeesToPaise(input.amountRupees) },
    info.userId,
    input.instrument,
  );
}

export async function runGratuityProvisioning(systemDb: Kysely<SystemDatabase>, input: RunGratuityProvisioningInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_GRATUITY');
  return coreRunGratuityProvisioning(companyDb, systemDb, input.periodYear, input.periodMonth, info.userId);
}

export async function recordSeparation(systemDb: Kysely<SystemDatabase>, input: RecordSeparationInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_GRATUITY');
  return coreRecordSeparation(companyDb, systemDb, input, info.userId);
}

export async function settleGratuity(systemDb: Kysely<SystemDatabase>, input: SettleGratuityInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('PAYROLL.MANAGE_GRATUITY');
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(input.paymentDate));
  return coreSettleGratuity(companyDb, { ...input, financialYear }, info.userId);
}

export async function listGratuityRecords(): Promise<GratuityRecordSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('PAYROLL.VIEW_REPORTS');
  const rows = await coreListGratuityRecords(companyDb);
  return rows.map((row) => ({ ...row, formulaAmount: paiseToRupees(row.formulaAmount), cumulativeProvisionAtSeparation: paiseToRupees(row.cumulativeProvisionAtSeparation), adjustmentAmount: paiseToRupees(row.adjustmentAmount) }));
}
