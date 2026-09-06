import type { PfRulePayload } from './types';

export interface PfComputationResult {
  /** Paise/month. */
  employeeContribution: number;
  /** Paise/month. Informational — a company cost, not deducted from net pay. */
  employerContribution: number;
  /** The wage actually used (capped at the rule's ceiling), for display/audit. */
  contributionWage: number;
}

/** PF is calculated on the statutory wage base capped at the rule's monthly wage ceiling — never the full wage above it. Rates/ceiling are always resolved from the RuleSet (rules.ts), never hardcoded here. */
export function computePf(monthlyStatutoryWageBase: number, rule: PfRulePayload): PfComputationResult {
  const contributionWage = Math.min(monthlyStatutoryWageBase, rule.wageCeiling);
  return {
    employeeContribution: Math.round((contributionWage * rule.employeeRatePercent) / 100),
    employerContribution: Math.round((contributionWage * rule.employerRatePercent) / 100),
    contributionWage,
  };
}
