import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import { cancelVoucherInTransaction, createVoucherInTransaction } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import { writeAuditLog } from '@mhts/core-audit';
import { getInventoryLedgerIds, getItemOrThrow, postPurchaseReceiptInTransaction, reverseStockMovementsForReferenceInTransaction } from '@mhts/core-inventory';
import { validateDocumentLines } from './lineValidation';
import { computeTdsAmount, cumulativeTaxableThisFinancialYear, resolveTdsRate } from './tds';
import type { CreatePurchaseInvoiceInput, DocumentLineInput, PurchaseInvoiceSummary } from './types';

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

function buildPurchaseVoucherLines(
  partyLedgerId: string,
  tdsPayableLedgerId: string | null,
  tdsAmount: number,
  lines: DocumentLineInput[],
): { voucherLines: VoucherLineInput[]; taxableAmount: number; taxAmount: number } {
  const taxByLedger = new Map<string, number>();
  let taxableAmount = 0;
  let taxAmount = 0;

  const voucherLines: VoucherLineInput[] = [];
  for (const line of lines) {
    voucherLines.push({ ledgerId: line.ledgerId, debitAmount: line.amount, creditAmount: 0, lineNarration: line.lineNarration });
    taxableAmount += line.amount;
    if (line.taxLedgerId && line.taxAmount) {
      taxByLedger.set(line.taxLedgerId, (taxByLedger.get(line.taxLedgerId) ?? 0) + line.taxAmount);
      taxAmount += line.taxAmount;
    }
  }
  for (const [taxLedgerId, amount] of taxByLedger) {
    voucherLines.push({ ledgerId: taxLedgerId, debitAmount: amount, creditAmount: 0 });
  }

  const grossTotal = taxableAmount + taxAmount;
  if (tdsAmount > 0) {
    if (!tdsPayableLedgerId) {
      throw new Error('TDS Payable ledger not found — seedSalesPurchaseLedgers must run at company creation');
    }
    voucherLines.push({ ledgerId: tdsPayableLedgerId, debitAmount: 0, creditAmount: tdsAmount });
  }
  voucherLines.push({ ledgerId: partyLedgerId, debitAmount: 0, creditAmount: grossTotal - tdsAmount });

  return { voucherLines, taxableAmount, taxAmount };
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
  const { voucherLines, taxAmount } = buildPurchaseVoucherLines(party.ledger_account_id, tdsPayableLedger?.id ?? null, tdsAmount, input.lines);

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
    })
    .execute();

  for (const line of input.lines) {
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
      fn.sum<number>('purchase_invoice_line.tax_amount').as('taxAmount'),
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
