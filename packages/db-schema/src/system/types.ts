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
  /** 'REGULAR' | 'COMPOSITION' — see @mhts/core-gst-engine. Set once at company creation, not editable afterward in this pass. */
  gst_registration_type: string;
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
  /** Globally unique identity anchor. The password itself is per-company (see CompanyAccessTable) — a person can have independent credentials for each company they access. */
  email: string;
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
  /**
   * Per-company password (2026-09-05, amended: moved off AppUserTable — see
   * Phase Tracker Key Decisions Log). Keeping the password on the same row as
   * the DEK wrap it unlocks means a reset for one company can never affect
   * any other company the same person has access to.
   */
  password_hash: string | null;
  /** Set by an admin-initiated reset (see @mhts/core-identity's SYSTEM.RESET_USER_PASSWORD); the user must set a real password on next login before a session is established. */
  must_change_password: ColumnType<boolean, boolean | number, boolean | number>;
  failed_login_count: ColumnType<number, number | undefined, number>;
  /** Null when not currently locked out. */
  locked_until: string | null;
  last_failed_attempt_at: string | null;
  /** Company DB's SQLCipher data key (DEK), AES-256-GCM-wrapped under a KEK derived from this row's password. Null only transiently during the 002 migration. */
  wrapped_dek: string | null;
  wrap_iv: string | null;
  wrap_auth_tag: string | null;
  wrap_kek_salt: string | null;
}

export interface SecurityPolicyTable {
  /** Singleton row, fixed id 'default'. Global (not per-company) — lockout thresholds are an installation-wide policy; the lockout *state* they govern is per company_access. */
  id: string;
  max_failed_attempts: number;
  lockout_duration_seconds: number;
  /** Delay before attempt N (after the first failure) is `backoff_base_seconds * 2^(N-1)` seconds, up to the lockout threshold. */
  backoff_base_seconds: number;
  updated_at: ColumnType<string, string | undefined, string>;
}

export interface CompanyRecoveryKeyTable {
  company_id: string;
  /** Company DEK, AES-256-GCM-wrapped directly under the recovery key's own bytes (no password/KDF involved — see keyWrap.ts). Shown to the user once, at company creation; unrecoverable if lost. */
  wrapped_dek: string;
  wrap_iv: string;
  wrap_auth_tag: string;
  created_at: ColumnType<string, string | undefined, never>;
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

export interface AppPreferenceTable {
  /** Singleton row, fixed id 'default'. Installation-wide (not per-company), same reasoning as SecurityPolicyTable. */
  id: string;
  /** 'LIGHT' | 'DARK' | 'SYSTEM' — validated in application code. */
  theme: string;
  updated_at: ColumnType<string, string | undefined, string>;
}

export interface LicenseActivationTable {
  /** Singleton row, fixed id 'default'. */
  id: string;
  license_id: string;
  machine_id: string;
  activated_at: ColumnType<string, string | undefined, string>;
}

export interface SystemDatabase {
  company: CompanyTable;
  app_user: AppUserTable;
  company_access: CompanyAccessTable;
  company_recovery_key: CompanyRecoveryKeyTable;
  security_policy: SecurityPolicyTable;
  rule_set: RuleSetTable;
  app_preference: AppPreferenceTable;
  license_activation: LicenseActivationTable;
}
