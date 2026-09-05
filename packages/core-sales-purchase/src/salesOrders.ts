import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { validateDocumentLines } from './lineValidation';
import { createSalesInvoiceInTransaction } from './salesInvoices';
import type { CreateSalesInvoiceInput, CreateSalesOrderInput, OrderStatus, OrderSummary } from './types';

/** An order has no ledger impact (it isn't a financial transaction yet), so it needs its own sequential numbering per financial year — vouchers don't exist for it to borrow numbering from, unlike an invoice. */
export async function createSalesOrder(companyDb: Kysely<CompanyDatabase>, input: CreateSalesOrderInput, actorUserId: string | null): Promise<string> {
  validateDocumentLines(input.lines);

  const party = await companyDb.selectFrom('business_party').selectAll().where('id', '=', input.partyId).executeTakeFirst();
  if (!party) {
    throw new Error('Party not found');
  }
  if (party.party_type !== 'CUSTOMER' && party.party_type !== 'BOTH') {
    throw new Error('This party is not set up as a customer');
  }

  const orderId = randomUUID();

  await companyDb.transaction().execute(async (trx) => {
    const maxNumberRow = await trx
      .selectFrom('sales_order')
      .select(({ fn }) => fn.max('order_number').as('maxNumber'))
      .where('financial_year', '=', input.financialYear)
      .executeTakeFirst();
    const orderNumber = (maxNumberRow?.maxNumber ?? 0) + 1;

    await trx
      .insertInto('sales_order')
      .values({
        id: orderId,
        financial_year: input.financialYear,
        order_number: orderNumber,
        party_id: input.partyId,
        order_date: input.orderDate,
        status: 'DRAFT' satisfies OrderStatus,
        narration: input.narration ?? null,
        converted_to_invoice_id: null,
        created_by: actorUserId,
      })
      .execute();

    for (const line of input.lines) {
      await trx
        .insertInto('sales_order_line')
        .values({
          id: randomUUID(),
          sales_order_id: orderId,
          description: line.description,
          income_ledger_id: line.ledgerId,
          amount: line.amount,
          tax_ledger_id: line.taxLedgerId ?? null,
          tax_amount: line.taxAmount ?? 0,
          line_narration: line.lineNarration ?? null,
        })
        .execute();
    }

    await writeAuditLog(trx, { actorUserId, action: 'CREATE', entityType: 'SalesOrder', entityId: orderId, afterData: { partyId: input.partyId, orderDate: input.orderDate } });
  });

  return orderId;
}

export async function listSalesOrders(companyDb: Kysely<CompanyDatabase>): Promise<OrderSummary[]> {
  const rows = await companyDb
    .selectFrom('sales_order')
    .innerJoin('business_party', 'business_party.id', 'sales_order.party_id')
    .leftJoin('sales_order_line', 'sales_order_line.sales_order_id', 'sales_order.id')
    .select(({ fn }) => [
      'sales_order.id as id',
      'sales_order.order_number as orderNumber',
      'sales_order.financial_year as financialYear',
      'sales_order.party_id as partyId',
      'business_party.name as partyName',
      'sales_order.order_date as orderDate',
      'sales_order.status as status',
      'sales_order.narration as narration',
      'sales_order.converted_to_invoice_id as convertedToInvoiceId',
      fn.sum<number>('sales_order_line.amount').as('taxableAmount'),
      fn.sum<number>('sales_order_line.tax_amount').as('taxAmount'),
    ])
    .groupBy('sales_order.id')
    .orderBy('sales_order.order_date', 'desc')
    .orderBy('sales_order.order_number', 'desc')
    .execute();

  return rows.map((row) => {
    const taxableAmount = Number(row.taxableAmount ?? 0);
    const taxAmount = Number(row.taxAmount ?? 0);
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      financialYear: row.financialYear,
      partyId: row.partyId,
      partyName: row.partyName,
      orderDate: row.orderDate,
      status: row.status as OrderStatus,
      narration: row.narration,
      taxableAmount,
      taxAmount,
      totalAmount: taxableAmount + taxAmount,
      convertedToInvoiceId: row.convertedToInvoiceId,
    };
  });
}

