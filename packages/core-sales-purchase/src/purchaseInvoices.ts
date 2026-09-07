import { randomUUID } from 'node:crypto';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import { cancelVoucherInTransaction, convertForeignToBase, createVoucherInTransaction, foreignAmountForBase } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import { writeAuditLog } from '@mhts/core-audit';
import { getInventoryLedgerIds, getItemOrThrow, postPurchaseReceiptInTransaction, reverseStockMovementsForReferenceInTransaction } from '@mhts/core-inventory';
import { getGstLedgerIds } from '@mhts/core-gst-engine';
import type { GstLedgerIds } from '@mhts/core-gst-engine';
import { validateDocumentLines } from './lineValidation';
import { resolveLineGstList } from './gstLineResolution';
import type { ResolvedLineGst } from './gstLineResolution';
import { computeTdsAmount, cumulativeTaxableThisFinancialYear, resolveTdsRate } from './tds';
import type { CreatePurchaseInvoiceInput, DocumentLineInput, PurchaseInvoiceForPrint, PurchaseInvoiceForPrintLine, PurchaseInvoiceSummary } from './types';

const DEFAULT_MSME_CREDIT_DAYS = 45;
const DEFAULT_NON_MSME_CREDIT_DAYS = 30;

/**
 * Section 43B(h): an MSME vendor must be paid within its agreed credit
 * period or 45 days, whichever is earlier — simplified here to "45 days, or
 * the agreed period if shorter" since this pass doesn't track whether a
 * written agreement exists (the statutory fallback without one is actually
 * 15 days, not 45 — a known simplification, see Phase Tracker Open
 * Questions). Non-MSME vendors just get the party's own credit period, or a
 * plain 30-day business default.
 */
