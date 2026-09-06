import { Kysely, sql } from 'kysely';

/**
 * Phase 5 (Banking). The "Bank Accounts" account_group already exists
 * (seeded in Phase 1's chart of accounts) but a bank was, until now, just a
 * plain ledger_account indistinguishable from any other asset ledger.
 *
 * bank_account gets its own dedicated ledger_account, same atomic-creation
 * pattern as business_party (Phase 2) — its balance IS that ledger's
 * balance, so computeLedgerBalances needs zero changes for reconciliation.
 *
 * voucher_payment_instrument is an OPTIONAL 1:1 attachment on any voucher
 * (PAYMENT/RECEIPT/CONTRA/JOURNAL) that moved money via a bank ledger —
 * cheque number/date, UTR, or just an instrument type for NEFT/RTGS/UPI/etc.
 *
 * bank_reconciliation rows are created lazily, one per voucher_line that has
 * been ticked off against a real bank statement (manually or via import) —
 * a voucher_line with no row here is simply unreconciled. This is a pure
 * read/tracking layer: nothing in this migration touches voucher or
 * voucher_line, matching the "reconciliation never mutates the ledger"
 * design intent.
 *
 * bank_statement_import/bank_statement_line back the CSV bank-statement
 * importer: one row per imported file, one row per parsed statement line,
 * with match_status/matched_voucher_line_id recording the outcome of
 * suggestMatches (core-banking) and any manual resolution afterwards.
 * `direction` uses the BANK's own statement terminology (CREDIT = money the
 * bank put into the account, DEBIT = money the bank took out) — the
 * opposite sense of our own ledger's debit/credit convention on an asset
 * ledger. This is deliberate (it's what actually appears in a bank's CSV
 * export) and every consumer of this column must apply the flip, not undo
 * it here.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('bank_account')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('ledger_account_id', 'text', (col) => col.notNull().unique().references('ledger_account.id'))
    .addColumn('account_number', 'text', (col) => col.notNull())
    .addColumn('ifsc_code', 'text', (col) => col.notNull())
    .addColumn('bank_name', 'text', (col) => col.notNull())
    .addColumn('branch_name', 'text')
    /** 'SAVINGS' | 'CURRENT' | 'CC' | 'OD' — fixed taxonomy, JS-validated in core-banking (same convention as voucher_type/party_type) — NOT a rule_set, Rule #2 governs legislated rates/formulas, not this. */
    .addColumn('account_type', 'text', (col) => col.notNull())
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('bank_account_ledger_idx').on('bank_account').column('ledger_account_id').execute();

  await db.schema
    .createTable('voucher_payment_instrument')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('voucher_id', 'text', (col) => col.notNull().unique().references('voucher.id'))
    /** 'CASH' | 'CHEQUE' | 'NEFT' | 'RTGS' | 'UPI' | 'IMPS' | 'DD' | 'CARD' — JS-validated closed list (core-banking). */
    .addColumn('instrument_type', 'text', (col) => col.notNull())
    .addColumn('cheque_number', 'text')
    .addColumn('cheque_date', 'text')
    .addColumn('utr_reference', 'text')
    /** 'PENDING' | 'PRESENTED' | 'CLEARED' | 'BOUNCED' | 'CANCELLED'. */
    .addColumn('instrument_status', 'text', (col) => col.notNull().defaultTo('PENDING'))
    .addColumn('status_date', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createIndex('voucher_payment_instrument_status_idx')
    .on('voucher_payment_instrument')
    .column('instrument_status')
    .execute();

  await db.schema
    .createTable('bank_reconciliation')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('voucher_line_id', 'text', (col) => col.notNull().unique().references('voucher_line.id'))
    .addColumn('is_reconciled', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('reconciled_at', 'text')
    .addColumn('reconciled_by', 'text')
    /** The real date this movement appeared on the bank statement — can differ from voucher_date. */
    .addColumn('bank_statement_date', 'text')
    /** 'MANUAL' | 'IMPORT' — how this line came to be marked reconciled. */
    .addColumn('matched_via', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('bank_statement_import')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('bank_account_id', 'text', (col) => col.notNull().references('bank_account.id'))
    .addColumn('file_name', 'text', (col) => col.notNull())
    .addColumn('imported_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    /** AppUser.id from the system DB — not a foreign key here (cross-file, same pattern as voucher.created_by). */
    .addColumn('imported_by', 'text')
    .addColumn('total_lines', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('matched_lines', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('unmatched_lines', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema.createIndex('bank_statement_import_account_idx').on('bank_statement_import').column('bank_account_id').execute();

  await db.schema
    .createTable('bank_statement_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('import_id', 'text', (col) => col.notNull().references('bank_statement_import.id'))
    /** Denormalized from the parent import so duplicate-detection can query across ALL imports for this account without a join. */
    .addColumn('bank_account_id', 'text', (col) => col.notNull().references('bank_account.id'))
    .addColumn('statement_date', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    /** Always positive. Paise. */
    .addColumn('amount_paise', 'integer', (col) => col.notNull())
    /** 'CREDIT' | 'DEBIT' — the BANK's own terminology (CREDIT = deposit into the account, DEBIT = withdrawal). See migration doc comment: this is the OPPOSITE sense of our own ledger's debit/credit on an asset ledger. */
    .addColumn('direction', 'text', (col) => col.notNull())
    /** 'MATCHED' | 'UNMATCHED' | 'IGNORED'. */
    .addColumn('match_status', 'text', (col) => col.notNull().defaultTo('UNMATCHED'))
    .addColumn('matched_voucher_line_id', 'text', (col) => col.references('voucher_line.id'))
    /** Set when an identical (bank_account_id, statement_date, amount_paise, description) tuple already exists from a prior import — flagged, never silently blocked (a genuine repeat can legitimately occur). */
    .addColumn('is_likely_duplicate', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('bank_statement_line_import_idx').on('bank_statement_line').column('import_id').execute();
  await db.schema
    .createIndex('bank_statement_line_dedup_idx')
    .on('bank_statement_line')
    .columns(['bank_account_id', 'statement_date', 'amount_paise'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('bank_statement_line').execute();
  await db.schema.dropTable('bank_statement_import').execute();
  await db.schema.dropTable('bank_reconciliation').execute();
  await db.schema.dropTable('voucher_payment_instrument').execute();
  await db.schema.dropTable('bank_account').execute();
}
