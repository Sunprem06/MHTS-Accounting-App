import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export const FIXED_ASSETS_PERMISSIONS = [
  { code: 'FIXED_ASSETS.MANAGE_ASSET_CLASSES', description: 'Create and edit fixed asset classes' },
  { code: 'FIXED_ASSETS.MANAGE_ASSETS', description: 'Acquire and dispose of fixed assets' },
  { code: 'FIXED_ASSETS.RUN_DEPRECIATION', description: 'Run and post periodic depreciation' },
] as const;

/** Same grant-at-company-creation pattern every module follows — see @mhts/core-accounting's grantAccountingPermissions. */
export async function grantFixedAssetsPermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of FIXED_ASSETS_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb.insertInto('permission').values({ id: permissionId, code: permission.code, description: permission.description }).execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}
