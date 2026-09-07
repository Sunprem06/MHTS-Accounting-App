import { Kysely, sql } from 'kysely';

/**
 * Phase 9 Increment 2 (Print + Templates): extends printing to the remaining
 * document types (Purchase Invoice, Sales/Purchase Orders, Journal/Payment/
 * Receipt/Contra vouchers, Expense Claims) plus a real Print Centre register.
 *
 * - `purchase_invoice_line.item_id` / `quantity_thousandths` / `rate_paise` —
 *   the exact same gap migration 018 closed for `sales_invoice_line`, never
 *   closed for the purchase side. The create-purchase-invoice INPUT already
 *   carries these (used for stock receipt posting), but they were never
 *   persisted onto the line, so a printed purchase invoice could show the
 *   taxable amount but not Qty/Rate. Nullable, same reasoning (a
 *   non-stockable/service line has none of them).
 *
 * No new letterhead-layout column this increment: `invoice_layout` (already
 * on `company_letterhead_profile` since migration 018) is reused as-is for
 * every new tabular/ledger-line document type this increment adds (Purchase
 * Invoice gets a real CLASSIC/MODERN split, same as Sales Invoice; Sales/
 * Purchase Order and the Journal/Payment/Receipt/Contra voucher/Expense Claim
 * templates render identically regardless of layout, same precedent
 * payslipTemplate.ts already established in Increment 1) — a dedicated extra
 * layout column for each new document type would be schema surface with no
 * real distinct rendering behind it yet.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('purchase_invoice_line').addColumn('item_id', 'text', (col) => col.references('item.id')).execute();
  await db.schema.alterTable('purchase_invoice_line').addColumn('quantity_thousandths', 'integer').execute();
  await db.schema.alterTable('purchase_invoice_line').addColumn('rate_paise', 'integer').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('purchase_invoice_line').dropColumn('rate_paise').execute();
  await db.schema.alterTable('purchase_invoice_line').dropColumn('quantity_thousandths').execute();
  await db.schema.alterTable('purchase_invoice_line').dropColumn('item_id').execute();
}
