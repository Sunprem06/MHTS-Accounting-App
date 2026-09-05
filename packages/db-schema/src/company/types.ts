import type { ColumnType, Generated } from 'kysely';

/**
 * Company DB: one encrypted SQLite file per company (Rule #3). Holds
 * company-scoped RBAC, this company's append-only audit trail, and (from
 * Phase 1) the accounting core: chart of accounts and vouchers. Amounts are
 * stored as integers in paise everywhere, never REAL/float.
 */

export interface RoleTable {
  id: string;
  name: string;
  is_system_role: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface PermissionTable {
  id: string;
  code: string;
  description: string | null;
}

export interface RolePermissionTable {
  role_id: string;
  permission_id: string;
}

export interface AuditLogTable {
  /** Autoincrement integer, not a uuid — ordering by primary key is what makes the hash chain meaningful. */
  id: Generated<number>;
  actor_user_id: string | null;
  /** AuditAction from @mhts/shared-types. */
  action: string;
  entity_type: string;
  entity_id: string;
  before_data: string | null;
  after_data: string | null;
  timestamp: ColumnType<string, string | undefined, never>;
  /** Hash of the previous row (null for the very first row) — chained for tamper evidence. */
  prev_hash: string | null;
  /** Hash of this row's own payload + prev_hash. Computed by the audit-writing service, not the DB. */
  hash: string;
}

export interface AccountGroupTable {
  id: string;
  name: string;
  parent_group_id: string | null;
  /** 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE' — see @mhts/core-accounting. */
  nature: string;
  is_system_group: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface LedgerAccountTable {
  id: string;
  name: string;
  group_id: string;
  /** Paise. */
  opening_balance: number;
  /** 'DEBIT' | 'CREDIT'. */
  opening_balance_side: string;
  is_system_ledger: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface VoucherTable {
  id: string;
  /** 'JOURNAL' | 'PAYMENT' | 'RECEIPT' | 'CONTRA' — see @mhts/core-accounting. */
  voucher_type: string;
  /** e.g. '2026-27'. */
  financial_year: string;
  voucher_number: number;
  voucher_date: string;
  narration: string | null;
  /** AppUser.id from the system DB — not a foreign key here (cross-file). */
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
  /** Set when this voucher has been cancelled — see cancelled_by_voucher_id. Cancellation is a reversal voucher, never a destructive edit. */
  cancelled_at: string | null;
  /** The reversal voucher that cancels this one, once cancelled_at is set. */
  cancelled_by_voucher_id: string | null;
  /** Set on a reversal voucher itself, pointing back at the voucher it reverses. */
  reverses_voucher_id: string | null;
}

export interface VoucherLineTable {
  id: string;
  voucher_id: string;
  ledger_id: string;
  /** Paise. Exactly one of debit_amount/credit_amount is non-zero per line. */
  debit_amount: number;
  credit_amount: number;
  line_narration: string | null;
}

export interface BusinessPartyTable {
  id: string;
  /** 'CUSTOMER' | 'SUPPLIER' | 'BOTH' — see @mhts/core-sales-purchase. */
  party_type: string;
  name: string;
  gstin: string | null;
  state_code: string | null;
  /** Section 43B(h) — Udyam-registered MSME vendors unpaid past 45 days are tax-disallowed. */
  is_msme_udyam_registered: ColumnType<boolean, boolean | number, boolean | number>;
  udyam_registration_number: string | null;
  credit_period_days: number | null;
  /** This party's own sub-ledger under Sundry Debtors/Sundry Creditors — its balance IS the party's outstanding amount. */
  ledger_account_id: string;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SalesInvoiceTable {
  id: string;
  party_id: string;
  invoice_date: string;
  narration: string | null;
  /** The invoice number IS voucher.voucher_number, joined via this id — never duplicated. */
  voucher_id: string;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SalesInvoiceLineTable {
  id: string;
  sales_invoice_id: string;
  description: string;
  income_ledger_id: string;
  /** Paise. Taxable value. */
  amount: number;
  /** Manually entered — GST rules engine lands in Phase 4 (Rule #2: never hardcode a rate). */
  tax_ledger_id: string | null;
  tax_amount: number;
  line_narration: string | null;
}

export interface PurchaseInvoiceTable {
  id: string;
  party_id: string;
  invoice_date: string;
  narration: string | null;
  voucher_id: string;
  /** Snapshot of business_party.is_msme_udyam_registered at creation time. */
  is_msme_vendor: ColumnType<boolean, boolean | number, boolean | number>;
  due_date: string;
  /** e.g. '194C'. Null if no TDS deducted. Rate resolved from rule_set (system DB), never hardcoded. */
  tds_section: string | null;
  tds_amount: number;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface PurchaseInvoiceLineTable {
  id: string;
  purchase_invoice_id: string;
  description: string;
  expense_ledger_id: string;
  /** Paise. Taxable value. */
  amount: number;
  tax_ledger_id: string | null;
  tax_amount: number;
  line_narration: string | null;
}

export interface SalesOrderTable {
  id: string;
  financial_year: string;
  order_number: number;
  party_id: string;
  order_date: string;
  /** 'DRAFT' | 'CONFIRMED' | 'CONVERTED' | 'CANCELLED'. */
  status: string;
  narration: string | null;
  converted_to_invoice_id: string | null;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SalesOrderLineTable {
  id: string;
  sales_order_id: string;
  description: string;
  income_ledger_id: string;
  amount: number;
  tax_ledger_id: string | null;
  tax_amount: number;
  line_narration: string | null;
}

export interface PurchaseOrderTable {
  id: string;
  financial_year: string;
  order_number: number;
  party_id: string;
  order_date: string;
  status: string;
  narration: string | null;
  tds_section: string | null;
  converted_to_invoice_id: string | null;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface PurchaseOrderLineTable {
  id: string;
  purchase_order_id: string;
  description: string;
  expense_ledger_id: string;
  amount: number;
  tax_ledger_id: string | null;
  tax_amount: number;
  line_narration: string | null;
}

export interface CompanyDatabase {
  role: RoleTable;
  permission: PermissionTable;
  role_permission: RolePermissionTable;
  audit_log: AuditLogTable;
  account_group: AccountGroupTable;
  ledger_account: LedgerAccountTable;
  voucher: VoucherTable;
  voucher_line: VoucherLineTable;
  business_party: BusinessPartyTable;
  sales_invoice: SalesInvoiceTable;
  sales_invoice_line: SalesInvoiceLineTable;
  purchase_invoice: PurchaseInvoiceTable;
  purchase_invoice_line: PurchaseInvoiceLineTable;
  sales_order: SalesOrderTable;
  sales_order_line: SalesOrderLineTable;
  purchase_order: PurchaseOrderTable;
  purchase_order_line: PurchaseOrderLineTable;
}
