import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { validateDocumentLines } from './lineValidation';
import { createPurchaseInvoiceInTransaction } from './purchaseInvoices';
import type { CreatePurchaseInvoiceInput, CreatePurchaseOrderInput, OrderStatus, OrderSummary } from './types';

export async function createPurchaseOrder(companyDb: Kysely<CompanyDatabase>, input: CreatePurchaseOrderInput, actorUserId: string | null): Promise<string> {
  validateDocumentLines(input.lines);

  const party = await companyDb.selectFrom('business_party').selectAll().where('id', '=', input.partyId).executeTakeFirst();
  if (!party) {
    throw new Error('Party not found');
  }
  if (party.party_type !== 'SUPPLIER' && party.party_type !== 'BOTH') {
    throw new Error('This party is not set up as a supplier');
  }

  const orderId = randomUUID();

  await companyDb.transaction().execute(async (trx) => {
    const maxNumberRow = await trx
      .selectFrom('purchase_order')
      .select(({ fn }) => fn.max('order_number').as('maxNumber'))
      .where('financial_year', '=', input.financialYear)
      .executeTakeFirst();
    const orderNumber = (maxNumberRow?.maxNumber ?? 0) + 1;

    await trx
      .insertInto('purchase_order')
      .values({
        id: orderId,
        financial_year: input.financialYear,
        order_number: orderNumber,
        party_id: input.partyId,
        order_date: input.orderDate,
        status: 'DRAFT' satisfies OrderStatus,
        narration: input.narration ?? null,
        tds_section: input.tdsSection ?? null,
        converted_to_invoice_id: null,
        created_by: actorUserId,
      })
      .execute();

    for (const line of input.lines) {
      await trx
        .insertInto('purchase_order_line')
        .values({
          id: randomUUID(),
          purchase_order_id: orderId,
          description: line.description,
          expense_ledger_id: line.ledgerId,
          amount: line.amount,
          tax_ledger_id: line.taxLedgerId ?? null,
          tax_amount: line.taxAmount ?? 0,
          line_narration: line.lineNarration ?? null,
          item_id: line.itemId ?? null,
          warehouse_id: line.warehouseId ?? null,
          quantity_thousandths: line.quantityThousandths ?? null,
          rate_paise: line.ratePaise ?? null,
          hsn_sac_code: line.hsnSacCode ?? null,
        })
        .execute();
    }

    await writeAuditLog(trx, { actorUserId, action: 'CREATE', entityType: 'PurchaseOrder', entityId: orderId, afterData: { partyId: input.partyId, orderDate: input.orderDate } });
  });

  return orderId;
}

export async function listPurchaseOrders(companyDb: Kysely<CompanyDatabase>): Promise<OrderSummary[]> {
  const rows = await companyDb
    .selectFrom('purchase_order')
    .innerJoin('business_party', 'business_party.id', 'purchase_order.party_id')
    .leftJoin('purchase_order_line', 'purchase_order_line.purchase_order_id', 'purchase_order.id')
    .select(({ fn }) => [
      'purchase_order.id as id',
      'purchase_order.order_number as orderNumber',
      'purchase_order.financial_year as financialYear',
      'purchase_order.party_id as partyId',
      'business_party.name as partyName',
      'purchase_order.order_date as orderDate',
      'purchase_order.status as status',
      'purchase_order.narration as narration',
      'purchase_order.converted_to_invoice_id as convertedToInvoiceId',
      fn.sum<number>('purchase_order_line.amount').as('taxableAmount'),
      fn.sum<number>('purchase_order_line.tax_amount').as('taxAmount'),
    ])
    .groupBy('purchase_order.id')
    .orderBy('purchase_order.order_date', 'desc')
    .orderBy('purchase_order.order_number', 'desc')
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
  const order = await companyDb.selectFrom('purchase_order').selectAll().where('id', '=', orderId).executeTakeFirst();
  if (!order) {
    throw new Error('Purchase order not found');
  }
  if (!from.includes(order.status as OrderStatus)) {
    throw new Error(`Cannot move a ${order.status} order to ${to}`);
  }

  await companyDb.transaction().execute(async (trx) => {
    await trx.updateTable('purchase_order').set({ status: to }).where('id', '=', orderId).execute();
    await writeAuditLog(trx, { actorUserId, action: 'UPDATE', entityType: 'PurchaseOrder', entityId: orderId, beforeData: { status: order.status }, afterData: { status: to } });
  });
}

export function confirmPurchaseOrder(companyDb: Kysely<CompanyDatabase>, orderId: string, actorUserId: string | null): Promise<void> {
  return transitionStatus(companyDb, orderId, ['DRAFT'], 'CONFIRMED', actorUserId);
}

export function cancelPurchaseOrder(companyDb: Kysely<CompanyDatabase>, orderId: string, actorUserId: string | null): Promise<void> {
  return transitionStatus(companyDb, orderId, ['DRAFT', 'CONFIRMED'], 'CANCELLED', actorUserId);
}

/** Mirror of convertSalesOrderToInvoice — one transaction covers both the invoice-and-voucher posting and the order's CONVERTED status update. */
export async function convertPurchaseOrderToInvoice(
  companyDb: Kysely<CompanyDatabase>,
  systemDb: Kysely<SystemDatabase>,
  orderId: string,
  invoiceDate: string,
  financialYear: string,
  companyStateCode: string | null,
  actorUserId: string | null,
): Promise<string> {
  const order = await companyDb.selectFrom('purchase_order').selectAll().where('id', '=', orderId).executeTakeFirst();
  if (!order) {
    throw new Error('Purchase order not found');
  }
  if (order.status !== 'CONFIRMED') {
    throw new Error('Only a confirmed order can be converted to an invoice');
  }

  const lines = await companyDb.selectFrom('purchase_order_line').selectAll().where('purchase_order_id', '=', orderId).execute();
  const invoiceInput: CreatePurchaseInvoiceInput = {
    partyId: order.party_id,
    financialYear,
    invoiceDate,
    narration: order.narration ?? undefined,
    tdsSection: (order.tds_section as CreatePurchaseInvoiceInput['tdsSection']) ?? undefined,
    companyStateCode,
    // See salesOrders.ts's convertSalesOrderToInvoice for why every field
    // must be listed explicitly here — this mapper does not forward unknown
    // fields, so a new column on purchase_order_line silently disappears on
    // conversion unless it's added here too.
    lines: lines.map((line) => ({
      description: line.description,
      ledgerId: line.expense_ledger_id,
      amount: line.amount,
      taxLedgerId: line.tax_ledger_id ?? undefined,
      taxAmount: line.tax_amount,
      hsnSacCode: line.hsn_sac_code ?? undefined,
      lineNarration: line.line_narration ?? undefined,
      itemId: line.item_id ?? undefined,
      warehouseId: line.warehouse_id ?? undefined,
      quantityThousandths: line.quantity_thousandths ?? undefined,
      ratePaise: line.rate_paise ?? undefined,
    })),
  };

  return companyDb.transaction().execute(async (trx) => {
    const invoiceId = await createPurchaseInvoiceInTransaction(trx, systemDb, invoiceInput, actorUserId);

    await trx.updateTable('purchase_order').set({ status: 'CONVERTED' satisfies OrderStatus, converted_to_invoice_id: invoiceId }).where('id', '=', orderId).execute();
    await writeAuditLog(trx, {
      actorUserId,
      action: 'UPDATE',
      entityType: 'PurchaseOrder',
      entityId: orderId,
      beforeData: { status: 'CONFIRMED' },
      afterData: { status: 'CONVERTED', convertedToInvoiceId: invoiceId },
    });

    return invoiceId;
  });
}
