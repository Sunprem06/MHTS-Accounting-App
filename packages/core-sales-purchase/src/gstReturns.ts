import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { computeFinancialYearDateBounds, computeProfitAndLoss } from '@mhts/core-accounting';
import { computeGstSetOff } from '@mhts/core-gst-engine';
import type { GstSetOffResult } from '@mhts/core-gst-engine';

// better-sqlite3 binds these as raw 0/1, but Kysely's declared Select type for a
// ColumnType<boolean, ...> column is `boolean` — same cast-through-unknown pattern
// already used in receivablesPayables.ts's IS_MSME constant.
const IS_TRUE = 1 as unknown as boolean;
const IS_FALSE = 0 as unknown as boolean;

/**
 * GSTR-1/3B/9/9C PREP DATA — CA-facing reference reports (on-screen tables +
 * plain CSV export), not an attempt to match the GST portal's exact
 * upload-ready JSON schema (a separate, precision-heavy effort — see Phase
 * Tracker Open Questions). Only invoice lines with an hsn_sac_code (the
 * GST-computed path) are included — a line still using the pre-Phase-4
 * manual tax_ledger_id/tax_amount path has no resolved rate/HSN to classify
 * by, so it won't appear in these reports (a real, flagged scoping limit,
 * not a silent gap).
 */

export interface DateRange {
  fromDate: string;
  toDate: string;
}

export interface Gstr1B2bInvoiceRow {
  invoiceId: string;
  voucherNumber: number;
  invoiceDate: string;
  partyName: string;
  partyGstin: string;
  partyStateCode: string | null;
  isReverseCharge: boolean;
  /** Paise. Summed across every GST-carrying line on the invoice. */
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
}

export interface Gstr1B2cSummaryRow {
  stateCode: string | null;
  ratePercent: number;
  /** Paise. */
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
}

export interface Gstr1HsnSummaryRow {
  hsnSacCode: string;
  /** Paise. */
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
}

export interface Gstr1Data {
  b2bInvoices: Gstr1B2bInvoiceRow[];
  b2cSummary: Gstr1B2cSummaryRow[];
  hsnSummary: Gstr1HsnSummaryRow[];
}

/** Outward supplies for a period, split B2B (invoice-wise, recipient has a GSTIN)/B2C (state+rate summary, no GSTIN) per the real GSTR-1's own structure, plus an HSN-wise summary across both. */
export async function computeGstr1Data(companyDb: Kysely<CompanyDatabase>, range: DateRange): Promise<Gstr1Data> {
  const lines = await companyDb
    .selectFrom('sales_invoice_line')
    .innerJoin('sales_invoice', 'sales_invoice.id', 'sales_invoice_line.sales_invoice_id')
    .innerJoin('voucher', 'voucher.id', 'sales_invoice.voucher_id')
    .innerJoin('business_party', 'business_party.id', 'sales_invoice.party_id')
    .select([
      'sales_invoice.id as invoiceId',
      'voucher.voucher_number as voucherNumber',
      'sales_invoice.invoice_date as invoiceDate',
      'business_party.name as partyName',
      'business_party.gstin as partyGstin',
      'business_party.state_code as partyStateCode',
      'sales_invoice_line.hsn_sac_code as hsnSacCode',
      'sales_invoice_line.gst_rate_basis_points as gstRateBasisPoints',
      'sales_invoice_line.is_reverse_charge as isReverseCharge',
      'sales_invoice_line.amount as amount',
      'sales_invoice_line.cgst_amount as cgstAmount',
      'sales_invoice_line.sgst_amount as sgstAmount',
      'sales_invoice_line.igst_amount as igstAmount',
      'sales_invoice_line.cess_amount as cessAmount',
    ])
    .where('voucher.cancelled_at', 'is', null)
    .where('sales_invoice.invoice_date', '>=', range.fromDate)
    .where('sales_invoice.invoice_date', '<=', range.toDate)
    .where('sales_invoice_line.hsn_sac_code', 'is not', null)
    .execute();

  const b2bByInvoice = new Map<string, Gstr1B2bInvoiceRow>();
  const b2cByKey = new Map<string, Gstr1B2cSummaryRow>();
  const hsnByCode = new Map<string, Gstr1HsnSummaryRow>();

  for (const line of lines) {
    const hsnSacCode = line.hsnSacCode!;
    const hsnRow = hsnByCode.get(hsnSacCode) ?? { hsnSacCode, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cessAmount: 0 };
    hsnRow.taxableAmount += line.amount;
    hsnRow.cgstAmount += line.cgstAmount;
    hsnRow.sgstAmount += line.sgstAmount;
    hsnRow.igstAmount += line.igstAmount;
    hsnRow.cessAmount += line.cessAmount;
    hsnByCode.set(hsnSacCode, hsnRow);

    if (line.partyGstin) {
      const existing = b2bByInvoice.get(line.invoiceId);
      if (existing) {
        existing.taxableAmount += line.amount;
        existing.cgstAmount += line.cgstAmount;
        existing.sgstAmount += line.sgstAmount;
        existing.igstAmount += line.igstAmount;
        existing.cessAmount += line.cessAmount;
      } else {
        b2bByInvoice.set(line.invoiceId, {
          invoiceId: line.invoiceId,
          voucherNumber: line.voucherNumber,
          invoiceDate: line.invoiceDate,
          partyName: line.partyName,
          partyGstin: line.partyGstin,
          partyStateCode: line.partyStateCode,
          isReverseCharge: Boolean(line.isReverseCharge),
          taxableAmount: line.amount,
          cgstAmount: line.cgstAmount,
          sgstAmount: line.sgstAmount,
          igstAmount: line.igstAmount,
          cessAmount: line.cessAmount,
        });
      }
    } else {
      const ratePercent = (line.gstRateBasisPoints ?? 0) / 100;
      const key = `${line.partyStateCode ?? ''}|${ratePercent}`;
      const existing = b2cByKey.get(key) ?? { stateCode: line.partyStateCode, ratePercent, taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cessAmount: 0 };
      existing.taxableAmount += line.amount;
      existing.cgstAmount += line.cgstAmount;
      existing.sgstAmount += line.sgstAmount;
      existing.igstAmount += line.igstAmount;
      existing.cessAmount += line.cessAmount;
      b2cByKey.set(key, existing);
    }
  }

  return {
    b2bInvoices: Array.from(b2bByInvoice.values()).sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.voucherNumber - b.voucherNumber),
    b2cSummary: Array.from(b2cByKey.values()).sort((a, b) => (a.stateCode ?? '').localeCompare(b.stateCode ?? '') || a.ratePercent - b.ratePercent),
    hsnSummary: Array.from(hsnByCode.values()).sort((a, b) => a.hsnSacCode.localeCompare(b.hsnSacCode)),
  };
}

