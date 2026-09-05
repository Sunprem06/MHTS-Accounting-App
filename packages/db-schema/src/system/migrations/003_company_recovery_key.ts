import { Kysely, sql } from 'kysely';

/**
 * Company-wide (not per-user) recovery wrap of the Company DEK — a second,
 * independent way to unwrap it besides a user's password. Generated once at
 * company creation, shown to the user exactly once, never stored anywhere in
 * a form that could reconstruct it (only its AES-256-GCM-wrapped DEK is kept).
 * See @mhts/core-identity/keyWrap.ts and Phase Tracker Key Decisions Log.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('company_recovery_key')
    .addColumn('company_id', 'text', (col) => col.primaryKey().references('company.id'))
    .addColumn('wrapped_dek', 'text', (col) => col.notNull())
    .addColumn('wrap_iv', 'text', (col) => col.notNull())
    .addColumn('wrap_auth_tag', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('company_recovery_key').execute();
}
