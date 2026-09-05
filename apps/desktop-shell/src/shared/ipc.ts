/**
 * The only contract shared between main and renderer. Keeping it here (not
 * importing db-schema/core-* types directly into the renderer) is the IPC
 * boundary: business logic and DB access stay in the main process (Rule #1).
 */

export interface CompanySummary {
  id: string;
  legalName: string;
  tradeName: string | null;
  entityType: string;
  isActive: boolean;
}

export interface CreateCompanyInput {
  legalName: string;
  tradeName: string;
  entityType: string;
  stateCode: string;
  financialYearStartMonth: number;
  baseCurrency: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface CreateCompanyResult {
  company: CompanySummary;
  /** Shown to the user exactly once — never retrievable again. See RecoveryKeyScreen. */
  recoveryKey: string;
}

export interface LoginInput {
  companyId: string;
  email: string;
  password: string;
}

/** A successful login either yields a session, or — if this credential was set by an admin reset — requires the user to set a real password first. */
export type LoginResult = { mustChangePassword: true } | { mustChangePassword: false; session: SessionInfo };

export interface ChangePasswordInput {
  companyId: string;
  email: string;
  /** The password the user just logged in with (temporary or otherwise) — re-verified server-side, never trusted from a prior call. */
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordInput {
  companyId: string;
  email: string;
  recoveryKey: string;
  newPassword: string;
}

/** Requires the caller's session to already carry SYSTEM.RESET_USER_PASSWORD for the company it's scoped to — see main/handlers.ts. The temporary password is generated server-side, never supplied by the caller. */
export interface AdminResetPasswordInput {
  targetEmail: string;
}

export interface AdminResetPasswordResult {
  temporaryPassword: string;
}

export interface CompanyUserSummary {
  email: string;
  name: string;
  roleName: string;
}

export interface SessionInfo {
  userId: string;
  userName: string;
  email: string;
  companyId: string;
  companyName: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

export interface IpcResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const IPC = {
  LIST_COMPANIES: 'system:listCompanies',
  CREATE_COMPANY: 'system:createCompany',
  LIST_COMPANY_USERS: 'system:listCompanyUsers',
  LOGIN: 'auth:login',
  LOGOUT: 'auth:logout',
  GET_SESSION: 'auth:getSession',
  CHANGE_PASSWORD: 'auth:changePassword',
  RESET_PASSWORD: 'auth:resetPassword',
  ADMIN_RESET_PASSWORD: 'auth:adminResetPassword',
} as const;
