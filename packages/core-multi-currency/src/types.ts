/** rule_set payload shape for rule_type 'FX_RATE.<CCY>' — see exchangeRates.ts. */
export interface ExchangeRatePayload {
  /** Base-currency units per 1 unit of <CCY>, scaled x1,000,000. */
  rateMicros: number;
}

export interface ExchangeRateVersionSummary {
  id: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  rateMicros: number;
  sourceReference: string | null;
}

export interface FxRevaluationLineDetail {
  ledgerId: string;
  ledgerName: string;
  currency: string;
  /** Foreign-currency minor units, debit-positive. */
  foreignBalance: number;
  /** Paise, all three. */
  baseBalanceBefore: number;
  baseBalanceAfter: number;
  adjustmentAmount: number;
}

export interface FxRevaluationPreview {
  asOfDate: string;
  lines: FxRevaluationLineDetail[];
  /** Sum of every non-zero line's adjustmentAmount magnitude — zero means "nothing to post." */
  totalAdjustmentMagnitude: number;
}

export interface FxRevaluationRunSummary {
  id: string;
  runDate: string;
  financialYear: string;
  voucherId: string | null;
  lines: FxRevaluationLineDetail[];
}
