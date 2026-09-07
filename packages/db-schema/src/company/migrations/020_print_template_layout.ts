import { Kysely, sql } from 'kysely';

/**
 * Phase 9 Increment 3 (Print + Templates): the drag-and-drop template
 * designer's persistence. A company's own field-positioned layout is that
 * company's creative configuration, not shared regulatory reference data
 * (unlike GST rates/TDS thresholds), so — per CLAUDE.md Rule #3 (company data
 * isolation) — this lives in the per-company encrypted DB, not the system
 * DB's cross-company `rule_set` table.
 *
 * `document_family` groups the 6 template shapes that already share one
 * renderer each in @mhts/print-templates: SALES_INVOICE, PURCHASE_INVOICE,
 * ORDER (shared by Sales + Purchase Order), VOUCHER (shared by Journal/
 * Payment/Receipt/Contra), EXPENSE_CLAIM, PAYSLIP.
 *
 * Append-only supersede-on-new-version, same `is_active` pattern as
 * core-manufacturing's bill_of_material (never edit a version in place):
 * saving a new layout for a family deactivates that family's previously
 * active row first. At most one active row per family. `layout_json` is an
 * opaque JSON blob to every layer except @mhts/print-templates's
 * TemplateLayoutDocument interpreter — same "payload is caller-owned" shape
 * as core-rules-engine's rule_set.rule_payload.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('print_template_layout')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('document_family', 'text', (col) => col.notNull())
    .addColumn('version', 'integer', (col) => col.notNull())
    .addColumn('name', 'text')
    .addColumn('layout_json', 'text', (col) => col.notNull())
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(1))
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('idx_print_template_layout_family_active').on('print_template_layout').columns(['document_family', 'is_active']).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_print_template_layout_family_active').execute();
  await db.schema.dropTable('print_template_layout').execute();
}
