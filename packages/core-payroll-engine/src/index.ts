// Phase 7 (Payroll): CTC, salary structure engine, attendance, leave,
// statutory deductions (PF/ESI/PT/salary TDS), gratuity, and payslips.
// Wage classification and statutory formulas come from core-rules-engine's
// RuleSet resolution service (Rule #2) — never a hardcoded constant like "50%".

export {
  EMPLOYMENT_TYPES,
  COMPONENT_TYPES,
  CALCULATION_TYPES,
  APPLICABILITY_MODES,
  TDS_REGIMES,
  LEAVE_APPLICATION_STATUSES,
  ATTENDANCE_STATUSES,
  PAYROLL_RUN_STATUSES,
  PAYSLIP_LINE_TYPES,
  GRATUITY_RECORD_STATUSES,
} from './types';
export type {
  EmploymentType,
  ComponentType,
  CalculationType,
  ApplicabilityMode,
  TdsRegime,
  LeaveApplicationStatus,
  AttendanceStatus,
  PayrollRunStatus,
  PayslipLineType,
  GratuityRecordStatus,
  WageDefinitionCapPayload,
  PfRulePayload,
  EsiRulePayload,
  PtRulePayload,
  PtSlabRow,
  GratuityEligibilityPayload,
  TdsSlabNewRegimePayload,
  TdsSlabRow,
  CreateOrUpdatePayrollRuleInput,
  EmployeePayrollProfileInput,
  EmployeePayrollProfileSummary,
  SalaryComponentDefinitionInput,
  SalaryComponentDefinitionSummary,
  AssignSalaryStructureInput,
  SalaryStructureLineSummary,
  SalaryStructureSummary,
  CompanyPayrollSettingsSummary,
  UpdateCompanyPayrollSettingsInput,
  ResolvedApplicability,
  LeaveTypeInput,
  LeaveTypeSummary,
  ApplyLeaveInput,
  LeaveApplicationSummary,
  LeaveBalanceSummary,
  MarkAttendanceInput,
  AttendanceRecordSummary,
  CreatePayrollRunInput,
  PayslipLineSummary,
  PayslipSummary,
  PayslipForPrint,
  PayslipListItemForPrint,
  PayrollRunSummary,
  DisbursePayslipInput,
  GratuityEligibilityResult,
  RecordSeparationInput,
  GratuityRecordSummary,
  SettleGratuityInput,
} from './types';

export { PAYROLL_PERMISSIONS, grantPayrollPermissions } from './permissions';

export { seedPayrollLedgers, getPayrollLedgerIds, ensureEmployeeSalaryPayableLedger } from './ledgers';
export type { PayrollLedgerIds } from './ledgers';

export {
  PAYROLL_RULE_TYPES,
  seedDefaultPayrollRules,
  resolveWageDefinitionCap,
  resolvePfRule,
  resolveEsiRule,
  resolvePtRule,
  resolveGratuityEligibilityRule,
  resolveTdsSlabNewRegime,
  createOrUpdatePayrollRule,
  listPayrollRuleVersions,
  listActivePayrollRules,
} from './rules';
export type { PayrollRuleVersionSummary } from './rules';

export { seedDefaultCompanyPayrollSettings, getCompanyPayrollSettings, updateCompanyPayrollSettings } from './companySettings';

export { resolveApplicability } from './applicability';

export { computeStatutoryWageBase } from './wageClassification';
export type { WageClassificationLine, WageClassificationResult } from './wageClassification';

export { computePf } from './pf';
export type { PfComputationResult } from './pf';

export { computeEsi } from './esi';
export type { EsiComputationResult, ComputeEsiOptions } from './esi';
export { contributionPeriodBounds, wasEsiApplicableEarlierInContributionPeriod } from './esiContributionPeriod';
export type { ContributionPeriodBounds } from './esiContributionPeriod';

export { computePt } from './pt';

export { computeAnnualTaxNewRegime, computeMonthlyTdsNewRegime } from './salaryTds';

export { computeYearsOfServiceDays, computeGratuityEligibility, computeGratuityFormulaAmount, computeMonthlyProvisionIncrement } from './gratuity';

export { listEmployeePayrollProfiles, updateEmployeePayrollProfile, countActiveEmployees } from './employees';

export { createSalaryComponentDefinition, listSalaryComponentDefinitions } from './salaryComponents';

export { assignSalaryStructure, getActiveSalaryStructure, listSalaryStructuresForEmployee } from './salaryStructure';

export { createLeaveType, listLeaveTypes, applyLeave, listLeaveApplications, approveLeave, rejectLeave, listLeaveBalances } from './leave';

export { markAttendance, listAttendanceForEmployee, computeAttendanceSummary } from './attendance';
export type { AttendanceSummary } from './attendance';

export { createPayrollRun, processPayrollRun, overridePayslipTdsAmount, getPayrollRun, listPayrollRuns, postPayrollRun, disbursePayslip, getPayslipForPrint, listPayslipsForPrint } from './payrollRun';

export { runGratuityProvisioning, recordSeparation, settleGratuity, listGratuityRecords } from './gratuityRecords';
