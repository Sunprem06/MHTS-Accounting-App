import { Kysely } from 'kysely';

/**
 * Phase 4 (GST Engine), increment 1: rate/HSN-SAC engine + CGST/SGST/IGST
 * auto-computation on invoice lines. No new tables — GST rates themselves
 * live in the existing system-DB `rule_set` table (via @mhts/core-rules-engine,
 * same mechanism as vendor TDS), and `business_party`/`item`/the company
 * record already carry state_code/gstin/hsn_sac_code from earlier phases.
 *
 * A line's tax is either the pre-existing manual taxLedgerId/taxAmount pair
 * OR an hsnSacCode-driven auto-split — never both (enforced in
 * core-sales-purchase's lineValidation, not here) — so a line with no
 * hsn_sac_code posts exactly as it did before this migration. The four
 * amount columns are split out (rather than reusing tax_amount) because one
 * line can generate up to three simultaneous tax postings (CGST+SGST, or
 * IGST, plus an optional cess), which the existing single tax_ledger_id/
 * tax_amount pair can't represent. gst_rate_basis_points/cess_rate_basis_points
 * (rate% * 100) are stored only for legibility/audit on the line — the
 * posted amounts are the actual source of truth, same "integers, never
 * REAL/float" discipline as money and quantity elsewhere in this schema.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('sales_order_line').addColumn('hsn_sac_code', 'text').execute();
  await db.schema.alterTable('purchase_order_line').addColumn('hsn_sac_code', 'text').execute();

  for (const table of ['sales_invoice_line', 'purchase_invoice_line'] as const) {
    await db.schema.alterTable(table).addColumn('hsn_sac_code', 'text').execute();
    await db.schema.alterTable(table).addColumn('gst_rate_basis_points', 'integer').execute();
    await db.schema.alterTable(table).addColumn('cess_rate_basis_points', 'integer').execute();
    await db.schema.alterTable(table).addColumn('cgst_amount', 'integer', (col) => col.notNull().defaultTo(0)).execute();
    await db.schema.alterTable(table).addColumn('sgst_amount', 'integer', (col) => col.notNull().defaultTo(0)).execute();
    await db.schema.alterTable(table).addColumn('igst_amount', 'integer', (col) => col.notNull().defaultTo(0)).execute();
    await db.schema.alterTable(table).addColumn('cess_amount', 'integer', (col) => col.notNull().defaultTo(0)).execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  for (const table of ['sales_invoice_line', 'purchase_invoice_line'] as const) {
    await db.schema.alterTable(table).dropColumn('cess_amount').execute();
    await db.schema.alterTable(table).dropColumn('igst_amount').execute();
    await db.schema.alterTable(table).dropColumn('sgst_amount').execute();
    await db.schema.alterTable(table).dropColumn('cgst_amount').execute();
    await db.schema.alterTable(table).dropColumn('cess_rate_basis_points').execute();
    await db.schema.alterTable(table).dropColumn('gst_rate_basis_points').execute();
    await db.schema.alterTable(table).dropColumn('hsn_sac_code').execute();
  }

  await db.schema.alterTable('purchase_order_line').dropColumn('hsn_sac_code').execute();
  await db.schema.alterTable('sales_order_line').dropColumn('hsn_sac_code').execute();
}
