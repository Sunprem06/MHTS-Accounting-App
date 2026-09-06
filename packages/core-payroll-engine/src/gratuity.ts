import type { EmploymentType, GratuityEligibilityPayload, GratuityEligibilityResult } from './types';

const DAYS_PER_YEAR = 365;
/** "Service, and part thereof in excess of six months" counts as a full year under the Payment of Gratuity Act — this is the actual statutory rounding rule, not an arbitrary simplification. */
const HALF_YEAR_DAYS = Math.floor(DAYS_PER_YEAR / 2);

export function computeYearsOfServiceDays(dateOfJoining: string, asOfDate: string): number {
  const joined = new Date(`${dateOfJoining}T00:00:00Z`).getTime();
  const asOf = new Date(`${asOfDate}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((asOf - joined) / (1000 * 60 * 60 * 24)));
}

function roundedYearsOfService(yearsOfServiceDays: number): number {
  const wholeYears = Math.floor(yearsOfServiceDays / DAYS_PER_YEAR);
  const remainderDays = yearsOfServiceDays - wholeYears * DAYS_PER_YEAR;
  return remainderDays > HALF_YEAR_DAYS ? wholeYears + 1 : wholeYears;
}

/**
 * Eligibility per Blueprint §3.2: fixed-term employees qualify after
 * minYearsFixedTerm (1 year under the Nov-2025 Labour Code) instead of
 * minYearsPermanent (5 years) — both RuleSet-driven, never hardcoded here
 * (rules.ts's resolveGratuityEligibilityRule). Consultants are treated as
 * never eligible — they are not "employees" for Gratuity Act purposes, a
 * deliberate simplification flagged in the reason string rather than
 * silently applying the permanent-employee threshold to them.
 */
export function computeGratuityEligibility(
  employmentType: EmploymentType | null,
  yearsOfServiceDays: number,
  rule: GratuityEligibilityPayload,
  companyApplicability: boolean,
): GratuityEligibilityResult {
  if (!companyApplicability) {
    return { isEligible: false, reason: "Company has not crossed the Payment of Gratuity Act's employee-count threshold", yearsOfServiceDays };
  }
  if (employmentType === 'CONSULTANT') {
    return { isEligible: false, reason: 'Consultants are not employees for Payment of Gratuity Act purposes', yearsOfServiceDays };
  }
  if (!employmentType) {
    return { isEligible: false, reason: 'Employment type not set on employee profile', yearsOfServiceDays };
  }

  const minYears = employmentType === 'FIXED_TERM' ? rule.minYearsFixedTerm : rule.minYearsPermanent;
  const years = roundedYearsOfService(yearsOfServiceDays);
  if (years < minYears) {
    return { isEligible: false, reason: `${years} year(s) of service is below the ${minYears}-year minimum for a ${employmentType.toLowerCase()} employee`, yearsOfServiceDays };
  }
  return { isEligible: true, reason: `${years} year(s) of service meets the ${minYears}-year minimum for a ${employmentType.toLowerCase()} employee`, yearsOfServiceDays };
}

/**
 * Standard statutory formula: (15/26) x last-drawn monthly wage base x
 * rounded years of service. This is a formula estimate, NOT an actuarial
 * (AS-15/Ind AS-19) valuation — flagged wherever this is surfaced in the UI,
 * same disclaimer discipline the GST engine uses for its set-off algorithm.
 */
export function computeGratuityFormulaAmount(lastDrawnMonthlyWageBase: number, yearsOfServiceDays: number): number {
  const years = roundedYearsOfService(yearsOfServiceDays);
  return Math.round(((15 / 26) * lastDrawnMonthlyWageBase * years));
}

/** This month's provisioning increment: the gap between the current formula amount (as tenure/wage grow) and what's already been provisioned — never negative (a provision only builds up monthly; any true reduction happens explicitly at separation settlement, not via a negative monthly entry). */
export function computeMonthlyProvisionIncrement(isEligible: boolean, lastDrawnMonthlyWageBase: number, yearsOfServiceDays: number, cumulativeProvisionSoFar: number): number {
  if (!isEligible) {
    return 0;
  }
  const currentFormulaAmount = computeGratuityFormulaAmount(lastDrawnMonthlyWageBase, yearsOfServiceDays);
  return Math.max(0, currentFormulaAmount - cumulativeProvisionSoFar);
}
