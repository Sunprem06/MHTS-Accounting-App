import { Kysely } from 'kysely';

/**
 * Moves the password off AppUserTable (was a single global password across
 * every company a person has access to) onto CompanyAccessTable — each
 * company's password_hash now lives on the same row as the DEK wrap it
 * unlocks, so a reset for one company can never affect any other. Also adds
 * per-company-access lockout state (thresholds live in security_policy, see
 * migration 005). See Phase Tracker Key Decisions Log, 2026-09-05.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('company_access').addColumn('password_hash', 'text').execute();
  await db.schema
    .alterTable('company_access')
    .addColumn('must_change_password', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
  await db.schema
    .alterTable('company_access')
    .addColumn('failed_login_count', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
  await db.schema.alterTable('company_access').addColumn('locked_until', 'text').execute();
  await db.schema.alterTable('company_access').addColumn('last_failed_attempt_at', 'text').execute();

  await db.schema.alterTable('app_user').dropColumn('password_hash').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('app_user')
    .addColumn('password_hash', 'text', (col) => col.notNull().defaultTo(''))
    .execute();
  await db.schema.alterTable('company_access').dropColumn('last_failed_attempt_at').execute();
  await db.schema.alterTable('company_access').dropColumn('locked_until').execute();
  await db.schema.alterTable('company_access').dropColumn('failed_login_count').execute();
  await db.schema.alterTable('company_access').dropColumn('must_change_password').execute();
  await db.schema.alterTable('company_access').dropColumn('password_hash').execute();
}
