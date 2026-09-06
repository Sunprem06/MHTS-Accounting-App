import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export const BANKING_PERMISSIONS = [
  { code: 'BANKING.MANAGE_BANK_ACCOUNTS', description: 'Create and edit bank accounts' },
  { code: 'BANKING.RECORD_PAYMENT_INSTRUMENT', description: 'Attach and update cheque/UTR details on a payment, receipt or contra voucher' },
  { code: 'BANKING.RECONCILE', description: 'Mark bank ledger entries as reconciled against a bank statement' },
  { code: 'BANKING.IMPORT_STATEMENT', description: 'Import a bank statement file and resolve its matches' },
  { code: 'BANKING.VIEW_REPORTS', description: 'View bank accounts, cheque register and reconciliation reports' },
] as const;

/** Same pattern as every other module's grant*Permissions — each module owns and grants its own permission codes. */
export async function grantBankingPermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of BANKING_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb
      .insertInto('permission')
      .values({ id: permissionId, code: permission.code, description: permission.description })
      .execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}
