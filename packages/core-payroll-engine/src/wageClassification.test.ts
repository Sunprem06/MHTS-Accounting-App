import { describe, expect, it } from 'vitest';
import { computeStatutoryWageBase } from './wageClassification';

const CAP_50_PERCENT = { allowanceCapPctOfTotalPay: 50 };

describe('core-payroll-engine: computeStatutoryWageBase (Labour Code wage-cap reclassification, Blueprint §3.2)', () => {
  it('when allowances are already within the cap, nothing is reclassified', () => {
    const result = computeStatutoryWageBase(
      [
        { isStatutoryWageBase: true, monthlyAmount: 60_000_00 }, // Basic
        { isStatutoryWageBase: false, monthlyAmount: 20_000_00 }, // HRA — 25% of total, under the 50% cap
      ],
      CAP_50_PERCENT,
    );
    expect(result.totalMonthlyPay).toBe(80_000_00);
    expect(result.declaredWageBase).toBe(60_000_00);
    expect(result.reclassifiedAmount).toBe(0);
    expect(result.effectiveWageBase).toBe(60_000_00);
  });

  it('the literal Section 3.2 test: allowances above the 50% cap get reclassified into the statutory wage base', () => {
    // Basic 30,000 (30%), allowances 70,000 (70%) of a 100,000 total — 20,000 above the 50,000 cap must reclassify.
    const result = computeStatutoryWageBase(
      [
        { isStatutoryWageBase: true, monthlyAmount: 30_000_00 },
        { isStatutoryWageBase: false, monthlyAmount: 70_000_00 },
      ],
      CAP_50_PERCENT,
    );
    expect(result.totalMonthlyPay).toBe(100_000_00);
    expect(result.declaredWageBase).toBe(30_000_00);
    expect(result.nonWageAllowances).toBe(70_000_00);
    expect(result.allowanceCap).toBe(50_000_00);
    expect(result.reclassifiedAmount).toBe(20_000_00);
    expect(result.effectiveWageBase).toBe(50_000_00); // 30,000 declared + 20,000 reclassified
  });

  it('rate-change simulation: changing the cap percentage (RuleSet payload) changes the result with zero code changes', () => {
    const lines = [
      { isStatutoryWageBase: true, monthlyAmount: 20_000_00 },
      { isStatutoryWageBase: false, monthlyAmount: 80_000_00 },
    ];
    const at50Percent = computeStatutoryWageBase(lines, { allowanceCapPctOfTotalPay: 50 });
    const at70Percent = computeStatutoryWageBase(lines, { allowanceCapPctOfTotalPay: 70 });

    expect(at50Percent.reclassifiedAmount).toBe(80_000_00 - 50_000_00); // 30,000
    expect(at70Percent.reclassifiedAmount).toBe(80_000_00 - 70_000_00); // 10,000
    expect(at70Percent.reclassifiedAmount).toBeLessThan(at50Percent.reclassifiedAmount);
  });

  it('an all-declared-wage-base structure (no separate allowances) reclassifies nothing', () => {
    const result = computeStatutoryWageBase([{ isStatutoryWageBase: true, monthlyAmount: 50_000_00 }], CAP_50_PERCENT);
    expect(result.reclassifiedAmount).toBe(0);
    expect(result.effectiveWageBase).toBe(50_000_00);
  });

  it('an empty structure returns all zeros without throwing', () => {
    const result = computeStatutoryWageBase([], CAP_50_PERCENT);
    expect(result.totalMonthlyPay).toBe(0);
    expect(result.effectiveWageBase).toBe(0);
  });
});
