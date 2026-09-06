import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export const EXPENSE_PERMISSIONS = [
  { code: 'EXPENSE.MANAGE_EMPLOYEES', description: 'Create and edit employees' },
  { code: 'EXPENSE.CREATE_CLAIM', description: 'Create and submit expense claims' },
  { code: 'EXPENSE.APPROVE_CLAIM', description: 'Approve, reject or cancel a submitted expense claim' },
  { code: 'EXPENSE.REIMBURSE_CLAIM', description: 'Record a reimbursement against an approved expense claim' },
  { code: 'EXPENSE.VIEW_REPORTS', description: 'View expense claim registers and outstanding reimbursements' },
] as const;

/** Same pattern as every other module's grant*Permissions — each module owns and grants its own permission codes. */
export async function grantExpensePermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of EXPENSE_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb
      .insertInto('permission')
      .values({ id: permissionId, code: permission.code, description: permission.description })
      .execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}
