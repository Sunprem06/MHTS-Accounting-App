import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { computeGstSplit, computeGstSummary, createOrUpdateGstRate as coreCreateOrUpdateGstRate, listActiveGstRates as coreListActiveGstRates, listGstRates as coreListGstRates, resolveGstRate } from '@mhts/core-gst-engine';
import { computeGstr1Data, computeGstr3bData, computeGstr9Data, computeGstr9cData } from '@mhts/core-sales-purchase';
import type { Gstr3bData } from '@mhts/core-sales-purchase';
import { session } from './session';
import type {
  CreateOrUpdateGstRateInput,
  GstFinancialYearInput,
  GstRatePreviewInput,
  GstRatePreviewResult,
  GstRateSummary,
  GstRateVersion,
  GstReturnPeriodInput,
  GstSummaryInput,
  GstSummaryResult,
  Gstr1Result,
  Gstr3bResult,
  Gstr9Result,
  Gstr9cResult,
} from '../shared/ipc';

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

function gstr3bDataToRupees(data: Gstr3bData): Gstr3bResult {
  return {
    outwardTaxableValue: paiseToRupees(data.outwardTaxableValue),
    outwardCgst: paiseToRupees(data.outwardCgst),
    outwardSgst: paiseToRupees(data.outwardSgst),
    outwardIgst: paiseToRupees(data.outwardIgst),
    outwardCess: paiseToRupees(data.outwardCess),
    rcmInwardTaxableValue: paiseToRupees(data.rcmInwardTaxableValue),
    rcmInwardCgst: paiseToRupees(data.rcmInwardCgst),
    rcmInwardSgst: paiseToRupees(data.rcmInwardSgst),
    rcmInwardIgst: paiseToRupees(data.rcmInwardIgst),
    rcmInwardCess: paiseToRupees(data.rcmInwardCess),
    itcEligibleCgst: paiseToRupees(data.itcEligibleCgst),
    itcEligibleSgst: paiseToRupees(data.itcEligibleSgst),
    itcEligibleIgst: paiseToRupees(data.itcEligibleIgst),
    itcEligibleCess: paiseToRupees(data.itcEligibleCess),
    itcIneligibleCgst: paiseToRupees(data.itcIneligibleCgst),
    itcIneligibleSgst: paiseToRupees(data.itcIneligibleSgst),
    itcIneligibleIgst: paiseToRupees(data.itcIneligibleIgst),
    itcIneligibleCess: paiseToRupees(data.itcIneligibleCess),
    netPayable: {
      netCgstPayable: paiseToRupees(data.netPayable.netCgstPayable),
      netSgstPayable: paiseToRupees(data.netPayable.netSgstPayable),
      netIgstPayable: paiseToRupees(data.netPayable.netIgstPayable),
      netCessPayable: paiseToRupees(data.netPayable.netCessPayable),
      carryForwardCgst: paiseToRupees(data.netPayable.carryForwardCgst),
      carryForwardSgst: paiseToRupees(data.netPayable.carryForwardSgst),
      carryForwardIgst: paiseToRupees(data.netPayable.carryForwardIgst),
      carryForwardCess: paiseToRupees(data.netPayable.carryForwardCess),
    },
  };
}

/**
 * Merges two independently-computed views of the same period: the existing
 * ledger-balance-based computeGstSummary (output/input by head — unchanged
 * since increment 1) and the line-level computeGstr3bData (net payable after
 * set-off, blocked ITC, RCM self-assessment) — the two agree on output/
 * eligible-input by construction (same postings, different read paths), and
 * this reuses computeGstr3bData rather than duplicating its set-off/
 * eligibility-split logic a second time just for this screen.
 */
