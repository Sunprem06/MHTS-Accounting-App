import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { createVoucherInTransaction } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import { writeAuditLog } from '@mhts/core-audit';

export interface OutstandingInvoiceRow {
  invoiceId: string;
  voucherId: string;
  voucherNumber: number;
  invoiceDate: string;
  /** Only meaningful for purchase invoices — null for sales invoices, which have no due date. */
  dueDate: string | null;
  partyId: string;
  partyName: string;
  /** Paise. Net of TDS for purchase invoices. */
  netAmount: number;
  /** Paise. Sum of prior settlements against non-cancelled vouchers. */
  settledAmount: number;
  /** Paise. netAmount - settledAmount. Only invoices with outstandingAmount > 0 are returned. */
  outstandingAmount: number;
}

/** Non-cancelled sales invoices with a remaining balance — what a Customer Receipt screen offers to settle against. */
export async function listOutstandingSalesInvoices(companyDb: Kysely<CompanyDatabase>, partyId?: string): Promise<OutstandingInvoiceRow[]> {
  let query = companyDb
    .selectFrom('sales_invoice')
    .innerJoin('voucher', 'voucher.id', 'sales_invoice.voucher_id')
    .innerJoin('business_party', 'business_party.id', 'sales_invoice.party_id')
    .leftJoin('sales_invoice_line', 'sales_invoice_line.sales_invoice_id', 'sales_invoice.id')
    .select(({ fn }) => [
      'sales_invoice.id as invoiceId',
      'sales_invoice.voucher_id as voucherId',
      'voucher.voucher_number as voucherNumber',
      'sales_invoice.invoice_date as invoiceDate',
      'sales_invoice.party_id as partyId',
      'business_party.name as partyName',
      fn.sum<number>('sales_invoice_line.amount').as('taxableAmount'),
      fn.sum<number>('sales_invoice_line.tax_amount').as('taxAmount'),
    ])
    .where('voucher.cancelled_at', 'is', null)
    .groupBy('sales_invoice.id');
  if (partyId) {
    query = query.where('sales_invoice.party_id', '=', partyId);
  }
  const invoices = await query.execute();

  const settled = await companyDb
    .selectFrom('sales_invoice_settlement')
    .innerJoin('voucher', 'voucher.id', 'sales_invoice_settlement.voucher_id')
    .select(({ fn }) => ['sales_invoice_settlement.sales_invoice_id as invoiceId', fn.sum<number>('sales_invoice_settlement.amount_applied').as('settled')])
    .where('voucher.cancelled_at', 'is', null)
    .groupBy('sales_invoice_settlement.sales_invoice_id')
    .execute();
  const settledByInvoice = new Map(settled.map((row) => [row.invoiceId, Number(row.settled ?? 0)]));

  return invoices
    .map((row) => {
      const netAmount = Number(row.taxableAmount ?? 0) + Number(row.taxAmount ?? 0);
      const settledAmount = settledByInvoice.get(row.invoiceId) ?? 0;
      return {
        invoiceId: row.invoiceId,
        voucherId: row.voucherId,
        voucherNumber: row.voucherNumber,
        invoiceDate: row.invoiceDate,
        dueDate: null,
        partyId: row.partyId,
        partyName: row.partyName,
        netAmount,
        settledAmount,
        outstandingAmount: netAmount - settledAmount,
      };
    })
    .filter((row) => row.outstandingAmount > 0)
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.voucherNumber - b.voucherNumber);
}

