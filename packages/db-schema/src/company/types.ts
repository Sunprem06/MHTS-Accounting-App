import type { ColumnType, Generated } from 'kysely';

/**
 * Company DB: one encrypted SQLite file per company (Rule #3). Holds
 * company-scoped RBAC and this company's append-only audit trail. Ledgers,
 * vouchers, invoices etc. are added table-by-table in the phases that need
 * them (Phase 1+) — this migration only covers Phase 0's Foundation scope.
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

export interface CompanyDatabase {
  role: RoleTable;
  permission: PermissionTable;
  role_permission: RolePermissionTable;
  audit_log: AuditLogTable;
}
