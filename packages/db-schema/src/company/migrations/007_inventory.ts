import { Kysely, sql } from 'kysely';

/**
 * Phase 3 (Inventory). Quantities are stored as integers in thousandths of a
 * unit (3-decimal precision, matching GST e-invoice quantity precision) —
 * the same "never REAL/float" discipline already used for money (paise),
 * applied here to avoid the identical class of rounding bug in valuation
 * math. Money stays in paise throughout.
 *
 * `stock_movement` is an append-only historical ledger (no UPDATE/DELETE
 * path — same convention as audit_log/voucher_line). `stock_receipt_layer`
 * is the one genuinely stateful piece: FIFO cost-of-goods-sold is an ordered
 * consumption algorithm, not a pure derivable aggregate, so a layer's
 * quantity_remaining/value_remaining is mutated as it's drawn down.
 * value_remaining_paise lets the draw that fully drains a layer absorb
 * whatever paise remain instead of a freshly-rounded qty*rate, so partial-
 * issue rounding can never let a layer's total issued cost drift from what
 * it actually cost to receive. Everything else (on-hand position,
 * weighted-average cost) is derived on the fly, mirroring
 * core-accounting's computeLedgerBalances — no cached balance table.
 *
 * stock_movement_layer_consumption records exactly which layer(s) a
 * SALES_ISSUE/TRANSFER_OUT drew from, so a future reversal pass (cancelling
 * a stockable invoice) has the data to reverse precisely, without a
 * backfill. Full automatic reversal is NOT built in this pass — see
 * core-sales-purchase's cancellation guard — but the data to support it is
 * captured from day one.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('unit_of_measure')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('symbol', 'text', (col) => col.notNull())
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('warehouse')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('address', 'text')
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('item')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('item_code', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    /** 'STOCKABLE' | 'SERVICE' — validated in application code (core-inventory), same convention as party_type/voucher_type. */
    .addColumn('item_type', 'text', (col) => col.notNull())
    .addColumn('unit_id', 'text', (col) => col.references('unit_of_measure.id'))
    /** Captured now, used from Phase 4 (GST engine) — not read anywhere in this pass. */
    .addColumn('hsn_sac_code', 'text')
    .addColumn('is_batch_tracked', 'integer', (col) => col.notNull().defaultTo(0))
    /** 'FIFO' | 'WEIGHTED_AVERAGE' — only meaningful for STOCKABLE items. */
    .addColumn('valuation_method', 'text')
    .addColumn('default_sales_ledger_id', 'text', (col) => col.references('ledger_account.id'))
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('item_type_idx').on('item').column('item_type').execute();

  await db.schema
    .createTable('item_batch')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('item_id', 'text', (col) => col.notNull().references('item.id'))
    .addColumn('batch_number', 'text', (col) => col.notNull())
    .addColumn('expiry_date', 'text')
    .addColumn('manufacture_date', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('item_batch_unique_idx').on('item_batch').columns(['item_id', 'batch_number']).unique().execute();

  await db.schema
    .createTable('stock_movement')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('item_id', 'text', (col) => col.notNull().references('item.id'))
    .addColumn('warehouse_id', 'text', (col) => col.notNull().references('warehouse.id'))
    .addColumn('batch_id', 'text', (col) => col.references('item_batch.id'))
    /** 'OPENING_STOCK' | 'PURCHASE_RECEIPT' | 'SALES_ISSUE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER_OUT' | 'TRANSFER_IN'. */
    .addColumn('movement_type', 'text', (col) => col.notNull())
    /** Thousandths of a unit. Always positive — direction comes from movement_type. */
    .addColumn('quantity_thousandths', 'integer', (col) => col.notNull())
    /** Paise, per whole unit. */
    .addColumn('rate_paise', 'integer', (col) => col.notNull())
    /** Paise. quantity's cost/value at this movement — stored explicitly, never recomputed, since this is an append-only historical ledger. */
    .addColumn('value_paise', 'integer', (col) => col.notNull())
    /** e.g. 'SALES_INVOICE_LINE' | 'PURCHASE_INVOICE_LINE' | 'STOCK_ADJUSTMENT' | 'STOCK_TRANSFER' | 'OPENING_STOCK' — nullable for movements with no source document. */
    .addColumn('reference_type', 'text')
    .addColumn('reference_id', 'text')
    .addColumn('movement_date', 'text', (col) => col.notNull())
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('stock_movement_item_warehouse_idx').on('stock_movement').columns(['item_id', 'warehouse_id']).execute();
  await db.schema.createIndex('stock_movement_reference_idx').on('stock_movement').columns(['reference_type', 'reference_id']).execute();

  await db.schema
    .createTable('stock_receipt_layer')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('item_id', 'text', (col) => col.notNull().references('item.id'))
    .addColumn('warehouse_id', 'text', (col) => col.notNull().references('warehouse.id'))
    .addColumn('batch_id', 'text', (col) => col.references('item_batch.id'))
    .addColumn('source_movement_id', 'text', (col) => col.notNull().references('stock_movement.id'))
    .addColumn('quantity_remaining_thousandths', 'integer', (col) => col.notNull())
    /** Paise. Decremented by the actual rounded cost charged to each draw — the draw that fully drains this layer absorbs whatever remains, so rounding can never drift the layer's total issued cost from its received value. */
    .addColumn('value_remaining_paise', 'integer', (col) => col.notNull())
    .addColumn('rate_paise', 'integer', (col) => col.notNull())
    .addColumn('received_at', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('stock_receipt_layer_scope_idx').on('stock_receipt_layer').columns(['item_id', 'warehouse_id', 'batch_id']).execute();

  await db.schema
    .createTable('stock_movement_layer_consumption')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('movement_id', 'text', (col) => col.notNull().references('stock_movement.id'))
    .addColumn('layer_id', 'text', (col) => col.notNull().references('stock_receipt_layer.id'))
    .addColumn('quantity_consumed_thousandths', 'integer', (col) => col.notNull())
    .addColumn('value_consumed_paise', 'integer', (col) => col.notNull())
    .execute();

  await db.schema.createIndex('stock_movement_layer_consumption_movement_idx').on('stock_movement_layer_consumption').column('movement_id').execute();

  // Optional item/quantity fields on order lines — nullable, so an order
  // line with no item behaves exactly as it did before this migration.
  // Carried forward into the invoice at conversion time (see
  // convertSalesOrderToInvoice/convertPurchaseOrderToInvoice).
  await db.schema.alterTable('sales_order_line').addColumn('item_id', 'text', (col) => col.references('item.id')).execute();
  await db.schema.alterTable('sales_order_line').addColumn('warehouse_id', 'text', (col) => col.references('warehouse.id')).execute();
  await db.schema.alterTable('sales_order_line').addColumn('quantity_thousandths', 'integer').execute();
  await db.schema.alterTable('sales_order_line').addColumn('rate_paise', 'integer').execute();

  await db.schema.alterTable('purchase_order_line').addColumn('item_id', 'text', (col) => col.references('item.id')).execute();
  await db.schema.alterTable('purchase_order_line').addColumn('warehouse_id', 'text', (col) => col.references('warehouse.id')).execute();
  await db.schema.alterTable('purchase_order_line').addColumn('quantity_thousandths', 'integer').execute();
  await db.schema.alterTable('purchase_order_line').addColumn('rate_paise', 'integer').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('stock_movement_layer_consumption').execute();
  await db.schema.dropTable('stock_receipt_layer').execute();
  await db.schema.dropTable('stock_movement').execute();
  await db.schema.dropTable('item_batch').execute();
  await db.schema.dropTable('item').execute();
  await db.schema.dropTable('warehouse').execute();
  await db.schema.dropTable('unit_of_measure').execute();
}
