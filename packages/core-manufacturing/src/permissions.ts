import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export const MANUFACTURING_PERMISSIONS = [
  { code: 'MANUFACTURING.MANAGE_BOM', description: 'Create and version bills of material' },
  { code: 'MANUFACTURING.POST_JOURNAL', description: 'Post manufacturing consume/produce journal entries' },
] as const;

/** Same grant-at-company-creation pattern every module follows — see @mhts/core-accounting's grantAccountingPermissions. Not yet granted retroactively to pre-existing companies (same gap every prior module's additions have had). */
export async function grantManufacturingPermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of MANUFACTURING_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb.insertInto('permission').values({ id: permissionId, code: permission.code, description: permission.description }).execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}
