import { randomUUID } from 'node:crypto';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import { cancelVoucherInTransaction, createVoucherInTransaction } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import { writeAuditLog } from '@mhts/core-audit';
import { getInventoryLedgerIds, getItemOrThrow, postSalesIssueInTransaction, reverseStockMovementsForReferenceInTransaction } from '@mhts/core-inventory';
import { getGstLedgerIds } from '@mhts/core-gst-engine';
import type { GstLedgerIds } from '@mhts/core-gst-engine';
import { validateDocumentLines } from './lineValidation';
import { resolveLineGstList } from './gstLineResolution';
import type { ResolvedLineGst } from './gstLineResolution';
import type { CreateSalesInvoiceInput, DocumentLineInput, InvoiceSummary } from './types';

/**
 * Builds the debit/credit voucher lines for a sales invoice: one credit per
 * income line, one credit per distinct tax ledger (summed — manual tax
 * ledgers AND, when a line carries a resolved GST split, the CGST/SGST/IGST/
 * Cess Payable ledgers), one debit to the party's own ledger for the grand
 * total. Shared shape with purchaseInvoices.ts (mirrored, not literally
 * shared, since debit/credit sides swap).
 */
function buildSalesVoucherLines(
  partyLedgerId: string,
  lines: DocumentLineInput[],
  lineGst: (ResolvedLineGst | null)[],
  gstLedgerIds: GstLedgerIds | null,
): { voucherLines: VoucherLineInput[]; taxableAmount: number; taxAmount: number } {
  const taxByLedger = new Map<string, number>();
  let taxableAmount = 0;
  let taxAmount = 0;

  const voucherLines: VoucherLineInput[] = [];
  lines.forEach((line, index) => {
    voucherLines.push({ ledgerId: line.ledgerId, debitAmount: 0, creditAmount: line.amount, lineNarration: line.lineNarration });
    taxableAmount += line.amount;
    if (line.taxLedgerId && line.taxAmount) {
      taxByLedger.set(line.taxLedgerId, (taxByLedger.get(line.taxLedgerId) ?? 0) + line.taxAmount);
      taxAmount += line.taxAmount;
    }
    const gst = lineGst[index];
    if (gst) {
      if (!gstLedgerIds) {
        throw new Error('GST ledgers not found — seedGstLedgers must run at company creation');
      }
      if (gst.cgstAmount > 0) taxByLedger.set(gstLedgerIds.cgstPayableLedgerId, (taxByLedger.get(gstLedgerIds.cgstPayableLedgerId) ?? 0) + gst.cgstAmount);
      if (gst.sgstAmount > 0) taxByLedger.set(gstLedgerIds.sgstPayableLedgerId, (taxByLedger.get(gstLedgerIds.sgstPayableLedgerId) ?? 0) + gst.sgstAmount);
      if (gst.igstAmount > 0) taxByLedger.set(gstLedgerIds.igstPayableLedgerId, (taxByLedger.get(gstLedgerIds.igstPayableLedgerId) ?? 0) + gst.igstAmount);
      if (gst.cessAmount > 0) taxByLedger.set(gstLedgerIds.cessPayableLedgerId, (taxByLedger.get(gstLedgerIds.cessPayableLedgerId) ?? 0) + gst.cessAmount);
      taxAmount += gst.totalTaxAmount;
    }
  });
  for (const [taxLedgerId, amount] of taxByLedger) {
    voucherLines.push({ ledgerId: taxLedgerId, debitAmount: 0, creditAmount: amount });
  }
  voucherLines.push({ ledgerId: partyLedgerId, debitAmount: taxableAmount + taxAmount, creditAmount: 0 });

  return { voucherLines, taxableAmount, taxAmount };
}

/**
 * The transaction-scoped half of createSalesInvoice — usable by a caller
 * (convertSalesOrderToInvoice) that needs the invoice-and-its-voucher AND
 * some other write (marking the source order CONVERTED) to commit or roll
 * back as a single unit, same reasoning as core-accounting's
 * createVoucherInTransaction.
 */
