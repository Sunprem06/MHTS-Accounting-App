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

export interface CompanyDatabase {
  role: RoleTable;
  permission: PermissionTable;
  role_permission: RolePermissionTable;
  audit_log: AuditLogTable;
  account_group: AccountGroupTable;
  ledger_account: LedgerAccountTable;
  voucher: VoucherTable;
  voucher_line: VoucherLineTable;
}
