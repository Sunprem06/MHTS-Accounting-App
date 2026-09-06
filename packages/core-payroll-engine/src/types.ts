/** Closed lists, JS-validated — not DB CHECKs, same convention as voucher_type/party_type/order.status elsewhere in this codebase. */
export const EMPLOYMENT_TYPES = ['PERMANENT', 'FIXED_TERM', 'CONTRACTUAL', 'CONSULTANT'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const COMPONENT_TYPES = ['EARNING', 'DEDUCTION'] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const CALCULATION_TYPES = ['FLAT', 'PCT_OF_BASIC', 'PCT_OF_CTC'] as const;
export type CalculationType = (typeof CALCULATION_TYPES)[number];

export const APPLICABILITY_MODES = ['AUTO', 'ALWAYS', 'NEVER'] as const;
export type ApplicabilityMode = (typeof APPLICABILITY_MODES)[number];

export const TDS_REGIMES = ['NEW', 'OLD'] as const;
export type TdsRegime = (typeof TDS_REGIMES)[number];

export const LEAVE_APPLICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type LeaveApplicationStatus = (typeof LEAVE_APPLICATION_STATUSES)[number];

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const PAYROLL_RUN_STATUSES = ['DRAFT', 'PROCESSED', 'POSTED', 'CANCELLED'] as const;
export type PayrollRunStatus = (typeof PAYROLL_RUN_STATUSES)[number];

export const PAYSLIP_LINE_TYPES = ['EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION'] as const;
export type PayslipLineType = (typeof PAYSLIP_LINE_TYPES)[number];

export const GRATUITY_RECORD_STATUSES = ['DRAFT', 'SETTLED'] as const;
export type GratuityRecordStatus = (typeof GRATUITY_RECORD_STATUSES)[number];

/** RuleSet payload shapes (Blueprint §3.2) — owned by this package, resolved via @mhts/core-rules-engine's generic resolveEffectiveRule/createRuleSetVersion. Every numeric threshold here is data, never a hardcoded constant (CLAUDE.md Rule #2). */

export interface WageDefinitionCapPayload {
  /** The Labour Code's unified wages definition: allowances above this % of total pay get reclassified as wages for PF/ESI/gratuity/bonus purposes. 50 as of the Nov-2025 codes. */
  allowanceCapPctOfTotalPay: number;
}

export interface PfRulePayload {
  employeeRatePercent: number;
  employerRatePercent: number;
  /** Paise/month. PF is calculated on wages up to this ceiling, not the full wage. */
  wageCeiling: number;
  /** EPF Act: mandatory only once a company's headcount reaches this many employees. */
  applicabilityMinEmployees: number;
}

export interface EsiRulePayload {
  employeeRatePercent: number;
  employerRatePercent: number;
  /** Paise/month gross. Above this, ESI doesn't apply to that employee at all (not just capped). */
  wageCeiling: number;
  /** ESI Act: mandatory only once a company's headcount reaches this many employees. */
  applicabilityMinEmployees: number;
}

export interface PtSlabRow {
  /** Paise/month. Gross salary strictly above this and up to the next row's threshold falls in this slab. */
  aboveGrossThreshold: number;
  /** Paise/month, flat. */
  amount: number;
}

export interface PtRulePayload {
  /** Ascending by aboveGrossThreshold. State-specific — resolved by jurisdiction (state code), same as GST's place-of-supply-aware lookups. */
  slabs: PtSlabRow[];
}

export interface GratuityEligibilityPayload {
  minYearsPermanent: number;
  /** Nov-2025 Labour Code: fixed-term employees qualify sooner than permanent staff. */
  minYearsFixedTerm: number;
  /** Payment of Gratuity Act: mandatory only once a company's headcount reaches this many employees — and once it applies, it stays applicable even if headcount later falls (see applicability.ts). */
  applicabilityMinEmployees: number;
}

export interface TdsSlabRow {
  /** Paise/year. Income strictly above this and up to the next row's threshold is taxed at this row's rate. */
  aboveAnnualIncome: number;
  ratePercent: number;
}

export interface TdsSlabNewRegimePayload {
  /** Paise/year. */
  standardDeduction: number;
  /** Paise/year. Net taxable income at or below this pays zero tax (Section 87A rebate). */
  rebateThreshold: number;
  /** Ascending by aboveAnnualIncome. */
  slabs: TdsSlabRow[];
  /** e.g. 4 for a flat 4% health & education cess on the computed tax. */
  cessPercent: number;
}

export interface CreateOrUpdatePayrollRuleInput {
  ruleType: string;
  jurisdiction?: string | null;
  effectiveFrom: string;
  payload: unknown;
  sourceReference?: string;
}

export interface EmployeePayrollProfileInput {
  dateOfBirth?: string;
  dateOfJoining?: string;
  dateOfLeaving?: string;
  employmentType?: EmploymentType;
  pan?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  uan?: string;
  esiNumber?: string;
  pfVoluntaryOptOut?: boolean;
}

export interface EmployeePayrollProfileSummary {
  id: string;
  employeeCode: string;
  name: string;
  isActive: boolean;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  dateOfLeaving: string | null;
  employmentType: EmploymentType | null;
  pan: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  uan: string | null;
  esiNumber: string | null;
  pfVoluntaryOptOut: boolean;
  salaryPayableLedgerId: string | null;
}

export interface SalaryComponentDefinitionInput {
  name: string;
  componentType: ComponentType;
  calculationType: CalculationType;
  /** Paise. Required (and only meaningful) when calculationType = 'FLAT'. */
  flatAmountPaise?: number;
  /** e.g. 40 for 40%. Required when calculationType is PCT_OF_BASIC/PCT_OF_CTC. */
  percent?: number;
  isStatutoryWageBase: boolean;
  displayOrder?: number;
  expenseLedgerId?: string;
}

export interface SalaryComponentDefinitionSummary {
  id: string;
  name: string;
  componentType: ComponentType;
  calculationType: CalculationType;
  flatAmountPaise: number | null;
  percentBasisPoints: number | null;
  isStatutoryWageBase: boolean;
  displayOrder: number;
  expenseLedgerId: string | null;
  isActive: boolean;
}

export interface AssignSalaryStructureInput {
  employeeId: string;
  effectiveFrom: string;
  /** Paise/year. */
  annualCtc: number;
}

export interface SalaryStructureLineSummary {
  componentId: string;
  componentName: string;
  componentType: ComponentType;
  isStatutoryWageBase: boolean;
  /** Paise/month, as resolved by wage classification (may differ from the raw component formula once the 50% cap reclassifies an excess allowance — see wageClassification.ts). */
  monthlyAmount: number;
}

export interface SalaryStructureSummary {
  id: string;
  employeeId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  annualCtc: number;
  status: 'ACTIVE' | 'SUPERSEDED';
  lines: SalaryStructureLineSummary[];
  /** Paise/month. Sum of lines classified as statutory wage base AFTER the 50% cap reclassification — the base PF/ESI/gratuity actually use. */
  monthlyStatutoryWageBase: number;
}

export interface CompanyPayrollSettingsSummary {
  pfApplicability: ApplicabilityMode;
  esiApplicability: ApplicabilityMode;
  gratuityApplicability: ApplicabilityMode;
  ptJurisdiction: string | null;
  tdsRegime: TdsRegime;
}

export interface UpdateCompanyPayrollSettingsInput {
  pfApplicability?: ApplicabilityMode;
  esiApplicability?: ApplicabilityMode;
  gratuityApplicability?: ApplicabilityMode;
  ptJurisdiction?: string | null;
  tdsRegime?: TdsRegime;
}

export interface ResolvedApplicability {
  pfApplies: boolean;
  esiApplies: boolean;
  gratuityApplies: boolean;
  activeEmployeeCount: number;
  pfThreshold: number | null;
  esiThreshold: number | null;
  gratuityThreshold: number | null;
}

export interface LeaveTypeInput {
  name: string;
  isPaid: boolean;
  annualEntitlementDays: number;
}

export interface LeaveTypeSummary {
  id: string;
  name: string;
  isPaid: boolean;
  annualEntitlementDays: number;
  isActive: boolean;
}

export interface ApplyLeaveInput {
  employeeId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}

export interface LeaveApplicationSummary {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  days: number;
  status: LeaveApplicationStatus;
  reason: string | null;
}

export interface LeaveBalanceSummary {
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  financialYear: string;
  openingBalanceDays: number;
  accruedDays: number;
  availedDays: number;
  balanceDays: number;
}

export interface MarkAttendanceInput {
  employeeIds: string[];
  fromDate: string;
  toDate: string;
  status: Exclude<AttendanceStatus, 'ON_LEAVE'>;
}

export interface AttendanceRecordSummary {
  employeeId: string;
  attendanceDate: string;
  status: AttendanceStatus;
}

export interface CreatePayrollRunInput {
  periodMonth: number;
  periodYear: number;
  financialYear: string;
}

export interface PayslipLineSummary {
  lineType: PayslipLineType;
  label: string;
  componentId: string | null;
  /** Paise. */
  amount: number;
}

export interface PayslipSummary {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  paidDays: number;
  lopDays: number;
  grossEarnings: number;
  totalDeductions: number;
  employerContributions: number;
  netPay: number;
  lines: PayslipLineSummary[];
  outstandingAmount: number;
}

export interface PayrollRunSummary {
  id: string;
  financialYear: string;
  periodMonth: number;
  periodYear: number;
  status: PayrollRunStatus;
  voucherId: string | null;
  payslips: PayslipSummary[];
}

export interface DisbursePayslipInput {
  payslipId: string;
  paymentLedgerId: string;
  paymentDate: string;
  financialYear: string;
  narration?: string;
  /** Paise. Must not exceed the payslip's remaining outstanding amount. */
  amount: number;
}

export interface GratuityEligibilityResult {
  isEligible: boolean;
  reason: string;
  yearsOfServiceDays: number;
}

export interface RecordSeparationInput {
  employeeId: string;
  separationDate: string;
}

export interface GratuityRecordSummary {
  id: string;
  employeeId: string;
  employeeName: string;
  separationDate: string;
  isEligible: boolean;
  eligibilityReason: string;
  yearsOfServiceDays: number;
  formulaAmount: number;
  cumulativeProvisionAtSeparation: number;
  adjustmentAmount: number;
  status: GratuityRecordStatus;
  settlementVoucherId: string | null;
}

export interface SettleGratuityInput {
  gratuityRecordId: string;
  paymentLedgerId: string;
  paymentDate: string;
  financialYear: string;
  narration?: string;
}
