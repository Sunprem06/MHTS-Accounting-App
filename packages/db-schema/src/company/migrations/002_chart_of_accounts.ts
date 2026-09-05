import { Kysely, sql } from 'kysely';

/**
 * Phase 1 (Accounting Core). Amounts are stored as integers in paise
 * (smallest INR unit) everywhere in this schema, never as REAL/float, to
 * avoid floating-point rounding errors in financial data.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('account_group')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('parent_group_id', 'text', (col) => col.references('account_group.id'))
    // One of the five classical double-entry categories — a fixed accounting
    // primitive, not a rate/formula that changes with legislation (Rule #2
    // governs those, not this), so it's validated in application code
    // against a known closed set rather than modeled as RuleSet data.
    .addColumn('nature', 'text', (col) => col.notNull())
    .addColumn('is_system_group', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('ledger_account')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('group_id', 'text', (col) => col.notNull().references('account_group.id'))
    .addColumn('opening_balance', 'integer', (col) => col.notNull().defaultTo(0))
    /** 'DEBIT' | 'CREDIT' — meaningless when opening_balance is 0, required otherwise. */
    .addColumn('opening_balance_side', 'text', (col) => col.notNull().defaultTo('DEBIT'))
    .addColumn('is_system_ledger', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('ledger_account_group_idx').on('ledger_account').column('group_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('ledger_account').execute();
  await db.schema.dropTable('account_group').execute();
}
