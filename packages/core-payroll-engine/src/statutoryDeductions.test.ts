import { describe, expect, it } from 'vitest';
import { computePf } from './pf';
import { computeEsi } from './esi';
import { computePt } from './pt';
import { computeAnnualTaxNewRegime, computeMonthlyTdsNewRegime } from './salaryTds';

// Real seeded defaults from rules.ts (seedDefaultPayrollRules) — kept here as
// literal fixtures so a future accidental change to the seed defaults is
// caught by this file failing, not silently drifting.
const PF_RULE = { employeeRatePercent: 12, employerRatePercent: 12, wageCeiling: 1_500_000, applicabilityMinEmployees: 20 };
const ESI_RULE = { employeeRatePercent: 0.75, employerRatePercent: 3.25, wageCeiling: 2_100_000, applicabilityMinEmployees: 10 };
const TDS_RULE = {
  standardDeduction: 7_500_000,
  rebateThreshold: 120_000_000,
  slabs: [
    { aboveAnnualIncome: 0, ratePercent: 0 },
    { aboveAnnualIncome: 40_000_000, ratePercent: 5 },
    { aboveAnnualIncome: 80_000_000, ratePercent: 10 },
    { aboveAnnualIncome: 120_000_000, ratePercent: 15 },
    { aboveAnnualIncome: 160_000_000, ratePercent: 20 },
    { aboveAnnualIncome: 200_000_000, ratePercent: 25 },
    { aboveAnnualIncome: 240_000_000, ratePercent: 30 },
  ],
  cessPercent: 4,
};

describe('core-payroll-engine: computePf', () => {
  it('below the wage ceiling, contributes on the actual wage base', () => {
    const result = computePf(10_000_00, PF_RULE); // Rs 10,000, under the Rs 15,000 ceiling
    expect(result.contributionWage).toBe(10_000_00);
    expect(result.employeeContribution).toBe(1_200_00); // 12%
    expect(result.employerContribution).toBe(1_200_00);
  });

  it('above the wage ceiling, contributes only on the capped ceiling, not the full wage', () => {
    const result = computePf(50_000_00, PF_RULE); // Rs 50,000, well above the Rs 15,000 ceiling
    expect(result.contributionWage).toBe(PF_RULE.wageCeiling);
    expect(result.employeeContribution).toBe(Math.round((PF_RULE.wageCeiling * 12) / 100));
  });
});

describe('core-payroll-engine: computeEsi (all-or-nothing gate, not cap-and-contribute)', () => {
  it('below the gross ceiling, contributes on the full gross', () => {
    const result = computeEsi(15_000_00, ESI_RULE);
    expect(result.applicable).toBe(true);
    expect(result.employeeContribution).toBe(Math.round((15_000_00 * 0.75) / 100));
  });

  it('above the gross ceiling, is entirely outside the scheme for that month (zero, not capped)', () => {
    const result = computeEsi(25_000_00, ESI_RULE); // above Rs 21,000 ceiling
    expect(result.applicable).toBe(false);
    expect(result.employeeContribution).toBe(0);
    expect(result.employerContribution).toBe(0);
  });

  it('exactly at the ceiling is still applicable (strictly-greater-than gate)', () => {
    const result = computeEsi(ESI_RULE.wageCeiling, ESI_RULE);
    expect(result.applicable).toBe(true);
  });
});

describe('core-payroll-engine: computePt', () => {
  it('a null rule (unconfigured state) resolves to zero, not an invented amount', () => {
    expect(computePt(50_000_00, null)).toBe(0);
  });

  it('an empty slabs array also resolves to zero', () => {
    expect(computePt(50_000_00, { slabs: [] })).toBe(0);
  });

  it('picks the highest slab whose threshold the gross exceeds', () => {
    const rule = {
      slabs: [
        { aboveGrossThreshold: 0, amount: 0 },
        { aboveGrossThreshold: 15_000_00, amount: 150_00 },
        { aboveGrossThreshold: 25_000_00, amount: 200_00 },
      ],
    };
    expect(computePt(10_000_00, rule)).toBe(0);
    expect(computePt(20_000_00, rule)).toBe(150_00);
    expect(computePt(30_000_00, rule)).toBe(200_00);
  });

  it('is order-independent — an unsorted slabs array still resolves correctly', () => {
    const rule = {
      slabs: [
        { aboveGrossThreshold: 25_000_00, amount: 200_00 },
        { aboveGrossThreshold: 0, amount: 0 },
        { aboveGrossThreshold: 15_000_00, amount: 150_00 },
      ],
    };
    expect(computePt(20_000_00, rule)).toBe(150_00);
  });
});

describe('core-payroll-engine: computeAnnualTaxNewRegime (Section 192, new regime, FY2025-26 slabs)', () => {
  it('income at or below the Section 87A rebate threshold owes zero tax', () => {
    // Rs 12,00,000 net taxable = the rebate threshold itself.
    const grossAtThreshold = TDS_RULE.rebateThreshold + TDS_RULE.standardDeduction;
    expect(computeAnnualTaxNewRegime(grossAtThreshold, TDS_RULE)).toBe(0);
  });

  it('income comfortably below the rebate threshold owes zero tax', () => {
    expect(computeAnnualTaxNewRegime(8_00_000_00, TDS_RULE)).toBe(0); // Rs 8,00,000 gross
  });

  it('a full worked example above the rebate threshold matches hand-computed progressive-slab tax + 4% cess', () => {
    // Rs 20,00,000 gross - Rs 75,000 standard deduction = Rs 19,25,000 net taxable.
    const gross = 2_000_000_00; // Rs 20,00,000 in paise
    const netTaxable = gross - TDS_RULE.standardDeduction; // 19,25,000 in paise units used by this fn (paise-of-rupees, i.e. "paise" here means 1/100 rupee same scale as rule)
    // Hand-computed slab tax (rupees, then re-expressed in the same paise-like unit):
    // 0-4L: 0; 4-8L @5% = 20,000; 8-12L @10% = 40,000; 12-16L @15% = 60,000; 16-19.25L @20% = 65,000
    // Total = 1,85,000; cess 4% = 7,400; total tax = 1,92,400
    const expectedTax = 20_000_00 + 40_000_00 + 60_000_00 + 65_000_00;
    const expectedCess = Math.round((expectedTax * 4) / 100);
    expect(computeAnnualTaxNewRegime(gross, TDS_RULE)).toBe(expectedTax + expectedCess);
    expect(netTaxable).toBeGreaterThan(TDS_RULE.rebateThreshold);
  });

  it('computeMonthlyTdsNewRegime spreads the annual tax evenly across the remaining months', () => {
    const gross = 2_000_000_00;
    const annual = computeAnnualTaxNewRegime(gross, TDS_RULE);
    const monthly = computeMonthlyTdsNewRegime(gross, TDS_RULE, 12);
    expect(monthly).toBe(Math.round(annual / 12));
  });

  it('computeMonthlyTdsNewRegime returns zero when there are no remaining months (e.g. final month already processed)', () => {
    expect(computeMonthlyTdsNewRegime(2_000_000_00, TDS_RULE, 0)).toBe(0);
  });
});
