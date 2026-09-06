import { Kysely, sql } from 'kysely';

/**
 * Phase 6 (Expenses, Travel, Documents).
 *
 * `employee` gets its own dedicated ledger, atomically created — same
 * pattern as `business_party` (migration 005): the employee can't exist
 * without a ledger to accrue reimbursements against, and vice versa.
 *
 * `expense_claim` has no ledger impact until APPROVED (mirrors
 * `sales_order`/`purchase_order` needing their own sequential numbering
 * since they exist before any voucher does — see migration 005's doc
 * comment). Approval posts a real `EXPENSE_CLAIM` voucher (Dr each line's
 * expense ledger, Cr the employee's ledger) — the accrual. Reimbursement is
 * a separate PAYMENT voucher settling the claim via `expense_claim_settlement`,
 * an exact mirror of `sales_invoice_settlement`/`purchase_invoice_settlement`
 * (migration 006).
 *
 * `document_attachment` is generic and entity-agnostic (`entity_type`/
 * `entity_id`, same free-string convention as `audit_log.entity_type`) so
 * any existing or future record can carry an attachment with zero schema
 * changes. Files are stored as BLOBs inside this encrypted company DB
 * (inherits SQLCipher's at-rest encryption for free; `backupCompany`'s
 * whole-file copy needs no changes) — the first `'blob'` column in this
 * schema.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('employee')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('employee_code', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('department', 'text')
    .addColumn('ledger_account_id', 'text', (col) => col.notNull().unique().references('ledger_account.id'))
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('employee_ledger_idx').on('employee').column('ledger_account_id').execute();

  await db.schema
    .createTable('expense_claim')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('employee_id', 'text', (col) => col.notNull().references('employee.id'))
    .addColumn('financial_year', 'text', (col) => col.notNull())
    /** Sequential per financial_year — a claim exists as DRAFT/SUBMITTED before any voucher does, so it needs its own numbering (same reasoning as sales_order/purchase_order). */
    .addColumn('claim_number', 'integer', (col) => col.notNull())
    .addColumn('claim_date', 'text', (col) => col.notNull())
    .addColumn('purpose', 'text')
    /** 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'CANCELLED' — validated in core-expense, not a DB CHECK (voucher_type/party_type/order.status convention). */
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('DRAFT'))
    /** The EXPENSE_CLAIM voucher posted at APPROVAL time — null before that. */
    .addColumn('voucher_id', 'text', (col) => col.references('voucher.id'))
    .addColumn('rejected_reason', 'text')
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('expense_claim_number_unique_idx').on('expense_claim').columns(['financial_year', 'claim_number']).unique().execute();
  await db.schema.createIndex('expense_claim_employee_idx').on('expense_claim').column('employee_id').execute();

  await db.schema
    .createTable('expense_claim_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('expense_claim_id', 'text', (col) => col.notNull().references('expense_claim.id'))
    /** Must resolve to an EXPENSE-nature ledger — validated in core-expense, same as purchase_invoice_line.expense_ledger_id. */
    .addColumn('expense_ledger_id', 'text', (col) => col.notNull().references('ledger_account.id'))
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('expense_date', 'text', (col) => col.notNull())
    /** Paise. */
    .addColumn('amount', 'integer', (col) => col.notNull())
    .addColumn('line_narration', 'text')
    .execute();

  await db.schema.createIndex('expense_claim_line_claim_idx').on('expense_claim_line').column('expense_claim_id').execute();

  await db.schema
    .createTable('expense_claim_settlement')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('expense_claim_id', 'text', (col) => col.notNull().references('expense_claim.id'))
    /** The PAYMENT voucher that reimburses this amount against the claim. */
    .addColumn('voucher_id', 'text', (col) => col.notNull().references('voucher.id'))
    /** Paise. Always > 0 — validated in core-expense, never more than the claim's remaining outstanding at the time. */
    .addColumn('amount_applied', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('expense_claim_settlement_claim_idx').on('expense_claim_settlement').column('expense_claim_id').execute();
  await db.schema.createIndex('expense_claim_settlement_voucher_idx').on('expense_claim_settlement').column('voucher_id').execute();

  await db.schema
    .createTable('document_attachment')
    .addColumn('id', 'text', (col) => col.primaryKey())
    /** Free string, same convention as audit_log.entity_type — e.g. 'Voucher', 'BusinessParty', 'Employee', 'ExpenseClaim', 'BankAccount'. */
    .addColumn('entity_type', 'text', (col) => col.notNull())
    .addColumn('entity_id', 'text', (col) => col.notNull())
    .addColumn('file_name', 'text', (col) => col.notNull())
    .addColumn('mime_type', 'text', (col) => col.notNull())
    .addColumn('file_size_bytes', 'integer', (col) => col.notNull())
    .addColumn('file_data', 'blob', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('uploaded_by', 'text')
    .addColumn('uploaded_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema.createIndex('document_attachment_entity_idx').on('document_attachment').columns(['entity_type', 'entity_id']).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('document_attachment').execute();
  await db.schema.dropTable('expense_claim_settlement').execute();
  await db.schema.dropTable('expense_claim_line').execute();
  await db.schema.dropTable('expense_claim').execute();
  await db.schema.dropTable('employee').execute();
}
