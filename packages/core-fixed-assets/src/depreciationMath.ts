export interface DepreciationResult {
  /** Paise. */
  depreciationPaise: number;
  /** Paise. openingWdvPaise - depreciationPaise. */
  closingWdvPaise: number;
}

/**
 * Companies Act Schedule II (2014 rules) depreciation for one financial
 * year (or the partial year an asset was actually in service during it).
 * Schedule II mandates strict day-count pro-ration from the date an asset
 * is put to use — unlike the Income Tax Act's WDV block (see
 * computeItWdvBlockDepreciation), there is no <180-days half-rate
 * threshold here; a 90-day-old asset gets exactly 90/365 of its annual
 * depreciation.
 *
 * SLM depreciates a constant amount each year off the ORIGINAL cost less
 * salvage value; WDV depreciates a shrinking amount off the asset's own
 * opening WDV each year. Either way, depreciation never carries the
 * closing WDV below the salvage value.
 */
export function computeSchedule2Depreciation(params: {
  method: 'SLM' | 'WDV';
  purchaseCostPaise: number;
  salvageValuePaise: number;
  openingWdvPaise: number;
  ratePercent: number;
  daysInService: number;
  daysInFinancialYear: number;
}): DepreciationResult {
  const { method, purchaseCostPaise, salvageValuePaise, openingWdvPaise, ratePercent, daysInService, daysInFinancialYear } = params;
  if (daysInService <= 0 || openingWdvPaise <= salvageValuePaise) {
    return { depreciationPaise: 0, closingWdvPaise: openingWdvPaise };
  }

  const depreciableBase = method === 'SLM' ? purchaseCostPaise - salvageValuePaise : openingWdvPaise;
  const annualDepreciation = (depreciableBase * ratePercent) / 100;
  const proratedDepreciation = Math.round(annualDepreciation * (daysInService / daysInFinancialYear));

  const maxDepreciation = openingWdvPaise - salvageValuePaise;
  const depreciationPaise = Math.min(proratedDepreciation, maxDepreciation);

  return { depreciationPaise, closingWdvPaise: openingWdvPaise - depreciationPaise };
}

/**
 * Income Tax Act WDV block depreciation for one financial year. Real WDV
 * blocks pool every asset of a category together and only care whether the
 * BLOCK's total additions during the year crossed 180 days of use, not any
 * one asset — this pass tracks each fixed_asset individually instead (a
 * documented simplification, see Phase Tracker Open Questions), applying
 * the <180-days half-rate rule to that one asset's own first year only.
 * From its second year onward the block's ordinary full rate always
 * applies, and there is no salvage floor — a WDV block runs indefinitely,
 * asymptotically toward (but never below) zero.
 */
export function computeItWdvBlockDepreciation(params: {
  openingWdvPaise: number;
  ratePercent: number;
  isFirstYearUsedLessThan180Days: boolean;
}): DepreciationResult {
  const { openingWdvPaise, ratePercent, isFirstYearUsedLessThan180Days } = params;
  if (openingWdvPaise <= 0) {
    return { depreciationPaise: 0, closingWdvPaise: openingWdvPaise };
  }

  const effectiveRatePercent = isFirstYearUsedLessThan180Days ? ratePercent / 2 : ratePercent;
  const depreciationPaise = Math.round((openingWdvPaise * effectiveRatePercent) / 100);

  return { depreciationPaise, closingWdvPaise: openingWdvPaise - depreciationPaise };
}

/** Whole days between two ISO dates, inclusive of both ends (an asset acquired and disposed on the same day counts as 1 day in service). */
export function daysBetweenInclusive(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00Z`).getTime();
  const to = new Date(`${toDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000) + 1;
}

/** True if the given financial year (by its start-month-derived start year) is a leap year spanning Feb 29 — used to compute daysInFinancialYear precisely rather than assuming 365. */
export function daysInFinancialYear(fromDate: string, toDate: string): number {
  return daysBetweenInclusive(fromDate, toDate);
}
