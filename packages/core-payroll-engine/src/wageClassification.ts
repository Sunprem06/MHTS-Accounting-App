import type { WageDefinitionCapPayload } from './types';

export interface WageClassificationLine {
  isStatutoryWageBase: boolean;
  /** Paise/month. Only EARNING-type lines are passed in — deductions play no part in the wage-base calculation. */
  monthlyAmount: number;
}

export interface WageClassificationResult {
  /** Paise/month. Sum of every earning line, statutory-flagged or not. */
  totalMonthlyPay: number;
  /** Paise/month. Sum of lines already flagged is_statutory_wage_base. */
  declaredWageBase: number;
  /** Paise/month. Sum of the remaining (allowance) lines. */
  nonWageAllowances: number;
  /** Paise/month. allowanceCapPctOfTotalPay% of totalMonthlyPay. */
  allowanceCap: number;
  /** Paise/month. max(0, nonWageAllowances - allowanceCap) — the portion of allowances the Labour Code's unified wages definition reclassifies as wages. */
  reclassifiedAmount: number;
  /** Paise/month. declaredWageBase + reclassifiedAmount — the actual base PF/ESI/gratuity use. */
  effectiveWageBase: number;
}

/**
 * The literal implementation of Blueprint §3.2's core requirement: "do not
 * hardcode a 50% constant anywhere... allowances are capped at X% of total
 * pay — anything above that is reclassified as wages." X itself comes from
 * @mhts/core-rules-engine's PAYROLL.WAGE_DEFINITION_CAP rule (see rules.ts),
 * never a literal here. Pure function — no DB access — so it's directly unit
 * -testable and the exit-criterion "rate-change simulation, zero code
 * changes" (same style as the GST engine's) is just swapping the RuleSet
 * payload.
 */
export function computeStatutoryWageBase(lines: WageClassificationLine[], wageCap: WageDefinitionCapPayload): WageClassificationResult {
  const totalMonthlyPay = lines.reduce((sum, line) => sum + line.monthlyAmount, 0);
  const declaredWageBase = lines.filter((line) => line.isStatutoryWageBase).reduce((sum, line) => sum + line.monthlyAmount, 0);
  const nonWageAllowances = totalMonthlyPay - declaredWageBase;
  const allowanceCap = Math.round((totalMonthlyPay * wageCap.allowanceCapPctOfTotalPay) / 100);
  const reclassifiedAmount = Math.max(0, nonWageAllowances - allowanceCap);
  const effectiveWageBase = declaredWageBase + reclassifiedAmount;

  return { totalMonthlyPay, declaredWageBase, nonWageAllowances, allowanceCap, reclassifiedAmount, effectiveWageBase };
}