async function transitionStatus(companyDb: Kysely<CompanyDatabase>, orderId: string, from: OrderStatus[], to: OrderStatus, actorUserId: string | null): Promise<void> {
  const order = await companyDb.selectFrom('sales_order').selectAll().where('id', '=', orderId).executeTakeFirst();
  if (!order) {
    throw new Error('Sales order not found');
  }
  if (!from.includes(order.status as OrderStatus)) {
    throw new Error(`Cannot move a ${order.status} order to ${to}`);
  }

  await companyDb.transaction().execute(async (trx) => {
    await trx.updateTable('sales_order').set({ status: to }).where('id', '=', orderId).execute();
    await writeAuditLog(trx, { actorUserId, action: 'UPDATE', entityType: 'SalesOrder', entityId: orderId, beforeData: { status: order.status }, afterData: { status: to } });
  });
}

export function confirmSalesOrder(companyDb: Kysely<CompanyDatabase>, orderId: string, actorUserId: string | null): Promise<void> {
  return transitionStatus(companyDb, orderId, ['DRAFT'], 'CONFIRMED', actorUserId);
}

export function cancelSalesOrder(companyDb: Kysely<CompanyDatabase>, orderId: string, actorUserId: string | null): Promise<void> {
  return transitionStatus(companyDb, orderId, ['DRAFT', 'CONFIRMED'], 'CANCELLED', actorUserId);
}

/**
 * Copies a confirmed order's lines into a brand-new sales invoice (real
 * ledger posting) and marks the order CONVERTED — an order itself never
 * touches the ledger until this happens. Both writes share ONE transaction
 * (via createSalesInvoiceInTransaction, not the standalone createSalesInvoice)
 * so a crash mid-conversion can never leave a posted invoice pointing at an
 * order that still reads CONFIRMED (which would let a retry double-invoice
 * it) — Rule #4 applies to this whole conversion, not just the invoice half.
 */
export async function convertSalesOrderToInvoice(
  companyDb: Kysely<CompanyDatabase>,
  orderId: string,
  invoiceDate: string,
  financialYear: string,
  actorUserId: string | null,
): Promise<string> {
  const order = await companyDb.selectFrom('sales_order').selectAll().where('id', '=', orderId).executeTakeFirst();
  if (!order) {
    throw new Error('Sales order not found');
  }
  if (order.status !== 'CONFIRMED') {
    throw new Error('Only a confirmed order can be converted to an invoice');
  }

  const lines = await companyDb.selectFrom('sales_order_line').selectAll().where('sales_order_id', '=', orderId).execute();
  const invoiceInput: CreateSalesInvoiceInput = {
    partyId: order.party_id,
    financialYear,
    invoiceDate,
    narration: order.narration ?? undefined,
    lines: lines.map((line) => ({
      description: line.description,
      ledgerId: line.income_ledger_id,
      amount: line.amount,
      taxLedgerId: line.tax_ledger_id ?? undefined,
      taxAmount: line.tax_amount,
      lineNarration: line.line_narration ?? undefined,
    })),
  };

  return companyDb.transaction().execute(async (trx) => {
    const invoiceId = await createSalesInvoiceInTransaction(trx, invoiceInput, actorUserId);

    await trx.updateTable('sales_order').set({ status: 'CONVERTED' satisfies OrderStatus, converted_to_invoice_id: invoiceId }).where('id', '=', orderId).execute();
    await writeAuditLog(trx, {
      actorUserId,
      action: 'UPDATE',
      entityType: 'SalesOrder',
      entityId: orderId,
      beforeData: { status: 'CONFIRMED' },
      afterData: { status: 'CONVERTED', convertedToInvoiceId: invoiceId },
    });

    return invoiceId;
  });
}
