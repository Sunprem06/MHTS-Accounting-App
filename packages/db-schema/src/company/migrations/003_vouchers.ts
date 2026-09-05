import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('voucher')
    .addColumn('id', 'text', (col) => col.primaryKey())
    /** 'JOURNAL' | 'PAYMENT' | 'RECEIPT' | 'CONTRA' — validated in core-accounting, not a DB CHECK (more types land in later phases: SALES, PURCHASE, ...). */
    .addColumn('voucher_type', 'text', (col) => col.notNull())
    /** e.g. '2026-27' — derived from the company's financial_year_start_month (system DB), passed in by the caller. */
    .addColumn('financial_year', 'text', (col) => col.notNull())
    /** Sequential per (voucher_type, financial_year) — the human-facing "Payment No. 3" convention. */
    .addColumn('voucher_number', 'integer', (col) => col.notNull())
    .addColumn('voucher_date', 'text', (col) => col.notNull())
    .addColumn('narration', 'text')
    /** AppUser.id from the system DB — not a foreign key here (cross-file, same pattern as company_access.app_user_id). */
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createIndex('voucher_number_unique_idx')
    .on('voucher')
    .columns(['voucher_type', 'financial_year', 'voucher_number'])
    .unique()
    .execute();

  await db.schema
    .createTable('voucher_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('voucher_id', 'text', (col) => col.notNull().references('voucher.id'))
    .addColumn('ledger_id', 'text', (col) => col.notNull().references('ledger_account.id'))
    /** Exactly one of debit_amount/credit_amount is non-zero per line — enforced in core-accounting. Paise. */
    .addColumn('debit_amount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('credit_amount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('line_narration', 'text')
    .execute();

  await db.schema.createIndex('voucher_line_voucher_idx').on('voucher_line').column('voucher_id').execute();
  await db.schema.createIndex('voucher_line_ledger_idx').on('voucher_line').column('ledger_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('voucher_line').execute();
  await db.schema.dropTable('voucher').execute();
}
