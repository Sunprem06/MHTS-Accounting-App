import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export const GST_PERMISSIONS = [
  { code: 'GST.MANAGE_RATES', description: 'Add and update GST rates by HSN/SAC code' },
  { code: 'GST.VIEW_REPORTS', description: 'View the GST summary report' },
] as const;

/** Same pattern as every other module's grant*Permissions — each module owns and grants its own permission codes. */
export async function grantGstPermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of GST_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb
      .insertInto('permission')
      .values({ id: permissionId, code: permission.code, description: permission.description })
      .execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}
