import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export const PRINT_PERMISSIONS = [
  { code: 'PRINT.MANAGE_LETTERHEAD', description: 'Edit the company letterhead profile (address, logo, bank details, layout)' },
  { code: 'PRINT.PRINT_DOCUMENTS', description: 'Print or export documents (invoices, payslips) to PDF' },
] as const;

/** Not yet granted retroactively to pre-existing companies (same gap every prior module's additions have had — see e.g. core-manufacturing/permissions.ts). */
export async function grantPrintPermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of PRINT_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb.insertInto('permission').values({ id: permissionId, code: permission.code, description: permission.description }).execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}
