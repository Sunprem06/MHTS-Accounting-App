import { Kysely, sql } from 'kysely';

/**
 * Phase 8 Increment 2 (Advanced ERP): Multi-Currency.
 *
 * The FX primitive lives on `voucher_line` itself (foreign_currency/
 * foreign_amount/exchange_rate_micros — all three set together or not at
 * all) rather than in a new package, because every voucher type needs it,
 * not just invoices. `debit_amount`/`credit_amount` stay the base-currency
 * (paise) source of truth for every existing report/balance query — a line
 * carrying FX fields is just base-currency amounts whose value happens to
 * have been derived from a foreign amount x rate, validated in
 * core-accounting's validateLines via convertForeignToBase.
 *
 * Exchange rates are NOT a new table here — they reuse @mhts/core-rules-engine's
 * existing rule_set mechanism (system DB) as versioned, date-effective data
 * (rule_type 'FX_RATE.<CCY>'), the same mechanism GST/TDS/Payroll rates
 * already use (CLAUDE.md Rule #2). Nothing to migrate for that.
 *
 * fx_revaluation_run/fx_revaluation_line record period-end revaluation runs
 * (unrealized gain/loss), mirroring asset_depreciation_entry's role for
 * depreciation runs. Realized gain/loss (at invoice settlement) needs no new
 * table beyond invoice_settlement's new foreign_amount_applied column — the
 * gain/loss itself posts as an extra voucher_line on the existing settlement
 * voucher.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('voucher_line')
    .addColumn('foreign_currency', 'text')
    .execute();
  await db.schema.alterTable('voucher_line').addColumn('foreign_amount', 'integer').execute();
  await db.schema.alterTable('voucher_line').addColumn('exchange_rate_micros', 'integer').execute();
  await db.schema.createIndex('voucher_line_foreign_currency_idx').on('voucher_line').column('foreign_currency').execute();

  await db.schema.alterTable('sales_invoice').addColumn('currency', 'text').execute();
  await db.schema.alterTable('sales_invoice').addColumn('exchange_rate_micros', 'integer').execute();
  await db.schema.alterTable('sales_invoice_line').addColumn('foreign_amount', 'integer').execute();
  await db.schema.alterTable('sales_invoice_settlement').addColumn('foreign_amount_applied', 'integer').execute();

  await db.schema.alterTable('purchase_invoice').addColumn('currency', 'text').execute();
  await db.schema.alterTable('purchase_invoice').addColumn('exchange_rate_micros', 'integer').execute();
  await db.schema.alterTable('purchase_invoice_line').addColumn('foreign_amount', 'integer').execute();
  await db.schema.alterTable('purchase_invoice_settlement').addColumn('foreign_amount_applied', 'integer').execute();

  /** A party's usual transaction currency — a UX default only, never enforced. */
  await db.schema.alterTable('business_party').addColumn('default_currency', 'text').execute();
  /** Set only for a bank account actually held/tracked in a foreign currency. */
  await db.schema.alterTable('bank_account').addColumn('account_currency', 'text').execute();

  await db.schema
    .createTable('fx_revaluation_run')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('run_date', 'text', (col) => col.notNull())
    .addColumn('financial_year', 'text', (col) => col.notNull())
    /** Null only when every exposure's adjustment computed to zero — no voucher was needed. */
    .addColumn('voucher_id', 'text', (col) => col.references('voucher.id'))
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('fx_revaluation_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('run_id', 'text', (col) => col.notNull().references('fx_revaluation_run.id'))
    .addColumn('ledger_id', 'text', (col) => col.notNull().references('ledger_account.id'))
    .addColumn('currency', 'text', (col) => col.notNull())
    /** Foreign-currency minor units, debit-positive. */
    .addColumn('foreign_balance', 'integer', (col) => col.notNull())
    /** Paise, all three. */
    .addColumn('base_balance_before', 'integer', (col) => col.notNull())
    .addColumn('base_balance_after', 'integer', (col) => col.notNull())
    .addColumn('adjustment_amount', 'integer', (col) => col.notNull())
    .execute();

  await db.schema.createIndex('fx_revaluation_line_run_idx').on('fx_revaluation_line').column('run_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('fx_revaluation_line').execute();
  await db.schema.dropTable('fx_revaluation_run').execute();
  await db.schema.alterTable('bank_account').dropColumn('account_currency').execute();
  await db.schema.alterTable('business_party').dropColumn('default_currency').execute();
  await db.schema.alterTable('purchase_invoice_settlement').dropColumn('foreign_amount_applied').execute();
  await db.schema.alterTable('purchase_invoice_line').dropColumn('foreign_amount').execute();
  await db.schema.alterTable('purchase_invoice').dropColumn('exchange_rate_micros').execute();
  await db.schema.alterTable('purchase_invoice').dropColumn('currency').execute();
  await db.schema.alterTable('sales_invoice_settlement').dropColumn('foreign_amount_applied').execute();
  await db.schema.alterTable('sales_invoice_line').dropColumn('foreign_amount').execute();
  await db.schema.alterTable('sales_invoice').dropColumn('exchange_rate_micros').execute();
  await db.schema.alterTable('sales_invoice').dropColumn('currency').execute();
  await db.schema.alterTable('voucher_line').dropColumn('exchange_rate_micros').execute();
  await db.schema.alterTable('voucher_line').dropColumn('foreign_amount').execute();
  await db.schema.alterTable('voucher_line').dropColumn('foreign_currency').execute();
}
