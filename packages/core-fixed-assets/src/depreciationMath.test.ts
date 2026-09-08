import { describe, expect, it } from 'vitest';
import { computeItWdvBlockDepreciation, computeSchedule2Depreciation, daysBetweenInclusive } from './depreciationMath';

describe('core-fixed-assets: computeSchedule2Depreciation (Companies Act Schedule II)', () => {
  it('SLM: a full financial year depreciates ratePercent of (cost - salvage), never touching salvage', () => {
    const result = computeSchedule2Depreciation({
      method: 'SLM',
      purchaseCostPaise: 1_000_000_00,
      salvageValuePaise: 50_000_00,
      openingWdvPaise: 1_000_000_00,
      ratePercent: 10,
      daysInService: 365,
      daysInFinancialYear: 365,
    });
    expect(result.depreciationPaise).toBe(Math.round((950_000_00 * 10) / 100));
    expect(result.closingWdvPaise).toBe(1_000_000_00 - result.depreciationPaise);
  });

  it('WDV: depreciates ratePercent of the OPENING WDV (shrinking base each year), not the original cost', () => {
    const result = computeSchedule2Depreciation({
      method: 'WDV',
      purchaseCostPaise: 1_000_000_00,
      salvageValuePaise: 0,
      openingWdvPaise: 800_000_00, // already depreciated once
      ratePercent: 10,
      daysInService: 365,
      daysInFinancialYear: 365,
    });
    expect(result.depreciationPaise).toBe(80_000_00); // 10% of 800,000, not 1,000,000
  });

  it('strict day-count pro-ration: a half-year in service gets half the annual depreciation, no <180-day threshold (unlike IT WDV)', () => {
    const fullYear = computeSchedule2Depreciation({ method: 'SLM', purchaseCostPaise: 1_000_00, salvageValuePaise: 0, openingWdvPaise: 1_000_00, ratePercent: 20, daysInService: 365, daysInFinancialYear: 365 });
    const halfYear = computeSchedule2Depreciation({ method: 'SLM', purchaseCostPaise: 1_000_00, salvageValuePaise: 0, openingWdvPaise: 1_000_00, ratePercent: 20, daysInService: 182, daysInFinancialYear: 365 });
    // Even a day count well under 180 still depreciates proportionally, not zero — the defining difference from IT WDV's half-rate cliff.
    expect(halfYear.depreciationPaise).toBeGreaterThan(0);
    expect(halfYear.depreciationPaise).toBeLessThan(fullYear.depreciationPaise);
    expect(halfYear.depreciationPaise / fullYear.depreciationPaise).toBeCloseTo(182 / 365, 2);
  });

  it('never depreciates below the salvage value floor, even if the rate/days would otherwise overshoot', () => {
    const result = computeSchedule2Depreciation({
      method: 'WDV',
      purchaseCostPaise: 1_000_00,
      salvageValuePaise: 900_00, // almost fully depreciated already
      openingWdvPaise: 910_00,
      ratePercent: 50, // would normally take off 455, but only 10 remains above salvage
      daysInService: 365,
      daysInFinancialYear: 365,
    });
    expect(result.closingWdvPaise).toBe(900_00); // clamped exactly at salvage, never below
    expect(result.depreciationPaise).toBe(10_00);
  });

  it('zero days in service produces zero depreciation without error', () => {
    const result = computeSchedule2Depreciation({ method: 'SLM', purchaseCostPaise: 1_000_00, salvageValuePaise: 0, openingWdvPaise: 1_000_00, ratePercent: 10, daysInService: 0, daysInFinancialYear: 365 });
    expect(result.depreciationPaise).toBe(0);
  });
});

describe('core-fixed-assets: computeItWdvBlockDepreciation (Income Tax Act WDV block)', () => {
  it('a normal year (>=180 days) uses the full rate', () => {
    const result = computeItWdvBlockDepreciation({ openingWdvPaise: 1_000_000_00, ratePercent: 15, isFirstYearUsedLessThan180Days: false });
    expect(result.depreciationPaise).toBe(150_000_00);
  });

  it('the real <180-days half-rate rule: a first-year asset used less than 180 days gets HALF the rate, not zero and not the full rate', () => {
    const result = computeItWdvBlockDepreciation({ openingWdvPaise: 1_000_000_00, ratePercent: 15, isFirstYearUsedLessThan180Days: true });
    expect(result.depreciationPaise).toBe(75_000_00); // 7.5%, not 15% and not 0%
  });

  it('has no salvage floor — asymptotically approaches zero but a zero opening WDV produces zero depreciation, not negative', () => {
    const result = computeItWdvBlockDepreciation({ openingWdvPaise: 0, ratePercent: 15, isFirstYearUsedLessThan180Days: false });
    expect(result.depreciationPaise).toBe(0);
    expect(result.closingWdvPaise).toBe(0);
  });

  it('the two books (Schedule II vs IT WDV) compute genuinely different amounts for the same asset — the literal dual-depreciation exit criterion', () => {
    const schedule2 = computeSchedule2Depreciation({ method: 'SLM', purchaseCostPaise: 1_000_000_00, salvageValuePaise: 50_000_00, openingWdvPaise: 1_000_000_00, ratePercent: 10, daysInService: 365, daysInFinancialYear: 365 });
    const itWdv = computeItWdvBlockDepreciation({ openingWdvPaise: 1_000_000_00, ratePercent: 15, isFirstYearUsedLessThan180Days: false });
    expect(schedule2.depreciationPaise).not.toBe(itWdv.depreciationPaise);
  });
});

describe('core-fixed-assets: daysBetweenInclusive', () => {
  it('the same day counts as 1 day (both ends inclusive)', () => {
    expect(daysBetweenInclusive('2025-01-01', '2025-01-01')).toBe(1);
  });

  it('a full non-leap financial year is 365 days', () => {
    expect(daysBetweenInclusive('2025-04-01', '2026-03-31')).toBe(365);
  });

  it('a financial year spanning a leap-year Feb 29 is 366 days', () => {
    expect(daysBetweenInclusive('2027-04-01', '2028-03-31')).toBe(366); // 2028 is a leap year
  });
});
