import { Kysely, sql } from 'kysely';

/**
 * Phase 8 Increment 3 (Advanced ERP): Manufacturing — core BOM + a single
 * consume/produce voucher (@mhts/core-manufacturing).
 *
 * `bill_of_material` carries ONE active version per output item at a time —
 * append-only supersede-on-new-version, same pattern as
 * salary_structure/asset_class — enforced in core-manufacturing's single
 * write path, not a DB constraint. `manufacturing_journal` is the register
 * header for a posted consume/produce entry; the actual consumed/produced
 * quantities live in stock_movement (movement_type MANUFACTURING_CONSUME /
 * MANUFACTURING_PRODUCE, reference_type 'MANUFACTURING_JOURNAL' pointing
 * back at this row's id) — same "no redundant line table" choice as
 * STOCK_ADJUSTMENT.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('bill_of_material')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('output_item_id', 'text', (col) => col.notNull().references('item.id'))
    /** Thousandths of a unit. The quantity of output this recipe's component lines are expressed against — a journal producing a different quantity scales every line proportionally. */
    .addColumn('output_quantity_thousandths', 'integer', (col) => col.notNull())
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('bill_of_material_output_item_idx').on('bill_of_material').column('output_item_id').execute();

  await db.schema
    .createTable('bill_of_material_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('bom_id', 'text', (col) => col.notNull().references('bill_of_material.id'))
    .addColumn('component_item_id', 'text', (col) => col.notNull().references('item.id'))
    /** Thousandths of a unit, needed per bill_of_material.output_quantity_thousandths of output. */
    .addColumn('quantity_thousandths', 'integer', (col) => col.notNull())
    .execute();

  await db.schema.createIndex('bill_of_material_line_bom_idx').on('bill_of_material_line').column('bom_id').execute();

  await db.schema
    .createTable('manufacturing_journal')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('bom_id', 'text', (col) => col.notNull().references('bill_of_material.id'))
    .addColumn('output_item_id', 'text', (col) => col.notNull().references('item.id'))
    .addColumn('warehouse_id', 'text', (col) => col.notNull().references('warehouse.id'))
    .addColumn('quantity_produced_thousandths', 'integer', (col) => col.notNull())
    /** Paise. Sum of every component consumed — the produced output is valued at exactly this (no overhead/conversion-cost or wastage absorption this pass). */
    .addColumn('total_cost_paise', 'integer', (col) => col.notNull())
    /** The MANUFACTURING_JOURNAL voucher: Dr/Cr the same Stock-in-Hand ledger for this amount — net GL impact is zero by construction (see core-manufacturing), same precedent as a warehouse-to-warehouse stock transfer, but still gets its own voucher number/audit entry as a distinct financial event. */
    .addColumn('voucher_id', 'text', (col) => col.notNull().references('voucher.id'))
    .addColumn('financial_year', 'text', (col) => col.notNull())
    .addColumn('journal_date', 'text', (col) => col.notNull())
    .addColumn('narration', 'text')
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('manufacturing_journal_bom_idx').on('manufacturing_journal').column('bom_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('manufacturing_journal').execute();
  await db.schema.dropTable('bill_of_material_line').execute();
  await db.schema.dropTable('bill_of_material').execute();
}