export function computeDueDate(invoiceDate: string, isMsmeVendor: boolean, creditPeriodDays: number | null): string {
  const days = isMsmeVendor ? Math.min(creditPeriodDays ?? DEFAULT_MSME_CREDIT_DAYS, DEFAULT_MSME_CREDIT_DAYS) : (creditPeriodDays ?? DEFAULT_NON_MSME_CREDIT_DAYS);
  const date = new Date(`${invoiceDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Purchase-side GST posting is the most involved of the four combinations
 * this function handles per line, since ITC eligibility and reverse charge
 * each change WHERE an amount lands without changing whether it's owed to
 * the supplier:
 *
 * - Normal (non-RCM) purchase: the supplier DID charge this GST, so it's
 *   always added to taxAmount (owed to them) — eligibility only decides
 *   whether the debit lands on an Input GST ledger (recoverable asset) or
 *   folds into the line's own ledger (cost, blocked credit).
 * - Reverse charge: the supplier never charged this GST at all, so it's
 *   EXCLUDED from taxAmount/what's owed to them — instead it posts a self-
 *   balancing Dr Input-or-cost / Cr RCM-Liability pair that never touches
 *   the party's own ledger.
 *
 * `forceItcIneligible` is true company-wide when the company itself is on
 * the composition scheme, which can never claim ITC regardless of what any
 * individual line's own itcEligible flag says.
 */
function buildPurchaseVoucherLines(
  partyLedgerId: string,
  tdsPayableLedgerId: string | null,
  tdsAmount: number,
  lines: DocumentLineInput[],
  lineGst: (ResolvedLineGst | null)[],
  gstLedgerIds: GstLedgerIds | null,
  forceItcIneligible: boolean,
  branchId: string | undefined,
  fx: { currency: string; exchangeRateMicros: number } | undefined,
): { voucherLines: VoucherLineInput[]; taxableAmount: number; taxAmount: number; lineEligibility: boolean[] } {
  const debitTaxByLedger = new Map<string, number>();
  const rcmLiabilityByLedger = new Map<string, number>();
  const lineEligibility: boolean[] = [];
  let taxableAmount = 0;
  let taxAmount = 0;

  function addDebit(ledgerId: string, amount: number): void {
    debitTaxByLedger.set(ledgerId, (debitTaxByLedger.get(ledgerId) ?? 0) + amount);
  }
  function addRcmCredit(ledgerId: string, amount: number): void {
    rcmLiabilityByLedger.set(ledgerId, (rcmLiabilityByLedger.get(ledgerId) ?? 0) + amount);
  }

  const voucherLines: VoucherLineInput[] = [];
  lines.forEach((line, index) => {
    let ownLedgerExtraDebit = 0;
    // Recorded on every line (not just ones with a GST split) so the stored
    // itc_eligible column always reflects the EFFECTIVE eligibility a future
    // GSTR-3B/9 aggregation can trust — true by default for a line with no
    // GST at all (there's nothing to be ineligible about).
    let eligible = true;

    if (line.taxLedgerId && line.taxAmount) {
      addDebit(line.taxLedgerId, line.taxAmount);
      taxAmount += line.taxAmount;
    }

    const gst = lineGst[index];
    if (gst) {
      if (!gstLedgerIds) {
        throw new Error('GST ledgers not found — seedGstLedgers must run at company creation');
      }
      eligible = !forceItcIneligible && (line.itcEligible ?? true);

      if (line.isReverseCharge) {
        if (eligible) {
          if (gst.cgstAmount > 0) addDebit(gstLedgerIds.cgstInputLedgerId, gst.cgstAmount);
          if (gst.sgstAmount > 0) addDebit(gstLedgerIds.sgstInputLedgerId, gst.sgstAmount);
          if (gst.igstAmount > 0) addDebit(gstLedgerIds.igstInputLedgerId, gst.igstAmount);
          if (gst.cessAmount > 0) addDebit(gstLedgerIds.cessInputLedgerId, gst.cessAmount);
        } else {
          ownLedgerExtraDebit += gst.totalTaxAmount;
        }
        if (gst.cgstAmount > 0) addRcmCredit(gstLedgerIds.cgstRcmPayableLedgerId, gst.cgstAmount);
        if (gst.sgstAmount > 0) addRcmCredit(gstLedgerIds.sgstRcmPayableLedgerId, gst.sgstAmount);
        if (gst.igstAmount > 0) addRcmCredit(gstLedgerIds.igstRcmPayableLedgerId, gst.igstAmount);
        if (gst.cessAmount > 0) addRcmCredit(gstLedgerIds.cessRcmPayableLedgerId, gst.cessAmount);
        // taxAmount deliberately NOT incremented — the supplier never charged this.
      } else {
        taxAmount += gst.totalTaxAmount;
        if (eligible) {
          if (gst.cgstAmount > 0) addDebit(gstLedgerIds.cgstInputLedgerId, gst.cgstAmount);
          if (gst.sgstAmount > 0) addDebit(gstLedgerIds.sgstInputLedgerId, gst.sgstAmount);
          if (gst.igstAmount > 0) addDebit(gstLedgerIds.igstInputLedgerId, gst.igstAmount);
          if (gst.cessAmount > 0) addDebit(gstLedgerIds.cessInputLedgerId, gst.cessAmount);
        } else {
          ownLedgerExtraDebit += gst.totalTaxAmount;
        }
      }
    }

    voucherLines.push({ ledgerId: line.ledgerId, debitAmount: line.amount + ownLedgerExtraDebit, creditAmount: 0, lineNarration: line.lineNarration, branchId });
    taxableAmount += line.amount;
    lineEligibility.push(eligible);
  });

  for (const [ledgerId, amount] of debitTaxByLedger) {
    voucherLines.push({ ledgerId, debitAmount: amount, creditAmount: 0, branchId });
  }
  for (const [ledgerId, amount] of rcmLiabilityByLedger) {
    voucherLines.push({ ledgerId, debitAmount: 0, creditAmount: amount, branchId });
  }

  const grossTotal = taxableAmount + taxAmount;
  if (tdsAmount > 0) {
    if (!tdsPayableLedgerId) {
      throw new Error('TDS Payable ledger not found — seedSalesPurchaseLedgers must run at company creation');
    }
    voucherLines.push({ ledgerId: tdsPayableLedgerId, debitAmount: 0, creditAmount: tdsAmount, branchId });
  }
  const partyNet = grossTotal - tdsAmount;
  voucherLines.push({
    ledgerId: partyLedgerId,
    debitAmount: 0,
    creditAmount: partyNet,
    branchId,
    ...(fx ? { foreignCurrency: fx.currency, exchangeRateMicros: fx.exchangeRateMicros, foreignAmount: foreignAmountForBase(partyNet, fx.exchangeRateMicros) } : {}),
  });

  return { voucherLines, taxableAmount, taxAmount, lineEligibility };
}

/**
 * The transaction-scoped half of createPurchaseInvoice — usable by
 * convertPurchaseOrderToInvoice so the invoice's ledger posting and the
 * source order's status update commit or roll back as one unit, same
 * reasoning as createSalesInvoiceInTransaction. `systemDb` (TDS rate lookup)
 * is a separate encrypted file/connection from the company DB, so it's
 * queried directly regardless of the company DB's transaction state — there
 * is no cross-file transaction to join.
 */
export async function createPurchaseInvoiceInTransaction(
  trx: Transaction<CompanyDatabase>,
  systemDb: Kysely<SystemDatabase>,
  input: CreatePurchaseInvoiceInput,
  actorUserId: string | null,
): Promise<string> {
  validateDocumentLines(input.lines);
  if (input.currency && !input.exchangeRateMicros) {
    throw new Error('An exchange rate is required when an invoice currency is set');
  }
  if (input.exchangeRateMicros) {
    for (const line of input.lines) {
      if (line.foreignAmount !== undefined && convertForeignToBase(line.foreignAmount, input.exchangeRateMicros) !== line.amount) {
        throw new Error(`Line amount does not match the foreign amount converted at the invoice's exchange rate (line: "${line.description}")`);
      }
    }
  }

  const party = await trx.selectFrom('business_party').selectAll().where('id', '=', input.partyId).executeTakeFirst();
  if (!party) {
    throw new Error('Party not found');
  }
  if (party.party_type !== 'SUPPLIER' && party.party_type !== 'BOTH') {
    throw new Error('This party is not set up as a supplier');
  }
  if (!party.is_active) {
    throw new Error('This party is inactive');
  }

  const taxableAmount = input.lines.reduce((sum, line) => sum + line.amount, 0);

  let tdsAmount = 0;
  if (input.tdsSection) {
    const rate = await resolveTdsRate(systemDb, input.tdsSection, input.invoiceDate);
    if (!rate) {
      throw new Error(`No TDS rate configured for section ${input.tdsSection} as of ${input.invoiceDate}`);
    }
    const priorCumulative = await cumulativeTaxableThisFinancialYear(trx, input.partyId, input.tdsSection, input.financialYear);
    tdsAmount = computeTdsAmount(priorCumulative, taxableAmount, rate.thresholdAmount, rate.ratePercent);
  }

  const tdsPayableLedger = await trx.selectFrom('ledger_account').select('id').where('name', '=', 'TDS Payable').executeTakeFirst();
  const lineGst = await resolveLineGstList(systemDb, input.companyStateCode ?? null, party.state_code, input.invoiceDate, input.lines);
  const gstLedgerIds = lineGst.some((g) => g !== null) ? await getGstLedgerIds(trx) : null;
  // A composition-scheme company can never claim ITC — see buildPurchaseVoucherLines's own doc comment.
  const forceItcIneligible = input.companyGstRegistrationType === 'COMPOSITION';
  const fx = input.currency && input.exchangeRateMicros ? { currency: input.currency, exchangeRateMicros: input.exchangeRateMicros } : undefined;
  const { voucherLines, taxAmount, lineEligibility } = buildPurchaseVoucherLines(
    party.ledger_account_id,
    tdsPayableLedger?.id ?? null,
    tdsAmount,
    input.lines,
    lineGst,
    gstLedgerIds,
    forceItcIneligible,
    input.branchId,
    fx,
  );

  const invoiceId = randomUUID();

  // A stockable line's debit MUST land on Stock-in-Hand (never an arbitrary
  // expense ledger the user happened to pick) — otherwise the item-level
  // stock position and the GL would silently disagree about where the
  // purchased value went. No extra voucher lines are needed beyond that:
  // buildPurchaseVoucherLines already debits line.ledgerId, which for a
  // stockable line now IS the Stock-in-Hand debit.
  const stockableLines = input.lines.filter((line) => line.itemId);
  if (stockableLines.length > 0) {
    const { stockInHandLedgerId } = await getInventoryLedgerIds(trx);
    for (const line of stockableLines) {
      const item = await getItemOrThrow(trx, line.itemId!);
      if (item.item_type !== 'STOCKABLE') continue;
      if (line.ledgerId !== stockInHandLedgerId) {
        throw new Error('A stockable item line must post to the Stock-in-Hand ledger');
      }
      await postPurchaseReceiptInTransaction(
        trx,
        {
          itemId: line.itemId!,
          warehouseId: line.warehouseId!,
          quantityThousandths: line.quantityThousandths!,
          ratePaise: line.ratePaise!,
          batchNumber: line.batchNumber,
          expiryDate: line.expiryDate,
          manufactureDate: line.manufactureDate,
          movementDate: input.invoiceDate,
          referenceType: 'PURCHASE_INVOICE',
          referenceId: invoiceId,
        },
        actorUserId,
      );
    }
  }

  const isMsmeVendor = Boolean(party.is_msme_udyam_registered);
  const dueDate = computeDueDate(input.invoiceDate, isMsmeVendor, party.credit_period_days);

  const { voucherId } = await createVoucherInTransaction(
    trx,
    {
      voucherType: 'PURCHASE_INVOICE',
      financialYear: input.financialYear,
      voucherDate: input.invoiceDate,
      narration: input.narration,
      lines: voucherLines,
    },
    actorUserId,
  );

  await trx
    .insertInto('purchase_invoice')
    .values({
      id: invoiceId,
      party_id: input.partyId,
      invoice_date: input.invoiceDate,
      narration: input.narration ?? null,
      voucher_id: voucherId,
      is_msme_vendor: isMsmeVendor ? 1 : 0,
      due_date: dueDate,
      tds_section: input.tdsSection ?? null,
      tds_amount: tdsAmount,
      created_by: actorUserId,
      currency: input.currency ?? null,
      exchange_rate_micros: input.exchangeRateMicros ?? null,
      branch_id: input.branchId ?? null,
    })
    .execute();

  for (const [index, line] of input.lines.entries()) {
    const gst = lineGst[index];
    await trx
      .insertInto('purchase_invoice_line')
      .values({
        id: randomUUID(),
        purchase_invoice_id: invoiceId,
        description: line.description,
        expense_ledger_id: line.ledgerId,
        amount: line.amount,
        tax_ledger_id: line.taxLedgerId ?? null,
        tax_amount: line.taxAmount ?? 0,
        line_narration: line.lineNarration ?? null,
        hsn_sac_code: gst ? line.hsnSacCode!.trim() : null,
        gst_rate_basis_points: gst ? Math.round(gst.ratePercent * 100) : null,
        cess_rate_basis_points: gst ? Math.round(gst.cessPercent * 100) : null,
        cgst_amount: gst?.cgstAmount ?? 0,
        sgst_amount: gst?.sgstAmount ?? 0,
        igst_amount: gst?.igstAmount ?? 0,
        cess_amount: gst?.cessAmount ?? 0,
        itc_eligible: lineEligibility[index] ? 1 : 0,
        itc_ineligibility_reason: lineEligibility[index] ? null : (line.itcIneligibilityReason ?? null),
        is_reverse_charge: line.isReverseCharge ? 1 : 0,
        foreign_amount: line.foreignAmount ?? null,
        // Phase 9 Increment 2 (Print + Templates) — persisted so a printed purchase invoice can show Qty/Rate; previously computed for stock-receipt purposes only and discarded (same gap Phase 9 Increment 1 closed for sales_invoice_line).
        item_id: line.itemId ?? null,
        quantity_thousandths: line.quantityThousandths ?? null,
        rate_paise: line.ratePaise ?? null,
      })
      .execute();
  }

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'PurchaseInvoice',
    entityId: invoiceId,
    afterData: { partyId: input.partyId, invoiceDate: input.invoiceDate, taxableAmount, taxAmount, tdsSection: input.tdsSection ?? null, tdsAmount, dueDate, voucherId },
  });

  return invoiceId;
}

