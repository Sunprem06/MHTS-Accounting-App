import { Kysely, sql } from 'kysely';

/**
 * Bill-wise (invoice-level) payment allocation — links a Receipt/Payment
 * voucher to the specific invoice(s) it settles, in whole or in part. Until
 * now a payment just credited/debited whichever ledger the user picked, with
 * no link back to a specific invoice — Receivables/Payables (party-level
 * totals via computeLedgerBalances) were always exact, but MSME ageing had
 * no way to know WHICH invoices were still open and estimated it via a FIFO
 * settlement assumption (see core-sales-purchase's receivablesPayables.ts).
 *
 * If the voucher a settlement row points at is later cancelled (the existing
 * generic cancelVoucher reversal), that settlement should stop counting —
 * handled entirely by joining through to voucher.cancelled_at at query time
 * (see cumulativeSettled in tds... no, in settlements.ts), not by deleting or
 * flagging rows here. No schema support needed for that on purpose.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('sales_invoice_settlement')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('sales_invoice_id', 'text', (col) => col.notNull().references('sales_invoice.id'))
    /** The Receipt voucher that applies this amount against the invoice. */
    .addColumn('voucher_id', 'text', (col) => col.notNull().references('voucher.id'))
    /** Paise. Always > 0 — validated in core-sales-purchase, never more than the invoice's remaining outstanding at the time. */
    .addColumn('amount_applied', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('sales_invoice_settlement_invoice_idx').on('sales_invoice_settlement').column('sales_invoice_id').execute();
  await db.schema.createIndex('sales_invoice_settlement_voucher_idx').on('sales_invoice_settlement').column('voucher_id').execute();

  await db.schema
    .createTable('purchase_invoice_settlement')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('purchase_invoice_id', 'text', (col) => col.notNull().references('purchase_invoice.id'))
    /** The Payment voucher that applies this amount against the invoice. */
    .addColumn('voucher_id', 'text', (col) => col.notNull().references('voucher.id'))
    .addColumn('amount_applied', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('purchase_invoice_settlement_invoice_idx').on('purchase_invoice_settlement').column('purchase_invoice_id').execute();
  await db.schema.createIndex('purchase_invoice_settlement_voucher_idx').on('purchase_invoice_settlement').column('voucher_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('purchase_invoice_settlement').execute();
  await db.schema.dropTable('sales_invoice_settlement').execute();
}
