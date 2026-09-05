import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { createVoucherInTransaction } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import { writeAuditLog } from '@mhts/core-audit';
import { validateDocumentLines } from './lineValidation';
import type { CreateSalesInvoiceInput, DocumentLineInput, InvoiceSummary } from './types';

/** Builds the debit/credit voucher lines for a sales invoice: one credit per income line, one credit per distinct tax ledger (summed), one debit to the party's own ledger for the grand total. Shared shape with purchaseInvoices.ts (mirrored, not literally shared, since debit/credit sides swap). */
function buildSalesVoucherLines(partyLedgerId: string, lines: DocumentLineInput[]): { voucherLines: VoucherLineInput[]; taxableAmount: number; taxAmount: number } {
  const taxByLedger = new Map<string, number>();
  let taxableAmount = 0;
  let taxAmount = 0;

  const voucherLines: VoucherLineInput[] = [];
  for (const line of lines) {
    voucherLines.push({ ledgerId: line.ledgerId, debitAmount: 0, creditAmount: line.amount, lineNarration: line.lineNarration });
    taxableAmount += line.amount;
    if (line.taxLedgerId && line.taxAmount) {
      taxByLedger.set(line.taxLedgerId, (taxByLedger.get(line.taxLedgerId) ?? 0) + line.taxAmount);
      taxAmount += line.taxAmount;
    }
  }
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

  const { voucherLines, taxableAmount, taxAmount } = buildSalesVoucherLines(party.ledger_account_id, input.lines);
  const invoiceId = randomUUID();

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

  for (const line of input.lines) {
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
export async function createSalesInvoice(companyDb: Kysely<CompanyDatabase>, input: CreateSalesInvoiceInput, actorUserId: string | null): Promise<string> {
  return companyDb.transaction().execute((trx) => createSalesInvoiceInTransaction(trx, input, actorUserId));
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
      fn.sum<number>('sales_invoice_line.tax_amount').as('taxAmount'),
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
