import type { TdsSlabNewRegimePayload } from './types';

/**
 * New-regime-only auto-estimator (Section 192). The new regime allows almost
 * no exemptions (no HRA exemption, no 80C/80D, etc.), so a slab computation
 * from gross salary alone stays meaningfully accurate. The OLD regime is
 * deliberately NOT computed here — it depends on HRA actually paid, 80C
 * investments, 80D, home-loan interest and more, none of which this app
 * collects; inventing a number without those inputs would be actively
 * misleading rather than a reasonable simplification, so old-regime TDS is
 * manual-entry-only (see payrollRun.ts, gated on
 * company_payroll_settings.tds_regime).
 */
export function computeAnnualTaxNewRegime(annualGrossEarnings: number, rule: TdsSlabNewRegimePayload): number {
  const netTaxableIncome = Math.max(0, annualGrossEarnings - rule.standardDeduction);
  if (netTaxableIncome <= rule.rebateThreshold) {
    return 0; // Section 87A rebate — full rebate up to the threshold under the new regime.
  }

  const sortedSlabs = [...rule.slabs].sort((a, b) => a.aboveAnnualIncome - b.aboveAnnualIncome);
  let tax = 0;
  for (let i = 0; i < sortedSlabs.length; i++) {
    const slab = sortedSlabs[i];
    if (netTaxableIncome <= slab.aboveAnnualIncome) {
      break;
    }
    const nextThreshold = sortedSlabs[i + 1]?.aboveAnnualIncome ?? Infinity;
    const taxableInThisSlab = Math.min(netTaxableIncome, nextThreshold) - slab.aboveAnnualIncome;
    tax += (taxableInThisSlab * slab.ratePercent) / 100;
  }

  const cess = (tax * rule.cessPercent) / 100;
  return Math.round(tax + cess);
}

/** Spreads the estimated annual tax evenly across the employee's remaining payroll months in the financial year — a standard "estimate annual liability, deduct evenly" approach, not the more elaborate month-by-month re-projection real payroll software sometimes does. */
export function computeMonthlyTdsNewRegime(annualGrossEarnings: number, rule: TdsSlabNewRegimePayload, remainingMonthsInFinancialYear: number): number {
  if (remainingMonthsInFinancialYear <= 0) {
    return 0;
  }
  const annualTax = computeAnnualTaxNewRegime(annualGrossEarnings, rule);
  return Math.round(annualTax / remainingMonthsInFinancialYear);
}
