import { randomUUID } from 'node:crypto';
import type { Kysely, Selectable } from 'kysely';
import type { CompanyTable, SystemDatabase } from '@mhts/db-schema';
import {
  hashPassword,
  verifyPassword,
  generateDataKey,
  generateRecoveryKey,
  generateTemporaryPassword,
  wrapDataKey,
  unwrapDataKey,
  wrapWithRawKey,
  unwrapWithRawKey,
  formatRecoveryKey,
  parseRecoveryKey,
  seedAdminRole,
  resolvePermissions,
} from '@mhts/core-identity';
import { seedChartOfAccounts, grantAccountingPermissions } from '@mhts/core-accounting';
import { seedSalesPurchaseLedgers, grantSalesPurchasePermissions } from '@mhts/core-sales-purchase';
import { seedInventoryLedgers, grantInventoryPermissions } from '@mhts/core-inventory';
import { seedGstLedgers, grantGstPermissions } from '@mhts/core-gst-engine';
import type { AppPaths } from './db';
import { companyDbFilePath, createAndMigrateCompanyDb, openExistingCompanyDb } from './db';
import { checkLicenseStatus } from './licenseHandlers';
import { session } from './session';
import { loadSecurityPolicy, assertNotLocked, recordFailedAttempt, clearedLockoutColumns } from './lockout';
import type {
  AdminResetPasswordInput,
  AdminResetPasswordResult,
  ChangePasswordInput,
  CompanySummary,
  CompanyUserSummary,
  CreateCompanyInput,
  CreateCompanyResult,
  InviteUserInput,
  InviteUserResult,
  LoginInput,
  LoginResult,
  ResetPasswordInput,
  RoleSummary,
  SessionInfo,
} from '../shared/ipc';

const INVALID_CREDENTIALS = 'Invalid email or password';
const IS_ACTIVE = 1 as unknown as boolean; // better-sqlite3 only binds numbers/strings/bigints/buffers/null, not JS booleans.

/** Both a normal login and a post-reset login end up here: open the (already-unwrapped) Company DB, resolve the role/permissions, and start the session. */
async function establishSession(
  company: Selectable<CompanyTable>,
  userId: string,
  userName: string,
  userEmail: string,
  roleId: string,
  dek: Buffer,
): Promise<SessionInfo> {
  const companyDb = openExistingCompanyDb(company.db_file_path, dek);
  const role = await companyDb.selectFrom('role').selectAll().where('id', '=', roleId).executeTakeFirst();
  if (!role) {
    await companyDb.destroy();
    throw new Error('Assigned role no longer exists');
  }
  const permissions = await resolvePermissions(companyDb, roleId);

  const info: SessionInfo = {
    userId,
    userName,
    email: userEmail,
    companyId: company.id,
    companyName: company.trade_name || company.legal_name,
    roleId: role.id,
    roleName: role.name,
    permissions,
  };
  session.set(info, companyDb, dek);
  return info;
}

export async function listCompanies(systemDb: Kysely<SystemDatabase>): Promise<CompanySummary[]> {
  const rows = await systemDb
    .selectFrom('company')
    .select(['id', 'legal_name', 'trade_name', 'entity_type', 'is_active'])
    .orderBy('legal_name')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    legalName: row.legal_name,
    tradeName: row.trade_name,
    entityType: row.entity_type,
    isActive: Boolean(row.is_active),
  }));
}

/**
 * Soft license gate (Blueprint §2, Phase 0): only company creation is
 * blocked without a valid, activated license — an already-open company keeps
 * working regardless, so a lapsed/missing license can never lock a customer
 * out of their own existing data (only stops NEW company creation until
 * re-activated). See Phase Tracker Key Decisions Log for why "soft" was
 * chosen over refusing to start the app at all.
 */