/**
 * Posts a purchase invoice as a real double-entry voucher AND inserts the
 * invoice/line rows atomically (Rule #4), same pattern as createSalesInvoice.
 * Additionally: stamps the party's current MSME flag (43B(h) ageing
 * shouldn't move if the party record changes later) and, if a TDS section is
 * given, resolves that section's CURRENT rate from the versioned rule_set
 * table (never a hardcoded number — Rule #2) and applies threshold-aware
 * deduction, crediting a TDS Payable ledger for the amount withheld from the
 * supplier.
 */
export async function createPurchaseInvoice(
  companyDb: Kysely<CompanyDatabase>,
  systemDb: Kysely<SystemDatabase>,
  input: CreatePurchaseInvoiceInput,
  actorUserId: string | null,
): Promise<string> {
  return companyDb.transaction().execute((trx) => createPurchaseInvoiceInTransaction(trx, systemDb, input, actorUserId));
}

/**
 * Mirror of cancelSalesInvoice, reversing PURCHASE_RECEIPT movements instead
 * of SALES_ISSUE ones, and keyed the same way (by voucherId, not the
 * invoice's own id — see cancelSalesInvoice's comment). Unlike a sale,
 * reversing a receipt is NOT always safe —
 * reverseStockMovementsForReferenceInTransaction throws (rolling back the
 * whole cancellation) if any of the received quantity has already been
 * issued, adjusted out, or transferred to another warehouse.
 */
