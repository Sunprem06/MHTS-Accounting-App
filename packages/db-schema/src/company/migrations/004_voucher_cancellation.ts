import { Kysely } from 'kysely';

/**
 * Voucher cancellation is modeled as an auto-generated reversal voucher, not
 * a destructive edit — consistent with the append-only audit philosophy
 * already established for audit_log. `reverses_voucher_id` marks a voucher
 * as itself being a reversal of another; `cancelled_by_voucher_id` marks the
 * original as cancelled and points at its reversal.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('voucher').addColumn('cancelled_at', 'text').execute();
  await db.schema.alterTable('voucher').addColumn('cancelled_by_voucher_id', 'text', (col) => col.references('voucher.id')).execute();
  await db.schema.alterTable('voucher').addColumn('reverses_voucher_id', 'text', (col) => col.references('voucher.id')).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('voucher').dropColumn('reverses_voucher_id').execute();
  await db.schema.alterTable('voucher').dropColumn('cancelled_by_voucher_id').execute();
  await db.schema.alterTable('voucher').dropColumn('cancelled_at').execute();
}
