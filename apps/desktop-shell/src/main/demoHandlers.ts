import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { hashPassword, generateDataKey, generateRecoveryKey, generateTemporaryPassword, wrapDataKey, wrapWithRawKey } from '@mhts/core-identity';
import type { AppPaths } from './db';
import { companyDbFilePath, createAndMigrateCompanyDb } from './db';
import { seedNewCompanyData, establishSession } from './handlers';
import { seedDemoData } from './demoDataSeed';
import { session } from './session';
import type { SessionInfo } from '../shared/ipc';

const IS_DEMO = 1 as unknown as boolean; // better-sqlite3 only binds numbers/strings/bigints/buffers/null, not JS booleans.

const DEMO_LEGAL_NAME = 'Demo Company (Retail & Services) Pvt Ltd';
const DEMO_TRADE_NAME = 'Demo Company';

/**
 * At most one demo company ever exists — a narrowly-scoped helper for demo
 * replacement only, NOT a general "delete any company" feature (real company
 * deletion has backup/audit implications this doesn't need to solve).
 */
async function deleteExistingDemoCompany(systemDb: Kysely<SystemDatabase>): Promise<void> {
  const existing = await systemDb.selectFrom('company').select(['id', 'db_file_path']).where('is_demo', '=', IS_DEMO).executeTakeFirst();
  if (!existing) {
    return;
  }
  if (session.get()?.companyId === existing.id) {
    await session.clear();
  }
  await systemDb.deleteFrom('company_access').where('company_id', '=', existing.id).execute();
  await systemDb.deleteFrom('company_recovery_key').where('company_id', '=', existing.id).execute();
  await systemDb.deleteFrom('company').where('id', '=', existing.id).execute();
  if (existsSync(existing.db_file_path)) {
    unlinkSync(existing.db_file_path);
  }
}

/**
 * One-click, zero-typing "Try Demo": always replaces any existing demo
 * company with a fresh one, seeds it with realistic sample data, and logs
 * straight in — no password is ever shown or needed, since `establishSession`
 * takes the raw DEK directly (the same one `createAndMigrateCompanyDb` just
 * used), skipping password verification entirely. Exempt from the license/
 * trial gate by construction — this function is never called from behind
 * that check (see `createCompany`'s own separate gate in `handlers.ts`).
 */
export async function createDemoCompanyAndLogin(systemDb: Kysely<SystemDatabase>, paths: AppPaths): Promise<SessionInfo> {
  await deleteExistingDemoCompany(systemDb);

  const companyId = randomUUID();
  const filePath = companyDbFilePath(paths, companyId);
  const dek = generateDataKey();

  const companyDb = await createAndMigrateCompanyDb(filePath, dek);
  const adminRoleId = await seedNewCompanyData(companyDb);
  await companyDb.destroy();

  await systemDb
    .insertInto('company')
    .values({
      id: companyId,
      legal_name: DEMO_LEGAL_NAME,
      trade_name: DEMO_TRADE_NAME,
      entity_type: 'PRIVATE_LTD',
      state_code: '27',
      gst_registration_type: 'REGULAR',
      financial_year_start_month: 4,
      base_currency: 'INR',
      db_file_path: filePath,
      is_active: 1,
      is_demo: 1,
    })
    .execute();

  const adminUserId = randomUUID();
  const adminEmail = `demo-${companyId}@mhts.local`; // app_user.email is globally unique — a fresh one every time, never shown to anyone.
  await systemDb.insertInto('app_user').values({ id: adminUserId, name: 'Demo Admin', email: adminEmail, is_active: 1 }).execute();

  // A throwaway password satisfies the schema's non-null columns but is never
  // shown or needed — establishSession below bypasses password verification
  // entirely using the DEK this function already generated above.
  const throwawayPassword = generateTemporaryPassword();
  const wrapped = wrapDataKey(dek, throwawayPassword);
  await systemDb
    .insertInto('company_access')
    .values({
      id: randomUUID(),
      app_user_id: adminUserId,
      company_id: companyId,
      role_id: adminRoleId,
      password_hash: hashPassword(throwawayPassword),
      must_change_password: 0,
      wrapped_dek: wrapped.wrappedKeyHex,
      wrap_iv: wrapped.ivHex,
      wrap_auth_tag: wrapped.authTagHex,
      wrap_kek_salt: wrapped.kekSaltHex,
    })
    .execute();

  // Kept structurally consistent with a real company (so backup/restore etc.
  // behave normally if anyone pokes around) even though the recovery key
  // itself is discarded immediately — meaningless for a throwaway demo the
  // user never chose to protect.
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

  const company = await systemDb.selectFrom('company').selectAll().where('id', '=', companyId).executeTakeFirstOrThrow();
  const sessionInfo = await establishSession(company, adminUserId, 'Demo Admin', adminEmail, adminRoleId, dek);

  await seedDemoData(systemDb);

  return sessionInfo;
}
