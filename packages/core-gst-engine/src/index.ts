// Phase 4 (GST Engine): rate/HSN/SAC resolution, CGST/SGST/IGST place-of-
// supply split, ITC eligibility/set-off, reverse charge, and GSTR-1/3B/9/9C
// prep data (see @mhts/core-sales-purchase's gstReturns.ts, which owns the
// invoice-joining queries). Reads its rates exclusively via
// core-rules-engine's RuleSet resolution service (Rule #2) — never
// hardcodes a slab, rate, or mapping.

export { seedDefaultGstRates, resolveGstRate, createOrUpdateGstRate, listGstRates, listActiveGstRates } from './gstRates';
export type { GstRatePayload, GstRateSummary, GstRateVersion, CreateOrUpdateGstRateInput } from './types';

export { computeGstSplit } from './gstSplit';
export type { GstSplitInput, GstSplitResult } from './types';

export { computeGstSetOff } from './gstSetOff';
export type { GstSetOffInput, GstSetOffResult } from './types';

export { GST_REGISTRATION_TYPES } from './types';
export type { GstRegistrationType } from './types';

export { GST_PERMISSIONS, grantGstPermissions } from './permissions';

export { seedGstLedgers, getGstLedgerIds } from './ledgers';
export type { GstLedgerIds } from './ledgers';

export { computeGstSummary } from './gstSummary';
export type { GstSummaryOptions } from './gstSummary';
export type { GstSummaryRow } from './types';