export async function createSalesInvoiceInTransaction(
  trx: Transaction<CompanyDatabase>,
  systemDb: Kysely<SystemDatabase>,
  input: CreateSalesInvoiceInput,
  actorUserId: string | null,
): Promise<string> {
  validateDocumentLines(input.lines);

  const party = await trx.selectFrom('business_party').selectAll().where('id', '=', input.partyId).executeTakeFirst();
  if (!party) {
    throw new Error('Party not found');
  }
  if (party.party_type !== 'CUSTOMER' && party.party_type !== 'BOTH') {
    throw new Error('This party is not set up as a customer');
  }
  if (!party.is_active) {
    throw new Error('This party is inactive');
  }

  const lineGst = await resolveLineGstList(systemDb, input.companyStateCode ?? null, party.state_code, input.invoiceDate, input.lines);
  const gstLedgerIds = lineGst.some((g) => g !== null) ? await getGstLedgerIds(trx) : null;
  const { voucherLines, taxableAmount, taxAmount } = buildSalesVoucherLines(party.ledger_account_id, input.lines, lineGst, gstLedgerIds);
  const invoiceId = randomUUID();

  // Each stockable item line moves stock (via core-inventory) AND contributes to one
  // self-balancing Dr COGS / Cr Stock-in-Hand pair appended to this SAME voucher — so
  // the invoice's revenue posting and its cost-of-goods posting are one atomic unit
  // (Rule #4), never two separate transactions that could disagree if one half failed.
  let totalCostPaise = 0;
  for (const line of input.lines) {
    if (!line.itemId) continue;
    const item = await getItemOrThrow(trx, line.itemId);
    if (item.item_type !== 'STOCKABLE') continue;
    const { costPaise } = await postSalesIssueInTransaction(
      trx,
      {
        itemId: line.itemId,
        warehouseId: line.warehouseId!,
        quantityThousandths: line.quantityThousandths!,
        batchId: line.batchId,
        movementDate: input.invoiceDate,
        referenceType: 'SALES_INVOICE',
        referenceId: invoiceId,
      },
      actorUserId,
    );
    totalCostPaise += costPaise;
  }
  if (totalCostPaise > 0) {
    const { stockInHandLedgerId, cogsLedgerId } = await getInventoryLedgerIds(trx);
    voucherLines.push({ ledgerId: cogsLedgerId, debitAmount: totalCostPaise, creditAmount: 0 });
    voucherLines.push({ ledgerId: stockInHandLedgerId, debitAmount: 0, creditAmount: totalCostPaise });
  }

  const { voucherId } = await createVoucherInTransaction(
    trx,
    {
      voucherType: 'SALES_INVOICE',
      financialYear: input.financialYear,
      voucherDate: input.invoiceDate,
      narration: input.narration,
      lines: voucherLines,
    },
    actorUserId,
  );

  await trx
    .insertInto('sales_invoice')
    .values({
      id: invoiceId,
      party_id: input.partyId,
      invoice_date: input.invoiceDate,
      narration: input.narration ?? null,
      voucher_id: voucherId,
      created_by: actorUserId,
    })
    .execute();

  for (const [index, line] of input.lines.entries()) {
    const gst = lineGst[index];
    await trx
      .insertInto('sales_invoice_line')
      .values({
        id: randomUUID(),
        sales_invoice_id: invoiceId,
        description: line.description,
        income_ledger_id: line.ledgerId,
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
      })
      .execute();
  }

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'SalesInvoice',
    entityId: invoiceId,
    afterData: { partyId: input.partyId, invoiceDate: input.invoiceDate, taxableAmount, taxAmount, voucherId },
  });

  return invoiceId;
}

/**
 * Posts a sales invoice as a real double-entry voucher AND inserts the
 * invoice/line rows, atomically (CLAUDE.md Rule #4) — this is the literal
 * "invoice-to-ledger" half of Phase 2's exit criterion. Opens its own
 * transaction; convertSalesOrderToInvoice uses createSalesInvoiceInTransaction
 * directly instead, so the order's status update can share the same
 * transaction as the invoice it produces.
 */
