import { Kysely } from 'kysely';

/**
 * Online licensing/piracy-protection initiative (Phase Tracker Section 4,
 * session 29 handoff). `license_activation` gains two nullable columns:
 *
 * - `activation_token`: the bearer secret returned once by the portal's
 *   POST /api/erp-licenses/activate, stored locally and sent on every later
 *   POST /api/erp-licenses/checkin call. Only set when this activation went
 *   through the portal (online, or the offline fallback package which is
 *   still portal-provisioned) — never set for a license verified purely
 *   against the pre-existing offline signature check with no portal
 *   involvement at all.
 * - `last_validated_at`: timestamp of the last successful checkin (or of
 *   activation itself). `checkLicenseStatus` treats a portal-registered
 *   activation whose `last_validated_at` is null or more than the grace
 *   period old as invalid — this is what actually closes the whole-folder-
 *   clone gap (Phase Tracker session 29 finding #2): a cloned copy that
 *   never reconnects eventually stops passing this check for EVERY company,
 *   not just new ones.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('license_activation').addColumn('activation_token', 'text').execute();
  await db.schema.alterTable('license_activation').addColumn('last_validated_at', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('license_activation').dropColumn('last_validated_at').execute();
  await db.schema.alterTable('license_activation').dropColumn('activation_token').execute();
}
