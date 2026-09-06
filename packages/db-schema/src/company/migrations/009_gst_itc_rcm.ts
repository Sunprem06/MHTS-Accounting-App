import { Kysely } from 'kysely';

/**
 * Phase 4 (GST Engine), increment 2: Input Tax Credit eligibility and
 * reverse charge. All new columns are nullable-with-default, so any existing
 * line (and any line with no hsn_sac_code) is completely unaffected — same
 * additive discipline as migration 008_gst.ts.
 *
 * itc_eligible defaults to 1 (true) — the common case. When false (a
 * Section 17(5) blocked-credit purchase, or the company itself is on the
 * composition scheme), the line's GST amount is debited to the line's own
 * expense/stock ledger (becomes cost) instead of an Input GST ledger — see
 * core-sales-purchase's buildPurchaseVoucherLines.
 *
 * is_reverse_charge applies to both sides: the SELLER records a supply with
 * zero tax collected (the recipient self-assesses), the BUYER posts a
 * self-balancing Dr Input (or cost) / Cr RCM Liability pair that does NOT
 * touch the party's payable balance, since the supplier never charged it.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('purchase_invoice_line').addColumn('itc_eligible', 'integer', (col) => col.notNull().defaultTo(1)).execute();
  await db.schema.alterTable('purchase_invoice_line').addColumn('itc_ineligibility_reason', 'text').execute();
  await db.schema.alterTable('purchase_invoice_line').addColumn('is_reverse_charge', 'integer', (col) => col.notNull().defaultTo(0)).execute();
  await db.schema.alterTable('sales_invoice_line').addColumn('is_reverse_charge', 'integer', (col) => col.notNull().defaultTo(0)).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('sales_invoice_line').dropColumn('is_reverse_charge').execute();
  await db.schema.alterTable('purchase_invoice_line').dropColumn('is_reverse_charge').execute();
  await db.schema.alterTable('purchase_invoice_line').dropColumn('itc_ineligibility_reason').execute();
  await db.schema.alterTable('purchase_invoice_line').dropColumn('itc_eligible').execute();
}
