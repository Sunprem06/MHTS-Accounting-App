import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export const MULTI_CURRENCY_PERMISSIONS = [
  { code: 'MULTI_CURRENCY.MANAGE_EXCHANGE_RATES', description: 'Add and edit foreign exchange rates' },
  { code: 'MULTI_CURRENCY.RUN_REVALUATION', description: 'Run and post period-end foreign currency revaluation' },
] as const;

/** Same grant-at-company-creation pattern every module follows — see @mhts/core-accounting's grantAccountingPermissions. */
export async function grantMultiCurrencyPermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of MULTI_CURRENCY_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb.insertInto('permission').values({ id: permissionId, code: permission.code, description: permission.description }).execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}
