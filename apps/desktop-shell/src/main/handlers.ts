import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import {
  hashPassword,
  verifyPassword,
  generateDataKey,
  wrapDataKey,
  unwrapDataKey,
  seedAdminRole,
  resolvePermissions,
} from '@mhts/core-identity';
import type { AppPaths } from './db';
import { companyDbFilePath, createAndMigrateCompanyDb, openExistingCompanyDb } from './db';
import { session } from './session';
import type { CompanySummary, CreateCompanyInput, LoginInput, SessionInfo } from '../shared/ipc';

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
): Promise<CompanySummary> {
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

  return { id: companyId, legalName: input.legalName, tradeName: input.tradeName || null, entityType: input.entityType, isActive: true };
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

  const companyDb = openExistingCompanyDb(company.db_file_path, dek);
  const role = await companyDb.selectFrom('role').selectAll().where('id', '=', access.role_id).executeTakeFirst();
  if (!role) {
    await companyDb.destroy();
    throw new Error('Assigned role no longer exists');
  }
  const permissions = await resolvePermissions(companyDb, access.role_id);

  const info: SessionInfo = {
    userId: user.id,
    userName: user.name,
    email: user.email,
    companyId: company.id,
    companyName: company.trade_name || company.legal_name,
    roleId: role.id,
    roleName: role.name,
    permissions,
  };
  session.set(info, companyDb);
  return info;
}
