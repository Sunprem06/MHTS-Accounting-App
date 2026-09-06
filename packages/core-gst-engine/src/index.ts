// Phase 4 (GST Engine), increment 1: rate/HSN/SAC resolution + CGST/SGST/IGST
// place-of-supply split. Reads its rates exclusively via core-rules-engine's
// RuleSet resolution service (Rule #2) — never hardcodes a slab, rate, or
// mapping. ITC eligibility/reversal and GSTR-1/3B/9/9C filing-format prep are
// deferred to a follow-up pass — see the Phase Tracker's Open Questions.

export { seedDefaultGstRates, resolveGstRate, createOrUpdateGstRate, listGstRates, listActiveGstRates } from './gstRates';
export type { GstRatePayload, GstRateSummary, GstRateVersion, CreateOrUpdateGstRateInput } from './types';

export { computeGstSplit } from './gstSplit';
export type { GstSplitInput, GstSplitResult } from './types';

export { GST_PERMISSIONS, grantGstPermissions } from './permissions';

export { seedGstLedgers, getGstLedgerIds } from './ledgers';
export type { GstLedgerIds } from './ledgers';

export { computeGstSummary } from './gstSummary';
export type { GstSummaryOptions } from './gstSummary';
export type { GstSummaryRow } from './types';
