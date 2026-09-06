import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

/**
 * A distinct permission set from @mhts/core-expense's EXPENSE.* — salary/CTC
 * data is materially more sensitive than the name/department Phase 6
 * exposed, so a role with expense-claim access doesn't automatically see it.
 */
export const PAYROLL_PERMISSIONS = [
  { code: 'PAYROLL.MANAGE_EMPLOYEE_PROFILE', description: 'View and edit employee payroll profiles (statutory numbers, bank details, employment type)' },
  { code: 'PAYROLL.MANAGE_SALARY_STRUCTURE', description: 'Define salary components and assign CTC/salary structures' },
  { code: 'PAYROLL.MANAGE_RULES', description: 'Edit PF/ESI/PT/TDS/gratuity statutory rules and company payroll settings' },
  { code: 'PAYROLL.MANAGE_ATTENDANCE', description: 'Mark attendance and manage leave types' },
  { code: 'PAYROLL.APPLY_LEAVE', description: 'Apply for leave' },
  { code: 'PAYROLL.APPROVE_LEAVE', description: 'Approve or reject leave applications' },
  { code: 'PAYROLL.RUN_PAYROLL', description: 'Create, process and post payroll runs' },
  { code: 'PAYROLL.DISBURSE_SALARY', description: 'Record salary disbursement against a payslip' },
  { code: 'PAYROLL.MANAGE_GRATUITY', description: 'Run gratuity provisioning and record/settle separations' },
  { code: 'PAYROLL.VIEW_REPORTS', description: 'View payroll runs, payslips and gratuity records' },
] as const;

/** Same pattern as every other module's grant*Permissions — each module owns and grants its own permission codes. */
export async function grantPayrollPermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of PAYROLL_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb
      .insertInto('permission')
      .values({ id: permissionId, code: permission.code, description: permission.description })
      .execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}