export async function createCompany(
  systemDb: Kysely<SystemDatabase>,
  paths: AppPaths,
  input: CreateCompanyInput,
): Promise<CreateCompanyResult> {
  const licenseStatus = await checkLicenseStatus(systemDb, paths);
  if (!licenseStatus.valid) {
    throw new Error(`A valid license is required to create a company. ${licenseStatus.reason ?? ''} Activate one from the Company List screen.`);
  }
  if (licenseStatus.payload?.maxCompanies !== null && licenseStatus.payload?.maxCompanies !== undefined) {
    const existingCount = await systemDb.selectFrom('company').select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
    if (Number(existingCount.count) >= licenseStatus.payload.maxCompanies) {
      throw new Error(`This license allows at most ${licenseStatus.payload.maxCompanies} companies. Upgrade the license to create more.`);
    }
  }

  const companyId = randomUUID();
  const filePath = companyDbFilePath(paths, companyId);
  const dek = generateDataKey();

  const companyDb = await createAndMigrateCompanyDb(filePath, dek);
  const adminRoleId = await seedAdminRole(companyDb);
  await grantAccountingPermissions(companyDb, adminRoleId);
  await seedChartOfAccounts(companyDb);
  await grantSalesPurchasePermissions(companyDb, adminRoleId);
  await seedSalesPurchaseLedgers(companyDb);
  await grantInventoryPermissions(companyDb, adminRoleId);
  await seedInventoryLedgers(companyDb);
  await grantGstPermissions(companyDb, adminRoleId);
  await seedGstLedgers(companyDb);
  await companyDb.destroy();

  await systemDb
    .insertInto('company')
    .values({
      id: companyId,
      legal_name: input.legalName,
      trade_name: input.tradeName || null,
      entity_type: input.entityType,
      state_code: input.stateCode || null,
      gst_registration_type: input.gstRegistrationType,
      financial_year_start_month: input.financialYearStartMonth,
      base_currency: input.baseCurrency,
      db_file_path: filePath,
      is_active: 1,
    })
    .execute();

  const existingUser = await systemDb
    .selectFrom('app_user')
    .select(['id'])
    .where('email', '=', input.adminEmail)
    .executeTakeFirst();

  const adminUserId = existingUser?.id ?? randomUUID();
  if (!existingUser) {
    await systemDb
      .insertInto('app_user')
      .values({ id: adminUserId, name: input.adminName, email: input.adminEmail, is_active: 1 })
      .execute();
  }

  // Per-company password (2026-09-05, amended): lives on company_access, on
  // the same row as the DEK wrap it unlocks — see Phase Tracker Key
  // Decisions Log for why this replaced a single global app_user password.
  const wrapped = wrapDataKey(dek, input.adminPassword);
  await systemDb
    .insertInto('company_access')
    .values({
      id: randomUUID(),
      app_user_id: adminUserId,
      company_id: companyId,
      role_id: adminRoleId,
      password_hash: hashPassword(input.adminPassword),
      must_change_password: 0,
      wrapped_dek: wrapped.wrappedKeyHex,
      wrap_iv: wrapped.ivHex,
      wrap_auth_tag: wrapped.authTagHex,
      wrap_kek_salt: wrapped.kekSaltHex,
    })
    .execute();

  // Company-wide recovery wrap: an independent way to unwrap the DEK if every
  // user's password is ever forgotten. Shown to the caller exactly once —
  // nothing that could reconstruct it is stored anywhere (see keyWrap.ts).
  const recoveryKey = generateRecoveryKey();
  const recoveryWrapped = wrapWithRawKey(dek, recoveryKey);
  await systemDb
    .insertInto('company_recovery_key')
    .values({
      company_id: companyId,
      wrapped_dek: recoveryWrapped.wrappedKeyHex,
      wrap_iv: recoveryWrapped.ivHex,
      wrap_auth_tag: recoveryWrapped.authTagHex,
    })
    .execute();

  return {
    company: {
      id: companyId,
      legalName: input.legalName,
      tradeName: input.tradeName || null,
      entityType: input.entityType,
      isActive: true,
    },
    recoveryKey: formatRecoveryKey(recoveryKey),
  };
}

