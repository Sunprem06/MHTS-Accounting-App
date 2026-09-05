import { Kysely, sql } from 'kysely';

/**
 * Phase 2 (Sales + Purchase). Customers and suppliers share one table
 * (`business_party`) since a real business's counterparty is often both —
 * distinguished by `party_type`. Every party gets its own dedicated ledger
 * account under the existing Sundry Debtors/Sundry Creditors groups (seeded
 * in Phase 1's chart of accounts, so no new default groups are needed here),
 * so a party's outstanding balance is just that ledger's balance —
 * `computeLedgerBalances` from Phase 1 needs zero changes to support
 * receivables/payables.
 *
 * Sales/Purchase invoices deliberately do NOT duplicate `financial_year` or
 * an invoice number: each invoice posts a real voucher (voucher_type
 * SALES_INVOICE/PURCHASE_INVOICE) via the same double-entry engine as every
 * other voucher, and `voucher.voucher_number` (already sequential per
 * type+year) IS the invoice number — joined via voucher_id wherever it's
 * displayed. Cancellation reuses the existing cancelVoucher reversal
 * mechanism against that same voucher_id; no separate cancelled_at column
 * here.
 *
 * Orders (pre-invoice, no ledger impact) DO need their own number/year since
 * they exist before any voucher does.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('business_party')
    .addColumn('id', 'text', (col) => col.primaryKey())
    /** 'CUSTOMER' | 'SUPPLIER' | 'BOTH' — validated in core-sales-purchase, not a DB CHECK (same convention as voucher_type). */
    .addColumn('party_type', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('gstin', 'text')
    .addColumn('state_code', 'text')
    /** Section 43B(h): Udyam-registered MSME vendors unpaid past 45 days are tax-disallowed. */
    .addColumn('is_msme_udyam_registered', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('udyam_registration_number', 'text')
    .addColumn('credit_period_days', 'integer')
    .addColumn('ledger_account_id', 'text', (col) => col.notNull().unique().references('ledger_account.id'))
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('business_party_type_idx').on('business_party').column('party_type').execute();

  await db.schema
    .createTable('sales_invoice')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('party_id', 'text', (col) => col.notNull().references('business_party.id'))
    .addColumn('invoice_date', 'text', (col) => col.notNull())
    .addColumn('narration', 'text')
    .addColumn('voucher_id', 'text', (col) => col.notNull().unique().references('voucher.id'))
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('sales_invoice_party_idx').on('sales_invoice').column('party_id').execute();

  await db.schema
    .createTable('sales_invoice_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('sales_invoice_id', 'text', (col) => col.notNull().references('sales_invoice.id'))
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('income_ledger_id', 'text', (col) => col.notNull().references('ledger_account.id'))
    /** Paise. Taxable value, credited to income_ledger_id. */
    .addColumn('amount', 'integer', (col) => col.notNull())
    /** Manually entered (GST rules engine lands in Phase 4 — see CLAUDE.md Rule #2, no rate is hardcoded here or anywhere in this pass). */
    .addColumn('tax_ledger_id', 'text', (col) => col.references('ledger_account.id'))
    .addColumn('tax_amount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('line_narration', 'text')
    .execute();

  await db.schema.createIndex('sales_invoice_line_invoice_idx').on('sales_invoice_line').column('sales_invoice_id').execute();

  await db.schema
    .createTable('purchase_invoice')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('party_id', 'text', (col) => col.notNull().references('business_party.id'))
    .addColumn('invoice_date', 'text', (col) => col.notNull())
    .addColumn('narration', 'text')
    .addColumn('voucher_id', 'text', (col) => col.notNull().unique().references('voucher.id'))
    /** Snapshot of business_party.is_msme_udyam_registered at creation time — a later change to the party shouldn't rewrite this invoice's own 43B(h) ageing history. */
    .addColumn('is_msme_vendor', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('due_date', 'text', (col) => col.notNull())
    /** e.g. '194C' — null if no TDS was deducted on this invoice. Section codes are a fixed legal vocabulary (core-sales-purchase), the *rate* is resolved from the versioned rule_set table (system DB), never hardcoded (Rule #2). */
    .addColumn('tds_section', 'text')
    .addColumn('tds_amount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('purchase_invoice_party_idx').on('purchase_invoice').column('party_id').execute();
  await db.schema.createIndex('purchase_invoice_due_date_idx').on('purchase_invoice').column('due_date').execute();

  await db.schema
    .createTable('purchase_invoice_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('purchase_invoice_id', 'text', (col) => col.notNull().references('purchase_invoice.id'))
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('expense_ledger_id', 'text', (col) => col.notNull().references('ledger_account.id'))
    /** Paise. Taxable value, debited to expense_ledger_id. */
    .addColumn('amount', 'integer', (col) => col.notNull())
    .addColumn('tax_ledger_id', 'text', (col) => col.references('ledger_account.id'))
    .addColumn('tax_amount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('line_narration', 'text')
    .execute();

  await db.schema.createIndex('purchase_invoice_line_invoice_idx').on('purchase_invoice_line').column('purchase_invoice_id').execute();

  await db.schema
    .createTable('sales_order')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('financial_year', 'text', (col) => col.notNull())
    /** Sequential per financial_year — orders exist before any voucher, so they need their own numbering (unlike invoices). */
    .addColumn('order_number', 'integer', (col) => col.notNull())
    .addColumn('party_id', 'text', (col) => col.notNull().references('business_party.id'))
    .addColumn('order_date', 'text', (col) => col.notNull())
    /** 'DRAFT' | 'CONFIRMED' | 'CONVERTED' | 'CANCELLED' — validated in core-sales-purchase. */
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('DRAFT'))
    .addColumn('narration', 'text')
    .addColumn('converted_to_invoice_id', 'text', (col) => col.references('sales_invoice.id'))
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createIndex('sales_order_number_unique_idx')
    .on('sales_order')
    .columns(['financial_year', 'order_number'])
    .unique()
    .execute();

  await db.schema
    .createTable('sales_order_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('sales_order_id', 'text', (col) => col.notNull().references('sales_order.id'))
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('income_ledger_id', 'text', (col) => col.notNull().references('ledger_account.id'))
    .addColumn('amount', 'integer', (col) => col.notNull())
    .addColumn('tax_ledger_id', 'text', (col) => col.references('ledger_account.id'))
    .addColumn('tax_amount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('line_narration', 'text')
    .execute();

  await db.schema.createIndex('sales_order_line_order_idx').on('sales_order_line').column('sales_order_id').execute();

  await db.schema
    .createTable('purchase_order')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('financial_year', 'text', (col) => col.notNull())
    .addColumn('order_number', 'integer', (col) => col.notNull())
    .addColumn('party_id', 'text', (col) => col.notNull().references('business_party.id'))
    .addColumn('order_date', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('DRAFT'))
    .addColumn('narration', 'text')
    /** Carried forward to the invoice at conversion time — procurement usually knows the applicable TDS section upfront. */
    .addColumn('tds_section', 'text')
    .addColumn('converted_to_invoice_id', 'text', (col) => col.references('purchase_invoice.id'))
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createIndex('purchase_order_number_unique_idx')
    .on('purchase_order')
    .columns(['financial_year', 'order_number'])
    .unique()
    .execute();

  await db.schema
    .createTable('purchase_order_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('purchase_order_id', 'text', (col) => col.notNull().references('purchase_order.id'))
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('expense_ledger_id', 'text', (col) => col.notNull().references('ledger_account.id'))
    .addColumn('amount', 'integer', (col) => col.notNull())
    .addColumn('tax_ledger_id', 'text', (col) => col.references('ledger_account.id'))
    .addColumn('tax_amount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('line_narration', 'text')
    .execute();

  await db.schema.createIndex('purchase_order_line_order_idx').on('purchase_order_line').column('purchase_order_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('purchase_order_line').execute();
  await db.schema.dropTable('purchase_order').execute();
  await db.schema.dropTable('sales_order_line').execute();
  await db.schema.dropTable('sales_order').execute();
  await db.schema.dropTable('purchase_invoice_line').execute();
  await db.schema.dropTable('purchase_invoice').execute();
  await db.schema.dropTable('sales_invoice_line').execute();
  await db.schema.dropTable('sales_invoice').execute();
  await db.schema.dropTable('business_party').execute();
}
