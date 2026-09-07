import { Kysely, sql } from 'kysely';

/**
 * Phase 8 Increment 1 (Advanced ERP): Cost Centres + Budgets.
 *
 * `cost_centre` is a dimension tag, not a ledger substitute — a business
 * still posts to the same ledger_account it always did, but can now
 * optionally tag any voucher_line with which cost centre it belongs to
 * (department, project, branch — whatever the business defines). This is
 * why `voucher_line.cost_centre_id` is a plain nullable ADD COLUMN rather
 * than a new required field: every voucher ever posted before this
 * migration remains valid with no backfill, same as every other additive
 * migration in this schema.
 *
 * `budget`/`budget_line` compare against actuals by re-querying
 * voucher_line the same way computeLedgerBalances does (see
 * budgetVsActual.ts) — no separate "actual" table to keep in sync.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('cost_centre')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('code', 'text')
    .addColumn('parent_cost_centre_id', 'text', (col) => col.references('cost_centre.id'))
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.alterTable('voucher_line').addColumn('cost_centre_id', 'text', (col) => col.references('cost_centre.id')).execute();
  await db.schema.createIndex('voucher_line_cost_centre_idx').on('voucher_line').column('cost_centre_id').execute();

  await db.schema
    .createTable('budget')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('financial_year', 'text', (col) => col.notNull())
    /** At least one of ledger_id/cost_centre_id must be set — validated in core-accounting, not a DB CHECK (same convention as every other cross-field rule in this schema). */
    .addColumn('ledger_id', 'text', (col) => col.references('ledger_account.id'))
    .addColumn('cost_centre_id', 'text', (col) => col.references('cost_centre.id'))
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('budget_financial_year_idx').on('budget').column('financial_year').execute();

  await db.schema
    .createTable('budget_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('budget_id', 'text', (col) => col.notNull().references('budget.id'))
    /** 1-12, calendar month number (not FY-relative position) — matched against voucher_date's own calendar month in budgetVsActual. */
    .addColumn('period_month', 'integer', (col) => col.notNull())
    /** Paise. */
    .addColumn('amount_paise', 'integer', (col) => col.notNull())
    .execute();

  await db.schema.createIndex('budget_line_budget_idx').on('budget_line').column('budget_id').execute();
  await db.schema.createIndex('budget_line_unique_month_idx').on('budget_line').columns(['budget_id', 'period_month']).unique().execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('budget_line').execute();
  await db.schema.dropTable('budget').execute();
  await db.schema.alterTable('voucher_line').dropColumn('cost_centre_id').execute();
  await db.schema.dropTable('cost_centre').execute();
}