export async function login(systemDb: Kysely<SystemDatabase>, input: LoginInput): Promise<LoginResult> {
  const company = await systemDb
    .selectFrom('company')
    .selectAll()
    .where('id', '=', input.companyId)
    .where('is_active', '=', IS_ACTIVE)
    .executeTakeFirst();
  if (!company) {
    throw new Error('Company not found');
  }

  const user = await systemDb
    .selectFrom('app_user')
    .selectAll()
    .where('email', '=', input.email)
    .where('is_active', '=', IS_ACTIVE)
    .executeTakeFirst();

  const access = user
    ? await systemDb
        .selectFrom('company_access')
        .selectAll()
        .where('app_user_id', '=', user.id)
        .where('company_id', '=', company.id)
        .where('revoked_at', 'is', null)
        .executeTakeFirst()
    : undefined;

  if (!user || !access || !access.password_hash || !access.wrapped_dek || !access.wrap_iv || !access.wrap_auth_tag || !access.wrap_kek_salt) {
    throw new Error(INVALID_CREDENTIALS);
  }

  const policy = await loadSecurityPolicy(systemDb);
  assertNotLocked(access, policy); // throws LockedOutError with its own message if applicable

  let dek: Buffer;
  const credentialsValid = verifyPassword(input.password, access.password_hash);
  if (credentialsValid) {
    try {
      dek = unwrapDataKey(
        { wrappedKeyHex: access.wrapped_dek, ivHex: access.wrap_iv, authTagHex: access.wrap_auth_tag, kekSaltHex: access.wrap_kek_salt },
        input.password,
      );
    } catch {
      await recordFailedAttempt(systemDb, access.id, access.failed_login_count, policy);
      throw new Error(INVALID_CREDENTIALS);
    }
  } else {
    await recordFailedAttempt(systemDb, access.id, access.failed_login_count, policy);
    throw new Error(INVALID_CREDENTIALS);
  }

  await systemDb.updateTable('company_access').set(clearedLockoutColumns()).where('id', '=', access.id).execute();

  if (access.must_change_password) {
    return { mustChangePassword: true };
  }

  const sessionInfo = await establishSession(company, user.id, user.name, user.email, access.role_id, dek);
  return { mustChangePassword: false, session: sessionInfo };
}

export async function changePassword(systemDb: Kysely<SystemDatabase>, input: ChangePasswordInput): Promise<SessionInfo> {
  const company = await systemDb
    .selectFrom('company')
    .selectAll()
    .where('id', '=', input.companyId)
    .where('is_active', '=', IS_ACTIVE)
    .executeTakeFirst();
  if (!company) {
    throw new Error('Company not found');
  }

  const user = await systemDb
    .selectFrom('app_user')
    .selectAll()
    .where('email', '=', input.email)
    .where('is_active', '=', IS_ACTIVE)
    .executeTakeFirst();
  const access = user
    ? await systemDb
        .selectFrom('company_access')
        .selectAll()
        .where('app_user_id', '=', user.id)
        .where('company_id', '=', company.id)
        .where('revoked_at', 'is', null)
        .executeTakeFirst()
    : undefined;

  if (!user || !access || !access.password_hash || !access.wrapped_dek || !access.wrap_iv || !access.wrap_auth_tag || !access.wrap_kek_salt) {
    throw new Error(INVALID_CREDENTIALS);
  }

  const policy = await loadSecurityPolicy(systemDb);
  assertNotLocked(access, policy);

  let dek: Buffer;
  if (verifyPassword(input.currentPassword, access.password_hash)) {
    try {
      dek = unwrapDataKey(
        { wrappedKeyHex: access.wrapped_dek, ivHex: access.wrap_iv, authTagHex: access.wrap_auth_tag, kekSaltHex: access.wrap_kek_salt },
        input.currentPassword,
      );
    } catch {
      await recordFailedAttempt(systemDb, access.id, access.failed_login_count, policy);
      throw new Error(INVALID_CREDENTIALS);
    }
  } else {
    await recordFailedAttempt(systemDb, access.id, access.failed_login_count, policy);
    throw new Error(INVALID_CREDENTIALS);
  }

  const newWrapped = wrapDataKey(dek, input.newPassword);
  await systemDb
    .updateTable('company_access')
    .set({
      password_hash: hashPassword(input.newPassword),
      wrapped_dek: newWrapped.wrappedKeyHex,
      wrap_iv: newWrapped.ivHex,
      wrap_auth_tag: newWrapped.authTagHex,
      wrap_kek_salt: newWrapped.kekSaltHex,
      must_change_password: 0,
      ...clearedLockoutColumns(),
    })
    .where('id', '=', access.id)
    .execute();

  return establishSession(company, user.id, user.name, user.email, access.role_id, dek);
}

