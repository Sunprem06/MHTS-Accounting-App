import { Kysely, sql } from 'kysely';

/**
 * Phase 8 Increment 1 (Advanced ERP): Fixed Assets, dual depreciation.
 *
 * Two independent depreciation "books" per asset — Companies Act Schedule II
 * (accounting books, GL-posted) and Income Tax Act WDV block (tax books,
 * memo-only) — per CLAUDE.md's Fixed Assets requirement. Both books' RATES
 * come from @mhts/core-rules-engine's rule_set table (system DB), never a
 * hardcoded column here (Rule #2) — this schema only stores which rate
 * *category* an asset class belongs to.
 *
 * `asset_class` carries its own dedicated gross-block and
 * accumulated-depreciation ledgers (own-ledger-per-record pattern already
 * used for business_party/bank_account/employee) — kept at the CLASS level,
 * not per physical asset unit, so the chart of accounts doesn't explode for
 * a business with many like-kind assets (e.g. 50 laptops); the individual
 * unit register lives in `fixed_asset`.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('asset_class')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    /** Matches a rule_set payload key for rule_type FIXED_ASSET_SCHEDULE2_RATE. */
    .addColumn('schedule2_rate_category', 'text', (col) => col.notNull())
    /** Matches a rule_set payload key for rule_type FIXED_ASSET_IT_WDV_BLOCK_RATE. */
    .addColumn('it_wdv_block_category', 'text', (col) => col.notNull())
    .addColumn('gross_block_ledger_id', 'text', (col) => col.notNull().unique().references('ledger_account.id'))
    .addColumn('accumulated_depreciation_ledger_id', 'text', (col) => col.notNull().unique().references('ledger_account.id'))
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('fixed_asset')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('asset_class_id', 'text', (col) => col.notNull().references('asset_class.id'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('asset_code', 'text', (col) => col.notNull().unique())
    .addColumn('purchase_date', 'text', (col) => col.notNull())
    /** Paise. Gross block for this unit — the ASSET_ACQUISITION voucher's debit to the class's gross-block ledger. */
    .addColumn('purchase_cost_paise', 'integer', (col) => col.notNull())
    /** Paise. Residual value below which Schedule II SLM depreciation stops. */
    .addColumn('salvage_value_paise', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('cost_centre_id', 'text', (col) => col.references('cost_centre.id'))
    /** 'ACTIVE' | 'DISPOSED' — validated in core-fixed-assets, same convention as voucher_type/status columns elsewhere. */
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('ACTIVE'))
    .addColumn('disposed_at', 'text')
    /** The ASSET_ACQUISITION voucher that brought this unit onto the books. */
    .addColumn('acquisition_voucher_id', 'text', (col) => col.references('voucher.id'))
    /** The ASSET_DISPOSAL voucher, set only once disposed. */
    .addColumn('disposal_voucher_id', 'text', (col) => col.references('voucher.id'))
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('fixed_asset_class_idx').on('fixed_asset').column('asset_class_id').execute();

  await db.schema
    .createTable('asset_depreciation_entry')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('asset_id', 'text', (col) => col.notNull().references('fixed_asset.id'))
    /** 'SCHEDULE2' | 'IT_WDV' — the two independent books. */
    .addColumn('book', 'text', (col) => col.notNull())
    .addColumn('financial_year', 'text', (col) => col.notNull())
    /** Paise, all three. */
    .addColumn('opening_wdv_paise', 'integer', (col) => col.notNull())
    .addColumn('depreciation_amount_paise', 'integer', (col) => col.notNull())
    .addColumn('closing_wdv_paise', 'integer', (col) => col.notNull())
    /** Only ever set for book = 'SCHEDULE2' — IT_WDV is a memo/tax-computation, never GL-posted (real IT WDV blocks are pooled, not booked per asset). */
    .addColumn('voucher_id', 'text', (col) => col.references('voucher.id'))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('asset_depreciation_entry_asset_idx').on('asset_depreciation_entry').column('asset_id').execute();
  await db.schema
    .createIndex('asset_depreciation_entry_unique_idx')
    .on('asset_depreciation_entry')
    .columns(['asset_id', 'book', 'financial_year'])
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('asset_depreciation_entry').execute();
  await db.schema.dropTable('fixed_asset').execute();
  await db.schema.dropTable('asset_class').execute();
}
