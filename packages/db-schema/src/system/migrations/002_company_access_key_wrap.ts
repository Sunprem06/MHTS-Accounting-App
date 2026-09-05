import { Kysely } from 'kysely';

/**
 * Adds the per-user wrapped Company DEK to each access grant (see
 * @mhts/core-identity's keyWrap.ts). The Company DB's own SQLCipher key never
 * touches disk in the clear: it is wrapped once per (user, company) grant
 * under a key derived from that user's login password.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('company_access')
    .addColumn('wrapped_dek', 'text')
    .execute();
  await db.schema.alterTable('company_access').addColumn('wrap_iv', 'text').execute();
  await db.schema.alterTable('company_access').addColumn('wrap_auth_tag', 'text').execute();
  await db.schema.alterTable('company_access').addColumn('wrap_kek_salt', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('company_access').dropColumn('wrap_kek_salt').execute();
  await db.schema.alterTable('company_access').dropColumn('wrap_auth_tag').execute();
  await db.schema.alterTable('company_access').dropColumn('wrap_iv').execute();
  await db.schema.alterTable('company_access').dropColumn('wrapped_dek').execute();
}