export async function resetPassword(systemDb: Kysely<SystemDatabase>, input: ResetPasswordInput): Promise<SessionInfo> {
  const company = await systemDb
    .selectFrom('company')
    .selectAll()
    .where('id', '=', input.companyId)
    .where('is_active', '=', IS_ACTIVE)
    .executeTakeFirst();
  if (!company) {
    throw new Error('Company not found');
  }

  const recovery = await systemDb
    .selectFrom('company_recovery_key')
    .selectAll()
    .where('company_id', '=', company.id)
    .executeTakeFirst();
  if (!recovery) {
    throw new Error('No recovery key is on file for this company');
  }

  let dek: Buffer;
  try {
    const recoveryKeyBytes = parseRecoveryKey(input.recoveryKey);
    dek = unwrapWithRawKey(
      { wrappedKeyHex: recovery.wrapped_dek, ivHex: recovery.wrap_iv, authTagHex: recovery.wrap_auth_tag },
      recoveryKeyBytes,
    );
  } catch {
    throw new Error('Invalid recovery key');
  }

  const user = await systemDb
    .selectFrom('app_user')
    .selectAll()
    .where('email', '=', input.email)
    .where('is_active', '=', IS_ACTIVE)
    .executeTakeFirst();
  if (!user) {
    throw new Error('No such user for this company');
  }

  const access = await systemDb
    .selectFrom('company_access')
    .selectAll()
    .where('app_user_id', '=', user.id)
    .where('company_id', '=', company.id)
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  if (!access) {
    throw new Error('This user has no access to this company');
  }

  const newWrapped = wrapDataKey(dek, input.newPassword);
  await systemDb
    .updateTable('company_access')
    .set({
      password_hash: hashPassword(input.newPassword),
      wrapped_dek: newWrapped.wrappedKeyHex,
      wrap_iv: newWrapped.ivHex,
      wrap_auth_tag: newWrapped.authTagHex,
      wrap_kek_salt: newWrapped.kekSaltHex,
      must_change_password: 0,
      ...clearedLockoutColumns(),
    })
    .where('id', '=', access.id)
    .execute();

  return establishSession(company, user.id, user.name, user.email, access.role_id, dek);
}

/** Acting user comes from the current session, never from the caller — a permission check against a spoofable identity would be worthless. */
export async function adminResetPassword(
  systemDb: Kysely<SystemDatabase>,
  input: AdminResetPasswordInput,
): Promise<AdminResetPasswordResult> {
  const actingSession = session.get();
  const actingDek = session.getDek();
  if (!actingSession || !actingDek) {
    throw new Error('Not logged in');
  }
  if (!actingSession.permissions.includes('SYSTEM.RESET_USER_PASSWORD')) {
    throw new Error('You do not have permission to reset passwords for this company');
  }
  if (input.targetEmail.toLowerCase() === actingSession.email.toLowerCase()) {
    throw new Error('Use "Change password" or your recovery key to reset your own password');
  }

  const target = await systemDb
    .selectFrom('app_user')
    .selectAll()
    .where('email', '=', input.targetEmail)
    .where('is_active', '=', IS_ACTIVE)
    .executeTakeFirst();
  if (!target) {
    throw new Error('No such user');
  }

  const targetAccess = await systemDb
    .selectFrom('company_access')
    .selectAll()
    .where('app_user_id', '=', target.id)
    .where('company_id', '=', actingSession.companyId)
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  if (!targetAccess) {
    throw new Error('This user has no access to this company');
  }

  const temporaryPassword = generateTemporaryPassword();
  const wrapped = wrapDataKey(actingDek, temporaryPassword);

  await systemDb
    .updateTable('company_access')
    .set({
      password_hash: hashPassword(temporaryPassword),
      wrapped_dek: wrapped.wrappedKeyHex,
      wrap_iv: wrapped.ivHex,
      wrap_auth_tag: wrapped.authTagHex,
      wrap_kek_salt: wrapped.kekSaltHex,
      must_change_password: 1,
      ...clearedLockoutColumns(),
    })
    .where('id', '=', targetAccess.id)
    .execute();

  return { temporaryPassword };
}