export async function getGstSummary(input: GstSummaryInput): Promise<GstSummaryResult> {
  const { companyDb } = requireSessionWithCompanyDb('GST.VIEW_REPORTS');
  const [summary, gstr3b] = await Promise.all([
    computeGstSummary(companyDb, { fromDate: input.fromDate, toDate: input.toDate }),
    computeGstr3bData(companyDb, { fromDate: input.fromDate ?? '0001-01-01', toDate: input.toDate ?? '9999-12-31' }),
  ]);
  return {
    outputCgst: paiseToRupees(summary.outputCgst),
    outputSgst: paiseToRupees(summary.outputSgst),
    outputIgst: paiseToRupees(summary.outputIgst),
    outputCess: paiseToRupees(summary.outputCess),
    inputCgst: paiseToRupees(summary.inputCgst),
    inputSgst: paiseToRupees(summary.inputSgst),
    inputIgst: paiseToRupees(summary.inputIgst),
    inputCess: paiseToRupees(summary.inputCess),
    netCgstPayable: paiseToRupees(gstr3b.netPayable.netCgstPayable),
    netSgstPayable: paiseToRupees(gstr3b.netPayable.netSgstPayable),
    netIgstPayable: paiseToRupees(gstr3b.netPayable.netIgstPayable),
    netCessPayable: paiseToRupees(gstr3b.netPayable.netCessPayable),
    carryForwardCgst: paiseToRupees(gstr3b.netPayable.carryForwardCgst),
    carryForwardSgst: paiseToRupees(gstr3b.netPayable.carryForwardSgst),
    carryForwardIgst: paiseToRupees(gstr3b.netPayable.carryForwardIgst),
    carryForwardCess: paiseToRupees(gstr3b.netPayable.carryForwardCess),
    blockedItcCgst: paiseToRupees(gstr3b.itcIneligibleCgst),
    blockedItcSgst: paiseToRupees(gstr3b.itcIneligibleSgst),
    blockedItcIgst: paiseToRupees(gstr3b.itcIneligibleIgst),
    blockedItcCess: paiseToRupees(gstr3b.itcIneligibleCess),
    rcmInwardCgst: paiseToRupees(gstr3b.rcmInwardCgst),
    rcmInwardSgst: paiseToRupees(gstr3b.rcmInwardSgst),
    rcmInwardIgst: paiseToRupees(gstr3b.rcmInwardIgst),
    rcmInwardCess: paiseToRupees(gstr3b.rcmInwardCess),
  };
}

export async function getGstr1(input: GstReturnPeriodInput): Promise<Gstr1Result> {
  const { companyDb } = requireSessionWithCompanyDb('GST.VIEW_REPORTS');
  const data = await computeGstr1Data(companyDb, input);
  return {
    b2bInvoices: data.b2bInvoices.map((row) => ({
      ...row,
      taxableAmount: paiseToRupees(row.taxableAmount),
      cgstAmount: paiseToRupees(row.cgstAmount),
      sgstAmount: paiseToRupees(row.sgstAmount),
      igstAmount: paiseToRupees(row.igstAmount),
      cessAmount: paiseToRupees(row.cessAmount),
    })),
    b2cSummary: data.b2cSummary.map((row) => ({
      ...row,
      taxableAmount: paiseToRupees(row.taxableAmount),
      cgstAmount: paiseToRupees(row.cgstAmount),
      sgstAmount: paiseToRupees(row.sgstAmount),
      igstAmount: paiseToRupees(row.igstAmount),
      cessAmount: paiseToRupees(row.cessAmount),
    })),
    hsnSummary: data.hsnSummary.map((row) => ({
      ...row,
      taxableAmount: paiseToRupees(row.taxableAmount),
      cgstAmount: paiseToRupees(row.cgstAmount),
      sgstAmount: paiseToRupees(row.sgstAmount),
      igstAmount: paiseToRupees(row.igstAmount),
      cessAmount: paiseToRupees(row.cessAmount),
    })),
  };
}

export async function getGstr3b(input: GstReturnPeriodInput): Promise<Gstr3bResult> {
  const { companyDb } = requireSessionWithCompanyDb('GST.VIEW_REPORTS');
  const data = await computeGstr3bData(companyDb, input);
  return gstr3bDataToRupees(data);
}

export async function getGstr9(systemDb: Kysely<SystemDatabase>, input: GstFinancialYearInput): Promise<Gstr9Result> {
  const { info, companyDb } = requireSessionWithCompanyDb('GST.VIEW_REPORTS');
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', info.companyId).executeTakeFirstOrThrow();
  const data = await computeGstr9Data(companyDb, company.financial_year_start_month, input.financialYear);
  return {
    ...gstr3bDataToRupees(data),
    financialYear: data.financialYear,
    fromDate: data.fromDate,
    toDate: data.toDate,
    hsnSummary: data.hsnSummary.map((row) => ({
      ...row,
      taxableAmount: paiseToRupees(row.taxableAmount),
      cgstAmount: paiseToRupees(row.cgstAmount),
      sgstAmount: paiseToRupees(row.sgstAmount),
      igstAmount: paiseToRupees(row.igstAmount),
      cessAmount: paiseToRupees(row.cessAmount),
    })),
  };
}

export async function getGstr9c(systemDb: Kysely<SystemDatabase>, input: GstFinancialYearInput): Promise<Gstr9cResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('GST.VIEW_REPORTS');
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', info.companyId).executeTakeFirstOrThrow();
  const data = await computeGstr9cData(companyDb, company.financial_year_start_month, input.financialYear);
  return {
    financialYear: data.financialYear,
    turnoverPerBooks: paiseToRupees(data.turnoverPerBooks),
    turnoverPerGstReturns: paiseToRupees(data.turnoverPerGstReturns),
    turnoverReconciliationGap: paiseToRupees(data.turnoverReconciliationGap),
    totalTaxDeclaredForYear: paiseToRupees(data.totalTaxDeclaredForYear),
  };
}
