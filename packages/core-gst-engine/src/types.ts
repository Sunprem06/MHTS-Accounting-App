/**
 * Shape of the rule_payload JSON stored in rule_set for rule_type
 * `GST_RATE_<hsnSacCode>`. `category`/`description` are pure browsing
 * metadata (e.g. "Electrical & Electronics" / "LED lighting") — they carry
 * no compliance meaning of their own; the HSN/SAC code + rate are still the
 * only things ever posted to an invoice. Both optional so a rate added ad
 * hoc (not picked from the starter catalog) doesn't need them.
 */
export interface GstRatePayload {
  ratePercent: number;
  cessPercent: number;
  category?: string;
  description?: string;
}

export interface GstRateSummary {
  hsnSacCode: string;
  ratePercent: number;
  cessPercent: number;
  effectiveFrom: string;
  sourceReference: string | null;
  category: string | null;
  description: string | null;
}

export interface GstRateVersion extends GstRateSummary {
  id: string;
  effectiveTo: string | null;
  version: number;
}

export interface CreateOrUpdateGstRateInput {
  hsnSacCode: string;
  ratePercent: number;
  cessPercent?: number;
  effectiveFrom: string;
  sourceReference?: string;
  category?: string;
  description?: string;
}

export interface GstSplitInput {
  /** null = not on file (company or party has no state code recorded) — treated as intra-state, the conservative default (see Phase Tracker Open Questions: a true export/SEZ case would need explicit handling this increment doesn't build). */
  companyStateCode: string | null;
  partyStateCode: string | null;
  /** Paise. */
  taxableAmountPaise: number;
  ratePercent: number;
  cessPercent?: number;
}

export interface GstSplitResult {
  isIntraState: boolean;
  /** Paise. Exactly one of (cgstAmount, sgstAmount) or igstAmount is non-zero. */
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  /** Paise. cgstAmount + sgstAmount + igstAmount + cessAmount. */
  totalTaxAmount: number;
}

export interface GstSummaryRow {
  /** Paise. */
  outputCgst: number;
  outputSgst: number;
  outputIgst: number;
  outputCess: number;
  inputCgst: number;
  inputSgst: number;
  inputIgst: number;
  inputCess: number;
}