/**
 * The gap flagged since Phase 0 session 4: until now, only createCompany's
 * admin bootstrap could ever create a company_access row — ManageUsersScreen
 * could list/reset existing access but not grant new access to a second real
 * person. Same wrapping mechanics as adminResetPassword (the acting user's
 * already-unwrapped session DEK re-wraps under a fresh temp password), so a
 * new user reaches the same forced-password-change first login as an
 * admin-reset one does.
 */
export async function inviteUser(systemDb: Kysely<SystemDatabase>, input: InviteUserInput): Promise<InviteUserResult> {
  const actingSession = session.get();
  const actingDek = session.getDek();
  const companyDb = session.getCompanyDb();
  if (!actingSession || !actingDek || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!actingSession.permissions.includes('SYSTEM.MANAGE_USERS')) {
    throw new Error('You do not have permission to invite users for this company');
  }

  const role = await companyDb.selectFrom('role').select('id').where('id', '=', input.roleId).executeTakeFirst();
  if (!role) {
    throw new Error('Role not found');
  }

  const existingUser = await systemDb.selectFrom('app_user').selectAll().where('email', '=', input.email).executeTakeFirst();
  if (existingUser && !existingUser.is_active) {
    throw new Error('This email belongs to a deactivated user');
  }

  const userId = existingUser?.id ?? randomUUID();
  if (!existingUser) {
    await systemDb.insertInto('app_user').values({ id: userId, name: input.name, email: input.email, is_active: 1 }).execute();
  }

  const existingAccess = await systemDb
    .selectFrom('company_access')
    .select('id')
    .where('app_user_id', '=', userId)
    .where('company_id', '=', actingSession.companyId)
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  if (existingAccess) {
    throw new Error('This user already has access to this company');
  }

  const temporaryPassword = generateTemporaryPassword();
  const wrapped = wrapDataKey(actingDek, temporaryPassword);
  await systemDb
    .insertInto('company_access')
    .values({
      id: randomUUID(),
      app_user_id: userId,
      company_id: actingSession.companyId,
      role_id: input.roleId,
      password_hash: hashPassword(temporaryPassword),
      must_change_password: 1,
      wrapped_dek: wrapped.wrappedKeyHex,
      wrap_iv: wrapped.ivHex,
      wrap_auth_tag: wrapped.authTagHex,
      wrap_kek_salt: wrapped.kekSaltHex,
    })
    .execute();

  return { temporaryPassword };
}

export async function listRoles(): Promise<RoleSummary[]> {
  const actingSession = session.get();
  const companyDb = session.getCompanyDb();
  if (!actingSession || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!actingSession.permissions.includes('SYSTEM.MANAGE_USERS')) {
    throw new Error('You do not have permission to view roles for this company');
  }
  return companyDb.selectFrom('role').select(['id', 'name']).orderBy('name').execute();
}

export async function listCompanyUsers(systemDb: Kysely<SystemDatabase>): Promise<CompanyUserSummary[]> {
  const actingSession = session.get();
  const companyDb = session.getCompanyDb();
  if (!actingSession || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!actingSession.permissions.includes('SYSTEM.MANAGE_USERS')) {
    throw new Error('You do not have permission to view users for this company');
  }

  const accessRows = await systemDb
    .selectFrom('company_access')
    .innerJoin('app_user', 'app_user.id', 'company_access.app_user_id')
    .where('company_access.company_id', '=', actingSession.companyId)
    .where('company_access.revoked_at', 'is', null)
    .select(['app_user.email as email', 'app_user.name as name', 'company_access.role_id as roleId'])
    .execute();

  const roles = await companyDb.selectFrom('role').select(['id', 'name']).execute();
  const roleNameById = new Map(roles.map((role) => [role.id, role.name]));

  return accessRows.map((row) => ({
    email: row.email,
    name: row.name,
    roleName: roleNameById.get(row.roleId) ?? 'Unknown role',
  }));
}
