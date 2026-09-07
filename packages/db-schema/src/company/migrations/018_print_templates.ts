import { Kysely, sql } from 'kysely';

/**
 * Phase 9 Increment 1 (Print + Templates): print/PDF infrastructure, a new
 * Company Letterhead Profile, and the schema gaps that block a real printed
 * Sales Invoice / Payslip:
 *
 * - `company_letterhead_profile` is a singleton row (fixed id, same pattern
 *   as `company_payroll_settings` — see core-payroll-engine/companySettings.ts)
 *   holding the presentation-only facts a letterhead needs (address, contact
 *   details, bank details for the invoice footer, a footer note, and which
 *   preset layout + accent color each document type uses). `logo_data` is
 *   the SECOND blob column in this schema (the first was
 *   `document_attachment.file_data`, Phase 6) — stored inside this encrypted
 *   company DB, not the system DB, so it travels with `backupCompany`'s
 *   existing whole-file copy for free, same reasoning as Phase 6's.
 * - `business_party.address` — there was no address column anywhere on the
 *   customer/supplier master (only `warehouse.address`/`branch.address`
 *   existed), so a printed invoice's "Bill To" block had nothing to show.
 * - `employee.designation` — same gap for a printed payslip's employee block
 *   (only `department` existed).
 * - `sales_invoice_line.item_id` / `quantity_thousandths` / `rate_paise` —
 *   the create-invoice INPUT already carries these (core-sales-purchase's
 *   DocumentLineInput), used to move stock, but they were never persisted
 *   onto the line itself, so a printed invoice could show the taxable
 *   amount but not the Qty/Rate a real invoice needs. All three are
 *   nullable — a non-stockable (service) line has none of them, unchanged.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('company_letterhead_profile')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('address', 'text')
    .addColumn('phone', 'text')
    .addColumn('email', 'text')
    .addColumn('website', 'text')
    .addColumn('bank_account_name', 'text')
    .addColumn('bank_account_number', 'text')
    .addColumn('bank_ifsc', 'text')
    .addColumn('bank_name', 'text')
    .addColumn('bank_branch', 'text')
    .addColumn('footer_note', 'text')
    .addColumn('logo_data', 'blob')
    .addColumn('logo_mime_type', 'text')
    /** 'CLASSIC' | 'MODERN' — see @mhts/print-templates. A config-based layout choice, not a code change. */
    .addColumn('invoice_layout', 'text', (col) => col.notNull().defaultTo('CLASSIC'))
    .addColumn('payslip_layout', 'text', (col) => col.notNull().defaultTo('CLASSIC'))
    /** Hex, e.g. '#1a56db'. Null uses the template's own default accent. */
    .addColumn('accent_color_hex', 'text')
    .addColumn('updated_by', 'text')
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.alterTable('business_party').addColumn('address', 'text').execute();
  await db.schema.alterTable('employee').addColumn('designation', 'text').execute();

  await db.schema.alterTable('sales_invoice_line').addColumn('item_id', 'text', (col) => col.references('item.id')).execute();
  await db.schema.alterTable('sales_invoice_line').addColumn('quantity_thousandths', 'integer').execute();
  await db.schema.alterTable('sales_invoice_line').addColumn('rate_paise', 'integer').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('sales_invoice_line').dropColumn('rate_paise').execute();
  await db.schema.alterTable('sales_invoice_line').dropColumn('quantity_thousandths').execute();
  await db.schema.alterTable('sales_invoice_line').dropColumn('item_id').execute();
  await db.schema.alterTable('employee').dropColumn('designation').execute();
  await db.schema.alterTable('business_party').dropColumn('address').execute();
  await db.schema.dropTable('company_letterhead_profile').execute();
}