/** Non-cancelled purchase invoices with a remaining balance (net of TDS) — what a Supplier Payment screen offers to settle against. */
export async function listOutstandingPurchaseInvoices(companyDb: Kysely<CompanyDatabase>, partyId?: string): Promise<OutstandingInvoiceRow[]> {
  let query = companyDb
    .selectFrom('purchase_invoice')
    .innerJoin('voucher', 'voucher.id', 'purchase_invoice.voucher_id')
    .innerJoin('business_party', 'business_party.id', 'purchase_invoice.party_id')
    .leftJoin('purchase_invoice_line', 'purchase_invoice_line.purchase_invoice_id', 'purchase_invoice.id')
    .select(({ fn }) => [
      'purchase_invoice.id as invoiceId',
      'purchase_invoice.voucher_id as voucherId',
      'voucher.voucher_number as voucherNumber',
      'purchase_invoice.invoice_date as invoiceDate',
      'purchase_invoice.due_date as dueDate',
      'purchase_invoice.party_id as partyId',
      'business_party.name as partyName',
      'purchase_invoice.tds_amount as tdsAmount',
      fn.sum<number>('purchase_invoice_line.amount').as('taxableAmount'),
      fn.sum<number>('purchase_invoice_line.tax_amount').as('taxAmount'),
    ])
    .where('voucher.cancelled_at', 'is', null)
    .groupBy('purchase_invoice.id');
  if (partyId) {
    query = query.where('purchase_invoice.party_id', '=', partyId);
  }
  const invoices = await query.execute();

  const settled = await companyDb
    .selectFrom('purchase_invoice_settlement')
    .innerJoin('voucher', 'voucher.id', 'purchase_invoice_settlement.voucher_id')
    .select(({ fn }) => ['purchase_invoice_settlement.purchase_invoice_id as invoiceId', fn.sum<number>('purchase_invoice_settlement.amount_applied').as('settled')])
    .where('voucher.cancelled_at', 'is', null)
    .groupBy('purchase_invoice_settlement.purchase_invoice_id')
    .execute();
  const settledByInvoice = new Map(settled.map((row) => [row.invoiceId, Number(row.settled ?? 0)]));

  return invoices
    .map((row) => {
      const netAmount = Number(row.taxableAmount ?? 0) + Number(row.taxAmount ?? 0) - row.tdsAmount;
      const settledAmount = settledByInvoice.get(row.invoiceId) ?? 0;
      return {
        invoiceId: row.invoiceId,
        voucherId: row.voucherId,
        voucherNumber: row.voucherNumber,
        invoiceDate: row.invoiceDate,
        dueDate: row.dueDate,
        partyId: row.partyId,
        partyName: row.partyName,
        netAmount,
        settledAmount,
        outstandingAmount: netAmount - settledAmount,
      };
    })
    .filter((row) => row.outstandingAmount > 0)
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.voucherNumber - b.voucherNumber);
}

export interface SettlementLineInput {
  invoiceId: string;
  /** Paise. Must not exceed that invoice's current outstanding amount. */
  amount: number;
}

export interface RecordSalesReceiptInput {
  partyId: string;
  /** Cash/Bank ledger the money lands in. */
  depositLedgerId: string;
  receiptDate: string;
  financialYear: string;
  narration?: string;
  settlements: SettlementLineInput[];
}

export interface RecordPurchasePaymentInput {
  partyId: string;
  /** Cash/Bank ledger the money leaves from. */
  paymentLedgerId: string;
  paymentDate: string;
  financialYear: string;
  narration?: string;
  settlements: SettlementLineInput[];
}

function validateSettlements(settlements: SettlementLineInput[]): number {
  if (settlements.length === 0) {
    throw new Error('Select at least one invoice to settle');
  }
  let total = 0;
  for (const line of settlements) {
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      throw new Error('Every settlement amount must be a positive whole-paise amount');
    }
    total += line.amount;
  }
  return total;
}

/**
 * Records a customer receipt applied against one or more specific sales
 * invoices — a real RECEIPT voucher (Dr deposit ledger, Cr the customer's
 * ledger) plus the settlement rows linking it to those invoices, atomically
 * (Rule #4). This is additive: the existing generic ReceiptVoucherScreen
 * still works unchanged for receipts that aren't tied to a specific invoice
 * (e.g. an advance) — bill-wise allocation is an option, not a requirement.
 */
