import type { EsiRulePayload } from './types';

export interface EsiComputationResult {
  applicable: boolean;
  /** Paise/month. Zero when not applicable. */
  employeeContribution: number;
  /** Paise/month. Informational — a company cost, not deducted from net pay. */
  employerContribution: number;
}

export interface ComputeEsiOptions {
  /**
   * Set when the employee was already ESI-applicable earlier in the SAME
   * statutory contribution period (1 Apr-30 Sep or 1 Oct-31 Mar) — see
   * esiContributionPeriod.ts's wasEsiApplicableEarlierInContributionPeriod().
   * Per the ESI Act, the wage ceiling is only an entry gate: once covered,
   * an employee stays covered and contributing for the REST of that period
   * even if a mid-period raise pushes gross wages above the ceiling, and
   * contributions are NOT capped at the ceiling the way PF's are — they
   * continue on full actual gross.
   */
  forceApplicable?: boolean;
}

/** ESI is an all-or-nothing wage-ceiling gate, unlike PF's cap-and-contribute: an employee earning above the ceiling is simply outside the scheme for that month, not contributing on a capped base — UNLESS they were already covered earlier in the same contribution period (options.forceApplicable), in which case coverage continues uncapped through the rest of the period. Rates/ceiling always come from the RuleSet (rules.ts), never hardcoded here. */
export function computeEsi(monthlyGrossEarnings: number, rule: EsiRulePayload, options: ComputeEsiOptions = {}): EsiComputationResult {
  if (!options.forceApplicable && monthlyGrossEarnings > rule.wageCeiling) {
    return { applicable: false, employeeContribution: 0, employerContribution: 0 };
  }
  return {
    applicable: true,
    employeeContribution: Math.round((monthlyGrossEarnings * rule.employeeRatePercent) / 100),
    employerContribution: Math.round((monthlyGrossEarnings * rule.employerRatePercent) / 100),
  };
}
