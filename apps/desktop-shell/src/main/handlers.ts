import { randomUUID } from 'node:crypto';
import type { Kysely, Selectable } from 'kysely';
import type { CompanyTable, SystemDatabase } from '@mhts/db-schema';
import {
  hashPassword,
  verifyPassword,
  generateDataKey,
  generateRecoveryKey,
  wrapDataKey,
  unwrapDataKey,
  wrapWithRawKey,
  unwrapWithRawKey,
  formatRecoveryKey,
  parseRecoveryKey,
  seedAdminRole,
  resolvePermissions,
} from '@mhts/core-identity';
import type { AppPaths } from './db';
import { companyDbFilePath, createAndMigrateCompanyDb, openExistingCompanyDb } from './db';
import { session } from './session';
import type {
  CompanySummary,
  CreateCompanyInput,
  CreateCompanyResult,
  LoginInput,
  ResetPasswordInput,
  SessionInfo,
} from '../shared/ipc';

/** Both a normal login and a post-recovery login end up here: open the (already-unwrapped) Company DB, resolve the role/permissions, and start the session. */
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
  session.set(info, companyDb);
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

export async function createCompany(
  systemDb: Kysely<SystemDatabase>,
  paths: AppPaths,
  input: CreateCompanyInput,
): Promise<CreateCompanyResult> {
  const companyId = randomUUID();
  const filePath = companyDbFilePath(paths, companyId);
  const dek = generateDataKey();

  const companyDb = await createAndMigrateCompanyDb(filePath, dek);
  const adminRoleId = await seedAdminRole(companyDb);
  await companyDb.destroy();

  await systemDb
    .insertInto('company')
    .values({
      id: companyId,
      legal_name: input.legalName,
      trade_name: input.tradeName || null,
      entity_type: input.entityType,
      state_code: input.stateCode || null,
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
      .values({
        id: adminUserId,
        name: input.adminName,
        email: input.adminEmail,
        password_hash: hashPassword(input.adminPassword),
        is_active: 1,
      })
      .execute();
  }

  const wrapped = wrapDataKey(dek, input.adminPassword);
  await systemDb
    .insertInto('company_access')
    .values({
      id: randomUUID(),
      app_user_id: adminUserId,
      company_id: companyId,
      role_id: adminRoleId,
      wrapped_dek: wrapped.wrappedKeyHex,
      wrap_iv: wrapped.ivHex,
      wrap_auth_tag: wrapped.authTagHex,
      wrap_kek_salt: wrapped.kekSaltHex,
    })
    .execute();

  // Company-wide recovery wrap: an independent way to unwrap the DEK if the
  // admin's password is ever forgotten. Shown to the caller exactly once —
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

export async function login(systemDb: Kysely<SystemDatabase>, input: LoginInput): Promise<SessionInfo> {
  const company = await systemDb
    .selectFrom('company')
    .selectAll()
    .where('id', '=', input.companyId)
    // better-sqlite3 only binds numbers/strings/bigints/buffers/null, not JS booleans.
    .where('is_active', '=', 1 as unknown as boolean)
    .executeTakeFirst();
  if (!company) {
    throw new Error('Company not found');
  }

  const user = await systemDb
    .selectFrom('app_user')
    .selectAll()
    .where('email', '=', input.email)
    .where('is_active', '=', 1 as unknown as boolean)
    .executeTakeFirst();
  if (!user || !verifyPassword(input.password, user.password_hash)) {
    throw new Error('Invalid email or password');
  }

  const access = await systemDb
    .selectFrom('company_access')
    .selectAll()
    .where('app_user_id', '=', user.id)
    .where('company_id', '=', company.id)
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  if (!access || !access.wrapped_dek || !access.wrap_iv || !access.wrap_auth_tag || !access.wrap_kek_salt) {
    throw new Error('This user has no access to this company');
  }

  let dek: Buffer;
  try {
    dek = unwrapDataKey(
      {
        wrappedKeyHex: access.wrapped_dek,
        ivHex: access.wrap_iv,
        authTagHex: access.wrap_auth_tag,
        kekSaltHex: access.wrap_kek_salt,
      },
      input.password,
    );
  } catch {
    throw new Error('Invalid email or password');
  }

  return establishSession(company, user.id, user.name, user.email, access.role_id, dek);
}

export async function resetPassword(systemDb: Kysely<SystemDatabase>, input: ResetPasswordInput): Promise<SessionInfo> {
  const company = await systemDb
    .selectFrom('company')
    .selectAll()
    .where('id', '=', input.companyId)
    .where('is_active', '=', 1 as unknown as boolean)
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
    .where('is_active', '=', 1 as unknown as boolean)
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

  const newPasswordHash = hashPassword(input.newPassword);
  const newWrapped = wrapDataKey(dek, input.newPassword);

  // Rule #4-in-spirit: the password hash and the DEK wrap it depends on must
  // change together, or a login could observe a mismatched pair.
  await systemDb.transaction().execute(async (trx) => {
    await trx.updateTable('app_user').set({ password_hash: newPasswordHash }).where('id', '=', user.id).execute();
    await trx
      .updateTable('company_access')
      .set({
        wrapped_dek: newWrapped.wrappedKeyHex,
        wrap_iv: newWrapped.ivHex,
        wrap_auth_tag: newWrapped.authTagHex,
        wrap_kek_salt: newWrapped.kekSaltHex,
      })
      .where('id', '=', access.id)
      .execute();
  });

  return establishSession(company, user.id, user.name, user.email, access.role_id, dek);
}
