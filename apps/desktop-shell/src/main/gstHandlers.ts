import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { computeGstSplit, computeGstSummary, createOrUpdateGstRate as coreCreateOrUpdateGstRate, listActiveGstRates as coreListActiveGstRates, listGstRates as coreListGstRates, resolveGstRate } from '@mhts/core-gst-engine';
import { session } from './session';
import type { CreateOrUpdateGstRateInput, GstRatePreviewInput, GstRatePreviewResult, GstRateSummary, GstRateVersion, GstSummaryInput, GstSummaryResult } from '../shared/ipc';

const PAISE_PER_RUPEE = 100;
const rupeesToPaise = (rupees: number): number => Math.round(rupees * PAISE_PER_RUPEE);
const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;

function requireSessionWithCompanyDb(requiredPermission: string) {
  const info = session.get();
  const companyDb = session.getCompanyDb();
  if (!info || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!info.permissions.includes(requiredPermission)) {
    throw new Error(`You do not have permission (${requiredPermission}) for this action`);
  }
  return { info, companyDb };
}

export async function createOrUpdateGstRate(systemDb: Kysely<SystemDatabase>, input: CreateOrUpdateGstRateInput): Promise<string> {
  const { info } = requireSessionWithCompanyDb('GST.MANAGE_RATES');
  return coreCreateOrUpdateGstRate(systemDb, input, info.userId);
}

export async function listGstRates(systemDb: Kysely<SystemDatabase>, hsnSacCode: string): Promise<GstRateVersion[]> {
  requireSessionWithCompanyDb('GST.MANAGE_RATES');
  return coreListGstRates(systemDb, hsnSacCode);
}

export async function listActiveGstRates(systemDb: Kysely<SystemDatabase>): Promise<GstRateSummary[]> {
  requireSessionWithCompanyDb('GST.MANAGE_RATES');
  return coreListActiveGstRates(systemDb);
}

/**
 * Live preview for the invoice line editor: resolves the current rate for an
 * HSN/SAC code and shows the CGST/SGST/IGST/cess split the invoice will
 * actually post — read-only, gated by either invoice-creation permission
 * (not GST.MANAGE_RATES) since this is used while drafting a sales/purchase
 * document, not administering rates.
 */
export async function previewGst(systemDb: Kysely<SystemDatabase>, input: GstRatePreviewInput): Promise<GstRatePreviewResult> {
  const info = session.get();
  const companyDb = session.getCompanyDb();
  if (!info || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!info.permissions.includes('SALES.CREATE_INVOICE') && !info.permissions.includes('PURCHASE.CREATE_INVOICE')) {
    throw new Error('You do not have permission to preview GST for an invoice line');
  }

  const party = await companyDb.selectFrom('business_party').select('state_code').where('id', '=', input.partyId).executeTakeFirst();
  const company = await systemDb.selectFrom('company').select('state_code').where('id', '=', info.companyId).executeTakeFirstOrThrow();

  const rate = await resolveGstRate(systemDb, input.hsnSacCode, input.invoiceDate);
  const split = computeGstSplit({
    companyStateCode: company.state_code,
    partyStateCode: party?.state_code ?? null,
    taxableAmountPaise: rupeesToPaise(input.amountRupees),
    ratePercent: rate.ratePercent,
    cessPercent: rate.cessPercent,
  });

  return {
    ratePercent: rate.ratePercent,
    cessPercent: rate.cessPercent,
    isIntraState: split.isIntraState,
    cgstRupees: paiseToRupees(split.cgstAmount),
    sgstRupees: paiseToRupees(split.sgstAmount),
    igstRupees: paiseToRupees(split.igstAmount),
    cessRupees: paiseToRupees(split.cessAmount),
    totalTaxRupees: paiseToRupees(split.totalTaxAmount),
  };
}

export async function getGstSummary(input: GstSummaryInput): Promise<GstSummaryResult> {
  const { companyDb } = requireSessionWithCompanyDb('GST.VIEW_REPORTS');
  const row = await computeGstSummary(companyDb, { fromDate: input.fromDate, toDate: input.toDate });
  return {
    outputCgst: paiseToRupees(row.outputCgst),
    outputSgst: paiseToRupees(row.outputSgst),
    outputIgst: paiseToRupees(row.outputIgst),
    outputCess: paiseToRupees(row.outputCess),
    inputCgst: paiseToRupees(row.inputCgst),
    inputSgst: paiseToRupees(row.inputSgst),
    inputIgst: paiseToRupees(row.inputIgst),
    inputCess: paiseToRupees(row.inputCess),
  };
}