export interface Gstr3bData {
  /** Paise. Table 3.1(a): outward taxable supplies — includes RCM-marked sales at their taxable value, but tax collected (below) only from non-RCM ones (the recipient self-assesses an RCM sale's tax, we never collect it). */
  outwardTaxableValue: number;
  outwardCgst: number;
  outwardSgst: number;
  outwardIgst: number;
  outwardCess: number;
  /** Paise. Table 3.1(d): inward supplies liable to reverse charge — WE self-assessed these on our purchases. Must be paid in cash; NOT eligible for set-off against this period's ITC (a real statutory restriction, not modeled as available credit here). */
  rcmInwardTaxableValue: number;
  rcmInwardCgst: number;
  rcmInwardSgst: number;
  rcmInwardIgst: number;
  rcmInwardCess: number;
  /** Paise. Table 4: Input Tax Credit, split eligible (availed) vs ineligible/blocked. */
  itcEligibleCgst: number;
  itcEligibleSgst: number;
  itcEligibleIgst: number;
  itcEligibleCess: number;
  itcIneligibleCgst: number;
  itcIneligibleSgst: number;
  itcIneligibleIgst: number;
  itcIneligibleCess: number;
  /** Table 6.1: net payable on normal (non-RCM) outward supplies after set-off against eligible ITC — see core-gst-engine's computeGstSetOff. */
  netPayable: GstSetOffResult;
}

