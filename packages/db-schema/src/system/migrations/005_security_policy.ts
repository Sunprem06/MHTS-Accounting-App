import { Kysely, sql } from 'kysely';

/** Singleton table (one row, id 'default') for account-lockout thresholds — configurable, not hardcoded. See Phase Tracker Key Decisions Log, 2026-09-05. */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('security_policy')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('max_failed_attempts', 'integer', (col) => col.notNull().defaultTo(5))
    .addColumn('lockout_duration_seconds', 'integer', (col) => col.notNull().defaultTo(900))
    .addColumn('backoff_base_seconds', 'integer', (col) => col.notNull().defaultTo(2))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.insertInto('security_policy').values({ id: 'default' }).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('security_policy').execute();
}