export async function cancelPurchaseInvoice(companyDb: Kysely<CompanyDatabase>, voucherId: string, reversalFinancialYear: string, reversalDate: string, actorUserId: string | null): Promise<string> {
  const invoice = await companyDb.selectFrom('purchase_invoice').select(['id']).where('voucher_id', '=', voucherId).executeTakeFirst();
  if (!invoice) {
    throw new Error('Purchase invoice not found for this voucher');
  }
  return companyDb.transaction().execute(async (trx) => {
    await reverseStockMovementsForReferenceInTransaction(trx, 'PURCHASE_INVOICE', invoice.id, reversalDate, actorUserId);
    return cancelVoucherInTransaction(trx, voucherId, reversalFinancialYear, reversalDate, actorUserId);
  });
}

export async function listPurchaseInvoices(companyDb: Kysely<CompanyDatabase>): Promise<PurchaseInvoiceSummary[]> {
  const rows = await companyDb
    .selectFrom('purchase_invoice')
    .innerJoin('voucher', 'voucher.id', 'purchase_invoice.voucher_id')
    .innerJoin('business_party', 'business_party.id', 'purchase_invoice.party_id')
    .leftJoin('purchase_invoice_line', 'purchase_invoice_line.purchase_invoice_id', 'purchase_invoice.id')
    .select(({ fn }) => [
      'purchase_invoice.id as id',
      'purchase_invoice.voucher_id as voucherId',
      'voucher.voucher_number as voucherNumber',
      'voucher.financial_year as financialYear',
      'purchase_invoice.party_id as partyId',
      'business_party.name as partyName',
      'purchase_invoice.invoice_date as invoiceDate',
      'purchase_invoice.narration as narration',
      'voucher.cancelled_at as cancelledAt',
      'purchase_invoice.is_msme_vendor as isMsmeVendor',
      'purchase_invoice.due_date as dueDate',
      'purchase_invoice.tds_section as tdsSection',
      'purchase_invoice.tds_amount as tdsAmount',
      fn.sum<number>('purchase_invoice_line.amount').as('taxableAmount'),
      // See listSalesInvoices for why summing all five tax columns is safe: a line's tax
      // is either the manual tax_amount OR the GST split, never both (lineValidation).
      sql<number>`SUM(purchase_invoice_line.tax_amount + purchase_invoice_line.cgst_amount + purchase_invoice_line.sgst_amount + purchase_invoice_line.igst_amount + purchase_invoice_line.cess_amount)`.as('taxAmount'),
    ])
    .groupBy('purchase_invoice.id')
    .orderBy('purchase_invoice.invoice_date', 'desc')
    .orderBy('voucher.voucher_number', 'desc')
    .execute();

  return rows.map((row) => {
    const taxableAmount = Number(row.taxableAmount ?? 0);
    const taxAmount = Number(row.taxAmount ?? 0);
    const totalAmount = taxableAmount + taxAmount;
    return {
      id: row.id,
      voucherId: row.voucherId,
      voucherNumber: row.voucherNumber,
      financialYear: row.financialYear,
      partyId: row.partyId,
      partyName: row.partyName,
      invoiceDate: row.invoiceDate,
      narration: row.narration,
      taxableAmount,
      taxAmount,
      totalAmount,
      cancelledAt: row.cancelledAt,
      isMsmeVendor: Boolean(row.isMsmeVendor),
      dueDate: row.dueDate,
      tdsSection: row.tdsSection,
      tdsAmount: row.tdsAmount,
      netPayable: totalAmount - row.tdsAmount,
    };
  });
}

