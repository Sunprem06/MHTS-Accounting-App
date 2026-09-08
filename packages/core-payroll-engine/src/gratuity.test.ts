import { describe, expect, it } from 'vitest';
import { computeGratuityEligibility, computeGratuityFormulaAmount, computeMonthlyProvisionIncrement, computeYearsOfServiceDays } from './gratuity';

const RULE = { minYearsPermanent: 5, minYearsFixedTerm: 1, applicabilityMinEmployees: 10 };

describe('core-payroll-engine: gratuity eligibility (Payment of Gratuity Act + Nov-2025 Labour Code fixed-term provision)', () => {
  it('company not yet crossing the headcount threshold: nobody is eligible, regardless of tenure', () => {
    const result = computeGratuityEligibility('PERMANENT', 365 * 10, RULE, false);
    expect(result.isEligible).toBe(false);
    expect(result.reason).toMatch(/employee-count threshold/);
  });

  it('a fixed-term employee at 400 days (>1 year) is eligible', () => {
    const result = computeGratuityEligibility('FIXED_TERM', 400, RULE, true);
    expect(result.isEligible).toBe(true);
  });

  it('a permanent employee at the SAME 400-day tenure is NOT eligible (needs 5 years, not 1)', () => {
    const result = computeGratuityEligibility('PERMANENT', 400, RULE, true);
    expect(result.isEligible).toBe(false);
    expect(result.reason).toMatch(/5-year minimum/);
  });

  it('a permanent employee at exactly 5 years (1825 days) is eligible', () => {
    const result = computeGratuityEligibility('PERMANENT', 365 * 5, RULE, true);
    expect(result.isEligible).toBe(true);
  });

  it('consultants are never eligible, no matter how long their tenure', () => {
    const result = computeGratuityEligibility('CONSULTANT', 365 * 20, RULE, true);
    expect(result.isEligible).toBe(false);
    expect(result.reason).toMatch(/not employees/);
  });

  it('a missing employment type is treated as ineligible, not a thrown error or a silent default', () => {
    const result = computeGratuityEligibility(null, 365 * 10, RULE, true);
    expect(result.isEligible).toBe(false);
    expect(result.reason).toMatch(/not set/);
  });

  it('"service, and part thereof in excess of six months, counts as a full year" — 4 years + 7 months rounds up to 5 for a permanent employee', () => {
    const fourYearsSevenMonths = 4 * 365 + 210; // > half a year (182) into year 5
    const result = computeGratuityEligibility('PERMANENT', fourYearsSevenMonths, RULE, true);
    expect(result.isEligible).toBe(true); // rounds up to 5 years, meets the minimum
  });

  it('4 years + 5 months (under the half-year mark) does NOT round up — still ineligible for a permanent employee', () => {
    const fourYearsFiveMonths = 4 * 365 + 150;
    const result = computeGratuityEligibility('PERMANENT', fourYearsFiveMonths, RULE, true);
    expect(result.isEligible).toBe(false);
  });
});

describe('core-payroll-engine: computeYearsOfServiceDays', () => {
  it('computes whole days between joining and the as-of date', () => {
    expect(computeYearsOfServiceDays('2020-01-01', '2025-01-01')).toBeGreaterThanOrEqual(365 * 5);
  });

  it('never returns negative (a future joining date clamps to zero)', () => {
    expect(computeYearsOfServiceDays('2030-01-01', '2026-01-01')).toBe(0);
  });
});

describe('core-payroll-engine: computeGratuityFormulaAmount ((15/26) x last-drawn monthly wage x rounded years)', () => {
  it('matches the hand-computed statutory formula for a round example', () => {
    const monthlyWage = 30_000_00; // Rs 30,000
    const years = 5;
    const expected = Math.round((15 / 26) * monthlyWage * years);
    expect(computeGratuityFormulaAmount(monthlyWage, years * 365)).toBe(expected);
  });

  it('zero years of service produces zero gratuity', () => {
    expect(computeGratuityFormulaAmount(30_000_00, 0)).toBe(0);
  });
});

describe('core-payroll-engine: computeMonthlyProvisionIncrement (monthly provisioning accrual)', () => {
  it('an ineligible employee accrues zero provision', () => {
    expect(computeMonthlyProvisionIncrement(false, 30_000_00, 365 * 5, 0)).toBe(0);
  });

  it('the increment is the gap between the current formula amount and what is already provisioned', () => {
    const monthlyWage = 30_000_00;
    const years = 5;
    const currentFormula = computeGratuityFormulaAmount(monthlyWage, years * 365);
    const alreadyProvisioned = Math.round(currentFormula / 2);
    expect(computeMonthlyProvisionIncrement(true, monthlyWage, years * 365, alreadyProvisioned)).toBe(currentFormula - alreadyProvisioned);
  });

  it('never goes negative — over-provisioning (e.g. after a wage drop) clamps to zero, not a negative reversal', () => {
    const monthlyWage = 30_000_00;
    const years = 5;
    const currentFormula = computeGratuityFormulaAmount(monthlyWage, years * 365);
    expect(computeMonthlyProvisionIncrement(true, monthlyWage, years * 365, currentFormula * 2)).toBe(0);
  });
});