async function computeOutwardTotals(companyDb: Kysely<CompanyDatabase>, range: DateRange) {
  const row = await companyDb
    .selectFrom('sales_invoice_line')
    .innerJoin('sales_invoice', 'sales_invoice.id', 'sales_invoice_line.sales_invoice_id')
    .innerJoin('voucher', 'voucher.id', 'sales_invoice.voucher_id')
    .select(({ fn }) => [
      fn.sum<number>('sales_invoice_line.amount').as('taxableValue'),
      fn.sum<number>('sales_invoice_line.cgst_amount').as('cgst'),
      fn.sum<number>('sales_invoice_line.sgst_amount').as('sgst'),
      fn.sum<number>('sales_invoice_line.igst_amount').as('igst'),
      fn.sum<number>('sales_invoice_line.cess_amount').as('cess'),
    ])
    .where('voucher.cancelled_at', 'is', null)
    .where('sales_invoice.invoice_date', '>=', range.fromDate)
    .where('sales_invoice.invoice_date', '<=', range.toDate)
    .where('sales_invoice_line.hsn_sac_code', 'is not', null)
    .where('sales_invoice_line.is_reverse_charge', '=', IS_FALSE)
    .executeTakeFirst();
  const taxableRow = await companyDb
    .selectFrom('sales_invoice_line')
    .innerJoin('sales_invoice', 'sales_invoice.id', 'sales_invoice_line.sales_invoice_id')
    .innerJoin('voucher', 'voucher.id', 'sales_invoice.voucher_id')
    .select(({ fn }) => [fn.sum<number>('sales_invoice_line.amount').as('taxableValue')])
    .where('voucher.cancelled_at', 'is', null)
    .where('sales_invoice.invoice_date', '>=', range.fromDate)
    .where('sales_invoice.invoice_date', '<=', range.toDate)
    .where('sales_invoice_line.hsn_sac_code', 'is not', null)
    .executeTakeFirst();
  return {
    outwardTaxableValue: Number(taxableRow?.taxableValue ?? 0),
    outwardCgst: Number(row?.cgst ?? 0),
    outwardSgst: Number(row?.sgst ?? 0),
    outwardIgst: Number(row?.igst ?? 0),
    outwardCess: Number(row?.cess ?? 0),
  };
}

async function computeRcmInwardTotals(companyDb: Kysely<CompanyDatabase>, range: DateRange) {
  const row = await companyDb
    .selectFrom('purchase_invoice_line')
    .innerJoin('purchase_invoice', 'purchase_invoice.id', 'purchase_invoice_line.purchase_invoice_id')
    .innerJoin('voucher', 'voucher.id', 'purchase_invoice.voucher_id')
    .select(({ fn }) => [
      fn.sum<number>('purchase_invoice_line.amount').as('taxableValue'),
      fn.sum<number>('purchase_invoice_line.cgst_amount').as('cgst'),
      fn.sum<number>('purchase_invoice_line.sgst_amount').as('sgst'),
      fn.sum<number>('purchase_invoice_line.igst_amount').as('igst'),
      fn.sum<number>('purchase_invoice_line.cess_amount').as('cess'),
    ])
    .where('voucher.cancelled_at', 'is', null)
    .where('purchase_invoice.invoice_date', '>=', range.fromDate)
    .where('purchase_invoice.invoice_date', '<=', range.toDate)
    .where('purchase_invoice_line.hsn_sac_code', 'is not', null)
    .where('purchase_invoice_line.is_reverse_charge', '=', IS_TRUE)
    .executeTakeFirst();
  return {
    rcmInwardTaxableValue: Number(row?.taxableValue ?? 0),
    rcmInwardCgst: Number(row?.cgst ?? 0),
    rcmInwardSgst: Number(row?.sgst ?? 0),
    rcmInwardIgst: Number(row?.igst ?? 0),
    rcmInwardCess: Number(row?.cess ?? 0),
  };
}

async function computeItcTotals(companyDb: Kysely<CompanyDatabase>, range: DateRange, eligible: boolean) {
  const row = await companyDb
    .selectFrom('purchase_invoice_line')
    .innerJoin('purchase_invoice', 'purchase_invoice.id', 'purchase_invoice_line.purchase_invoice_id')
    .innerJoin('voucher', 'voucher.id', 'purchase_invoice.voucher_id')
    .select(({ fn }) => [
      fn.sum<number>('purchase_invoice_line.cgst_amount').as('cgst'),
      fn.sum<number>('purchase_invoice_line.sgst_amount').as('sgst'),
      fn.sum<number>('purchase_invoice_line.igst_amount').as('igst'),
      fn.sum<number>('purchase_invoice_line.cess_amount').as('cess'),
    ])
    .where('voucher.cancelled_at', 'is', null)
    .where('purchase_invoice.invoice_date', '>=', range.fromDate)
    .where('purchase_invoice.invoice_date', '<=', range.toDate)
    .where('purchase_invoice_line.hsn_sac_code', 'is not', null)
    .where('purchase_invoice_line.itc_eligible', '=', eligible ? IS_TRUE : IS_FALSE)
    .executeTakeFirst();
  return { cgst: Number(row?.cgst ?? 0), sgst: Number(row?.sgst ?? 0), igst: Number(row?.igst ?? 0), cess: Number(row?.cess ?? 0) };
}

