import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

/** Generic — not gated per-consuming-module, since documents cut across every module (Voucher, BusinessParty, Employee, ExpenseClaim, BankAccount, ...). */
export const DOCUMENTS_PERMISSIONS = [
  { code: 'DOCUMENTS.UPLOAD', description: 'Attach a document to any record' },
  { code: 'DOCUMENTS.VIEW', description: 'View and download attached documents, and search across them' },
  { code: 'DOCUMENTS.DELETE', description: 'Delete an attached document' },
] as const;

/** Same pattern as every other module's grant*Permissions — each module owns and grants its own permission codes. */
export async function grantDocumentsPermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of DOCUMENTS_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb
      .insertInto('permission')
      .values({ id: permissionId, code: permission.code, description: permission.description })
      .execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}