export async function recordSalesReceipt(companyDb: Kysely<CompanyDatabase>, input: RecordSalesReceiptInput, actorUserId: string | null): Promise<string> {
  const total = validateSettlements(input.settlements);

  const party = await companyDb.selectFrom('business_party').selectAll().where('id', '=', input.partyId).executeTakeFirst();
  if (!party) {
    throw new Error('Party not found');
  }
  if (party.party_type !== 'CUSTOMER' && party.party_type !== 'BOTH') {
    throw new Error('This party is not set up as a customer');
  }

  const outstanding = await listOutstandingSalesInvoices(companyDb, input.partyId);
  const outstandingByInvoice = new Map(outstanding.map((row) => [row.invoiceId, row.outstandingAmount]));
  for (const line of input.settlements) {
    const available = outstandingByInvoice.get(line.invoiceId);
    if (available === undefined) {
      throw new Error('One of the selected invoices is not an outstanding invoice for this customer');
    }
    if (line.amount > available) {
      throw new Error(`Settlement amount exceeds the invoice's remaining outstanding balance (₹${(available / 100).toFixed(2)})`);
    }
  }

  const voucherLines: VoucherLineInput[] = [
    { ledgerId: input.depositLedgerId, debitAmount: total, creditAmount: 0 },
    { ledgerId: party.ledger_account_id, debitAmount: 0, creditAmount: total },
  ];

  return companyDb.transaction().execute(async (trx) => {
    const { voucherId } = await createVoucherInTransaction(
      trx,
      { voucherType: 'RECEIPT', financialYear: input.financialYear, voucherDate: input.receiptDate, narration: input.narration, lines: voucherLines },
      actorUserId,
    );

    for (const line of input.settlements) {
      await trx
        .insertInto('sales_invoice_settlement')
        .values({ id: randomUUID(), sales_invoice_id: line.invoiceId, voucher_id: voucherId, amount_applied: line.amount })
        .execute();
    }

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'SalesInvoiceSettlement',
      entityId: voucherId,
      afterData: { partyId: input.partyId, total, settlements: input.settlements },
    });

    return voucherId;
  });
}

/** Mirror of recordSalesReceipt: a real PAYMENT voucher (Dr the supplier's ledger, Cr payment ledger) plus settlement rows against one or more purchase invoices. */
export async function recordPurchasePayment(companyDb: Kysely<CompanyDatabase>, input: RecordPurchasePaymentInput, actorUserId: string | null): Promise<string> {
  const total = validateSettlements(input.settlements);

  const party = await companyDb.selectFrom('business_party').selectAll().where('id', '=', input.partyId).executeTakeFirst();
  if (!party) {
    throw new Error('Party not found');
  }
  if (party.party_type !== 'SUPPLIER' && party.party_type !== 'BOTH') {
    throw new Error('This party is not set up as a supplier');
  }

  const outstanding = await listOutstandingPurchaseInvoices(companyDb, input.partyId);
  const outstandingByInvoice = new Map(outstanding.map((row) => [row.invoiceId, row.outstandingAmount]));
  for (const line of input.settlements) {
    const available = outstandingByInvoice.get(line.invoiceId);
    if (available === undefined) {
      throw new Error('One of the selected invoices is not an outstanding invoice for this supplier');
    }
    if (line.amount > available) {
      throw new Error(`Settlement amount exceeds the invoice's remaining outstanding balance (₹${(available / 100).toFixed(2)})`);
    }
  }

  const voucherLines: VoucherLineInput[] = [
    { ledgerId: party.ledger_account_id, debitAmount: total, creditAmount: 0 },
    { ledgerId: input.paymentLedgerId, debitAmount: 0, creditAmount: total },
  ];

  return companyDb.transaction().execute(async (trx) => {
    const { voucherId } = await createVoucherInTransaction(
      trx,
      { voucherType: 'PAYMENT', financialYear: input.financialYear, voucherDate: input.paymentDate, narration: input.narration, lines: voucherLines },
      actorUserId,
    );

    for (const line of input.settlements) {
      await trx
        .insertInto('purchase_invoice_settlement')
        .values({ id: randomUUID(), purchase_invoice_id: line.invoiceId, voucher_id: voucherId, amount_applied: line.amount })
        .execute();
    }

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'PurchaseInvoiceSettlement',
      entityId: voucherId,
      afterData: { partyId: input.partyId, total, settlements: input.settlements },
    });

    return voucherId;
  });
}