/** Summary return prep for a period: Table 3.1 outward + 3.1(d) RCM inward, Table 4 ITC, Table 6.1 net payable. */
export async function computeGstr3bData(companyDb: Kysely<CompanyDatabase>, range: DateRange): Promise<Gstr3bData> {
  const outward = await computeOutwardTotals(companyDb, range);
  const rcmInward = await computeRcmInwardTotals(companyDb, range);
  const eligible = await computeItcTotals(companyDb, range, true);
  const ineligible = await computeItcTotals(companyDb, range, false);

  const netPayable = computeGstSetOff({
    outputCgst: outward.outwardCgst,
    outputSgst: outward.outwardSgst,
    outputIgst: outward.outwardIgst,
    outputCess: outward.outwardCess,
    inputCgst: eligible.cgst,
    inputSgst: eligible.sgst,
    inputIgst: eligible.igst,
    inputCess: eligible.cess,
  });

  return {
    ...outward,
    ...rcmInward,
    itcEligibleCgst: eligible.cgst,
    itcEligibleSgst: eligible.sgst,
    itcEligibleIgst: eligible.igst,
    itcEligibleCess: eligible.cess,
    itcIneligibleCgst: ineligible.cgst,
    itcIneligibleSgst: ineligible.sgst,
    itcIneligibleIgst: ineligible.igst,
    itcIneligibleCess: ineligible.cess,
    netPayable,
  };
}

export interface Gstr9Data extends Gstr3bData {
  financialYear: string;
  fromDate: string;
  toDate: string;
  hsnSummary: Gstr1HsnSummaryRow[];
}

/**
 * Annual return prep: the same GSTR-3B-shaped aggregation, for the whole
 * financial year instead of a single period, plus the year's HSN summary.
 * Part V of the real GSTR-9 (amendments to a prior FY declared in a LATER
 * FY's returns) is NOT modeled — this app has no concept of a return period
 * separate from the invoice's own date, so there's no data to report there;
 * flagged here rather than silently omitted.
 */
export async function computeGstr9Data(companyDb: Kysely<CompanyDatabase>, financialYearStartMonth: number, financialYear: string): Promise<Gstr9Data> {
  const { fromDate, toDate } = computeFinancialYearDateBounds(financialYearStartMonth, financialYear);
  const [gstr3b, gstr1] = await Promise.all([computeGstr3bData(companyDb, { fromDate, toDate }), computeGstr1Data(companyDb, { fromDate, toDate })]);
  return { ...gstr3b, financialYear, fromDate, toDate, hsnSummary: gstr1.hsnSummary };
}

export interface Gstr9cData {
  financialYear: string;
  /** Paise. Total income per audited books (Profit & Loss) for the FY — the actual GSTR-9C reconciliation basis. */
  turnoverPerBooks: number;
  /** Paise. Taxable value of GST-attracting outward supplies for the FY (sum of GSTR-1's own taxable values). */
  turnoverPerGstReturns: number;
  /**
   * Paise. turnoverPerBooks - turnoverPerGstReturns. A positive gap is
   * EXPECTED and normal — it's non-GST income (interest, other income with
   * no HSN/SAC) that never appears in a GST return. A gap in the other
   * direction (GST turnover exceeding book turnover) would be a real
   * discrepancy worth investigating, not something this pass can happen on
   * its own since GST turnover is always a subset of recorded sales.
   */
  turnoverReconciliationGap: number;
  /**
   * Paise. Total GST liability across the FY's outward supplies (informational only — this
   * app has no independently-sourced "tax as per books" figure distinct from the return
   * data itself, since both come from the same ledger; a genuine tax-side GSTR-9C
   * reconciliation needs a second, independent bookkeeping source this pass doesn't model.
   */
  totalTaxDeclaredForYear: number;
}

/** Reconciliation prep between audited financials and GST returns for a financial year — see Gstr9cData's own field comments for exactly what is and isn't a genuine independent reconciliation here. */
export async function computeGstr9cData(companyDb: Kysely<CompanyDatabase>, financialYearStartMonth: number, financialYear: string): Promise<Gstr9cData> {
  const { fromDate, toDate } = computeFinancialYearDateBounds(financialYearStartMonth, financialYear);
  const [pnl, gstr9] = await Promise.all([computeProfitAndLoss(companyDb, { fromDate, toDate }), computeGstr9Data(companyDb, financialYearStartMonth, financialYear)]);

  const turnoverPerBooks = pnl.totalIncome;
  const turnoverPerGstReturns = gstr9.outwardTaxableValue;
  const totalTaxDeclaredForYear = gstr9.outwardCgst + gstr9.outwardSgst + gstr9.outwardIgst + gstr9.outwardCess;

  return {
    financialYear,
    turnoverPerBooks,
    turnoverPerGstReturns,
    turnoverReconciliationGap: turnoverPerBooks - turnoverPerGstReturns,
    totalTaxDeclaredForYear,
  };
}