export async function createSalesInvoice(
  companyDb: Kysely<CompanyDatabase>,
  systemDb: Kysely<SystemDatabase>,
  input: CreateSalesInvoiceInput,
  actorUserId: string | null,
): Promise<string> {
  return companyDb.transaction().execute((trx) => createSalesInvoiceInTransaction(trx, systemDb, input, actorUserId));
}

/**
 * Cancels a sales invoice: reverses any stock movements its lines posted
 * (crediting back the exact FIFO layer(s) drawn from, or the equivalent
 * weighted-average pool amount) AND reverses its voucher (mirror-image GL
 * lines, including the COGS pair — just more lines on the same voucher) —
 * both in ONE transaction, so either both happen or neither does. Reversing
 * a SALES_ISSUE is always safe regardless of what's happened since (see
 * reverseStockMovementsForReferenceInTransaction); a plain invoice with no
 * stock movements reverses exactly as it always has.
 *
 * Keyed by voucherId (not the invoice's own id) so the generic Voucher
 * Register — which only ever has a voucher's id, for any voucher type — can
 * route a SALES_INVOICE row here just as naturally as the dedicated Sales
 * Invoice Register does.
 */
export async function cancelSalesInvoice(companyDb: Kysely<CompanyDatabase>, voucherId: string, reversalFinancialYear: string, reversalDate: string, actorUserId: string | null): Promise<string> {
  const invoice = await companyDb.selectFrom('sales_invoice').select(['id']).where('voucher_id', '=', voucherId).executeTakeFirst();
  if (!invoice) {
    throw new Error('Sales invoice not found for this voucher');
  }
  return companyDb.transaction().execute(async (trx) => {
    await reverseStockMovementsForReferenceInTransaction(trx, 'SALES_INVOICE', invoice.id, reversalDate, actorUserId);
    return cancelVoucherInTransaction(trx, voucherId, reversalFinancialYear, reversalDate, actorUserId);
  });
}

export async function listSalesInvoices(companyDb: Kysely<CompanyDatabase>): Promise<InvoiceSummary[]> {
  const rows = await companyDb
    .selectFrom('sales_invoice')
    .innerJoin('voucher', 'voucher.id', 'sales_invoice.voucher_id')
    .innerJoin('business_party', 'business_party.id', 'sales_invoice.party_id')
    .leftJoin('sales_invoice_line', 'sales_invoice_line.sales_invoice_id', 'sales_invoice.id')
    .select(({ fn }) => [
      'sales_invoice.id as id',
      'sales_invoice.voucher_id as voucherId',
      'voucher.voucher_number as voucherNumber',
      'voucher.financial_year as financialYear',
      'sales_invoice.party_id as partyId',
      'business_party.name as partyName',
      'sales_invoice.invoice_date as invoiceDate',
      'sales_invoice.narration as narration',
      'voucher.cancelled_at as cancelledAt',
      fn.sum<number>('sales_invoice_line.amount').as('taxableAmount'),
      // A line's tax is either the manual tax_amount OR the GST split (cgst+sgst+igst+cess) —
      // never both (lineValidation) — so summing all five is safe and covers both paths.
      sql<number>`SUM(sales_invoice_line.tax_amount + sales_invoice_line.cgst_amount + sales_invoice_line.sgst_amount + sales_invoice_line.igst_amount + sales_invoice_line.cess_amount)`.as('taxAmount'),
    ])
    .groupBy('sales_invoice.id')
    .orderBy('sales_invoice.invoice_date', 'desc')
    .orderBy('voucher.voucher_number', 'desc')
    .execute();

  return rows.map((row) => {
    const taxableAmount = Number(row.taxableAmount ?? 0);
    const taxAmount = Number(row.taxAmount ?? 0);
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
      totalAmount: taxableAmount + taxAmount,
      cancelledAt: row.cancelledAt,
    };
  });
}
