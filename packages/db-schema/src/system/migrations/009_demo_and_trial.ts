import { Kysely, sql } from 'kysely';

/**
 * Phase 10 Increment 3 (Demo Mode).
 *
 * `company.is_demo` flags the single sandbox company a "Try Demo" click
 * creates — exempt from the license gate/maxCompanies limit, always replaced
 * (never edited) on the next click. Same `is_active`-style integer-as-boolean
 * column shape used everywhere else in this schema.
 *
 * `trial_activation` is a singleton row (same shape/pattern as
 * `license_activation`) recording when this install's one-time 14-day
 * license-free trial started — set once, at first app bootstrap, and never
 * reset by anything short of deleting the system DB itself.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('company').addColumn('is_demo', 'integer', (col) => col.notNull().defaultTo(0)).execute();

  await db.schema
    .createTable('trial_activation')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('started_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('trial_activation').execute();
  await db.schema.alterTable('company').dropColumn('is_demo').execute();
}
