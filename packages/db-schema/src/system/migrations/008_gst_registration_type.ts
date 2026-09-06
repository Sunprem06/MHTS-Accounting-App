import { Kysely } from 'kysely';

/**
 * Phase 4 (GST Engine), increment 2. 'REGULAR' | 'COMPOSITION' — validated in
 * application code, same convention as party_type/voucher_type elsewhere in
 * this schema. A composition dealer cannot collect GST from customers or
 * claim input tax credit (see @mhts/core-sales-purchase's sales/purchase
 * posting logic) — a fundamentally different tax treatment from a regular
 * dealer, decided once at company creation. Deliberately NOT editable after
 * creation in this pass: a real mid-year scheme switch has its own
 * statutory transition rules (e.g. ITC reversal on closing stock) that
 * aren't modeled — see Phase Tracker Open Questions.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('company').addColumn('gst_registration_type', 'text', (col) => col.notNull().defaultTo('REGULAR')).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('company').dropColumn('gst_registration_type').execute();
}
