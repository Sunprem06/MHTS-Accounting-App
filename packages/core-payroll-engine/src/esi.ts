import type { EsiRulePayload } from './types';

export interface EsiComputationResult {
  applicable: boolean;
  /** Paise/month. Zero when not applicable. */
  employeeContribution: number;
  /** Paise/month. Informational — a company cost, not deducted from net pay. */
  employerContribution: number;
}

/** ESI is an all-or-nothing wage-ceiling gate, unlike PF's cap-and-contribute: an employee earning above the ceiling is simply outside the scheme for that month, not contributing on a capped base. Rates/ceiling always come from the RuleSet (rules.ts), never hardcoded here. */
export function computeEsi(monthlyGrossEarnings: number, rule: EsiRulePayload): EsiComputationResult {
  if (monthlyGrossEarnings > rule.wageCeiling) {
    return { applicable: false, employeeContribution: 0, employerContribution: 0 };
  }
  return {
    applicable: true,
    employeeContribution: Math.round((monthlyGrossEarnings * rule.employeeRatePercent) / 100),
    employerContribution: Math.round((monthlyGrossEarnings * rule.employerRatePercent) / 100),
  };
}
