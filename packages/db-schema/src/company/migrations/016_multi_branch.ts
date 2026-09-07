import { Kysely, sql } from 'kysely';

/**
 * Phase 8 Increment 2 (Advanced ERP): Multi-Branch.
 *
 * Unlike a cost centre, a branch gets its own dedicated "Inter-Branch
 * Current Account" ledger (own-ledger-per-record pattern, same as
 * business_party/bank_account/employee/asset_class) — a real branch-
 * accounting current-account mechanism, not a bare report-grouping label.
 * `branch_id` is also a nullable dimension tag on voucher_line (same
 * mechanism as cost_centre_id), but — unlike cost_centre_id — it applies to
 * Contra vouchers too, since a branch is a balance-sheet dimension
 * (which branch's cash/bank moved) as well as a P&L one.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('branch')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('code', 'text')
    .addColumn('address', 'text')
    .addColumn('inter_branch_ledger_id', 'text', (col) => col.notNull().unique().references('ledger_account.id'))
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.alterTable('voucher_line').addColumn('branch_id', 'text', (col) => col.references('branch.id')).execute();
  await db.schema.createIndex('voucher_line_branch_idx').on('voucher_line').column('branch_id').execute();

  await db.schema.alterTable('sales_invoice').addColumn('branch_id', 'text', (col) => col.references('branch.id')).execute();
  await db.schema.alterTable('purchase_invoice').addColumn('branch_id', 'text', (col) => col.references('branch.id')).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('purchase_invoice').dropColumn('branch_id').execute();
  await db.schema.alterTable('sales_invoice').dropColumn('branch_id').execute();
  await db.schema.alterTable('voucher_line').dropColumn('branch_id').execute();
  await db.schema.dropTable('branch').execute();
}