/** Phase 9 Increment 2 (Print + Templates) — full header+lines+party assembly for a printed purchase invoice, mirroring getSalesInvoiceForPrint. All money/quantity fields stay paise/thousandths (converted at the IPC boundary). */
export async function getPurchaseInvoiceForPrint(companyDb: Kysely<CompanyDatabase>, invoiceId: string): Promise<PurchaseInvoiceForPrint> {
  const header = await companyDb
    .selectFrom('purchase_invoice')
    .innerJoin('voucher', 'voucher.id', 'purchase_invoice.voucher_id')
    .innerJoin('business_party', 'business_party.id', 'purchase_invoice.party_id')
    .select([
      'purchase_invoice.invoice_date as invoiceDate',
      'purchase_invoice.narration as narration',
      'purchase_invoice.currency as currency',
      'purchase_invoice.is_msme_vendor as isMsmeVendor',
      'purchase_invoice.due_date as dueDate',
      'purchase_invoice.tds_section as tdsSection',
      'purchase_invoice.tds_amount as tdsAmount',
      'voucher.voucher_number as voucherNumber',
      'voucher.financial_year as financialYear',
      'voucher.cancelled_at as cancelledAt',
      'business_party.name as partyName',
      'business_party.gstin as partyGstin',
      'business_party.state_code as partyStateCode',
      'business_party.address as partyAddress',
    ])
    .where('purchase_invoice.id', '=', invoiceId)
    .executeTakeFirst();
  if (!header) {
    throw new Error('Purchase invoice not found');
  }

  const lineRows = await companyDb
    .selectFrom('purchase_invoice_line')
    .leftJoin('item', 'item.id', 'purchase_invoice_line.item_id')
    .leftJoin('unit_of_measure', 'unit_of_measure.id', 'item.unit_id')
    .select([
      'purchase_invoice_line.description as description',
      'purchase_invoice_line.hsn_sac_code as hsnSacCode',
      'item.name as itemName',
      'purchase_invoice_line.quantity_thousandths as quantityThousandths',
      'unit_of_measure.symbol as unitSymbol',
      'purchase_invoice_line.rate_paise as ratePaise',
      'purchase_invoice_line.amount as taxableAmount',
      'purchase_invoice_line.gst_rate_basis_points as gstRateBasisPoints',
      'purchase_invoice_line.cgst_amount as cgstAmount',
      'purchase_invoice_line.sgst_amount as sgstAmount',
      'purchase_invoice_line.igst_amount as igstAmount',
      'purchase_invoice_line.cess_amount as cessAmount',
      'purchase_invoice_line.tax_amount as manualTaxAmount',
    ])
    .where('purchase_invoice_line.purchase_invoice_id', '=', invoiceId)
    .execute();

  const lines: PurchaseInvoiceForPrintLine[] = lineRows.map((l) => ({
    description: l.description,
    hsnSacCode: l.hsnSacCode,
    itemName: l.itemName,
    quantityThousandths: l.quantityThousandths,
    unitSymbol: l.unitSymbol,
    ratePaise: l.ratePaise,
    taxableAmount: l.taxableAmount,
    gstRatePercent: l.gstRateBasisPoints !== null ? l.gstRateBasisPoints / 100 : null,
    cgstAmount: l.cgstAmount,
    sgstAmount: l.sgstAmount,
    igstAmount: l.igstAmount,
    cessAmount: l.cessAmount,
    manualTaxAmount: l.manualTaxAmount,
  }));

  const totals = lines.reduce(
    (acc, l) => ({
      taxableAmount: acc.taxableAmount + l.taxableAmount,
      cgstAmount: acc.cgstAmount + l.cgstAmount,
      sgstAmount: acc.sgstAmount + l.sgstAmount,
      igstAmount: acc.igstAmount + l.igstAmount,
      cessAmount: acc.cessAmount + l.cessAmount,
      manualTaxAmount: acc.manualTaxAmount + l.manualTaxAmount,
    }),
    { taxableAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cessAmount: 0, manualTaxAmount: 0 },
  );
  const totalAmount = totals.taxableAmount + totals.cgstAmount + totals.sgstAmount + totals.igstAmount + totals.cessAmount + totals.manualTaxAmount;

  return {
    voucherNumber: header.voucherNumber,
    financialYear: header.financialYear,
    invoiceDate: header.invoiceDate,
    narration: header.narration,
    cancelledAt: header.cancelledAt,
    partyName: header.partyName,
    partyGstin: header.partyGstin,
    partyStateCode: header.partyStateCode,
    partyAddress: header.partyAddress,
    currency: header.currency,
    isMsmeVendor: Boolean(header.isMsmeVendor),
    dueDate: header.dueDate,
    tdsSection: header.tdsSection,
    tdsAmount: header.tdsAmount,
    lines,
    ...totals,
    totalAmount,
  };
}
