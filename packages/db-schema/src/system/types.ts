import type { ColumnType } from 'kysely';

/**
 * System DB: one file per installation (not per company). Holds the company
 * registry, login identities, cross-company access grants, and the shared
 * GST/Payroll RuleSet reference data. See CLAUDE.md Rule #3 — this file is
 * the deliberate exception to "no cross-company tables": it holds the
 * registry, never business/transactional data.
 */

export interface CompanyTable {
  id: string;
  legal_name: string;
  trade_name: string | null;
  /** EntityType from @mhts/shared-types — text column, service-validated, not a DB enum. */
  entity_type: string;
  gstin: string | null;
  pan: string | null;
  tan: string | null;
  cin: string | null;
  state_code: string | null;
  financial_year_start_month: number;
  base_currency: string;
  /** Path to this company's own encrypted SQLite file. */
  db_file_path: string;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string>;
}

export interface AppUserTable {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface CompanyAccessTable {
  id: string;
  app_user_id: string;
  company_id: string;
  /** References Role.id inside that company's own DB — not a foreign key here (cross-file). */
  role_id: string;
  granted_at: ColumnType<string, string | undefined, never>;
  revoked_at: string | null;
}

export interface RuleSetTable {
  id: string;
  /** Controlled vocabulary validated by the rules-resolution service, not a DB CHECK enum
   *  (Rule #2 — adding a new rule_type must never require a schema migration). */
  rule_type: string;
  /** e.g. 'IN', 'IN-TN'. Null = national/default. */
  jurisdiction: string | null;
  effective_from: string;
  /** Null = currently open-ended (no known end date yet). */
  effective_to: string | null;
  /** JSON text. Shape is governed by rule_type, interpreted only by the rules-resolution service. */
  rule_payload: string;
  version: number;
  /** RuleSetStatus from @mhts/shared-types. */
  status: string;
  /** e.g. "CBIC Notification No. X dated 22-Sep-2025" — compliance audit traceability. */
  source_reference: string | null;
  superseded_by_id: string | null;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SystemDatabase {
  company: CompanyTable;
  app_user: AppUserTable;
  company_access: CompanyAccessTable;
  rule_set: RuleSetTable;
}
