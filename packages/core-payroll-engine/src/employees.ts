import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { EMPLOYMENT_TYPES } from './types';
import type { EmployeePayrollProfileInput, EmployeePayrollProfileSummary, EmploymentType } from './types';

const IS_ACTIVE = 1 as unknown as boolean; // better-sqlite3 only binds numbers/strings/bigints/buffers/null, not JS booleans.

export async function listEmployeePayrollProfiles(companyDb: Kysely<CompanyDatabase>): Promise<EmployeePayrollProfileSummary[]> {
  const rows = await companyDb
    .selectFrom('employee')
    .select([
      'id',
      'employee_code as employeeCode',
      'name',
      'is_active as isActive',
      'date_of_birth as dateOfBirth',
      'date_of_joining as dateOfJoining',
      'date_of_leaving as dateOfLeaving',
      'employment_type as employmentType',
      'pan',
      'bank_account_number as bankAccountNumber',
      'bank_ifsc as bankIfsc',
      'uan',
      'esi_number as esiNumber',
      'pf_voluntary_opt_out as pfVoluntaryOptOut',
      'salary_payable_ledger_id as salaryPayableLedgerId',
    ])
    .orderBy('name')
    .execute();

  return rows.map((row) => ({
    ...row,
    isActive: Boolean(row.isActive),
    employmentType: row.employmentType as EmploymentType | null,
    pfVoluntaryOptOut: Boolean(row.pfVoluntaryOptOut),
  }));
}

export async function updateEmployeePayrollProfile(
  companyDb: Kysely<CompanyDatabase>,
  employeeId: string,
  input: EmployeePayrollProfileInput,
  actorUserId: string | null,
): Promise<void> {
  const employee = await companyDb.selectFrom('employee').selectAll().where('id', '=', employeeId).executeTakeFirst();
  if (!employee) {
    throw new Error('Employee not found');
  }
  if (input.employmentType && !EMPLOYMENT_TYPES.includes(input.employmentType)) {
    throw new Error(`Unknown employment type: ${input.employmentType}`);
  }
  if (input.dateOfLeaving && input.dateOfJoining && input.dateOfLeaving < input.dateOfJoining) {
    throw new Error('Date of leaving cannot be before date of joining');
  }

  await companyDb.transaction().execute(async (trx) => {
    await trx
      .updateTable('employee')
      .set({
        date_of_birth: input.dateOfBirth ?? employee.date_of_birth,
        date_of_joining: input.dateOfJoining ?? employee.date_of_joining,
        date_of_leaving: input.dateOfLeaving !== undefined ? input.dateOfLeaving : employee.date_of_leaving,
        employment_type: input.employmentType ?? employee.employment_type,
        pan: input.pan ?? employee.pan,
        bank_account_number: input.bankAccountNumber ?? employee.bank_account_number,
        bank_ifsc: input.bankIfsc ?? employee.bank_ifsc,
        uan: input.uan ?? employee.uan,
        esi_number: input.esiNumber ?? employee.esi_number,
        pf_voluntary_opt_out: input.pfVoluntaryOptOut !== undefined ? ((input.pfVoluntaryOptOut ? 1 : 0) as unknown as boolean) : employee.pf_voluntary_opt_out,
      })
      .where('id', '=', employeeId)
      .execute();

    await writeAuditLog(trx, { actorUserId, action: 'UPDATE', entityType: 'EmployeePayrollProfile', entityId: employeeId, beforeData: employee, afterData: input });
  });
}

/** Active headcount as of now — the input applicability.ts compares against the PF/ESI/Gratuity thresholds. Kept here (not in applicability.ts) since it's a plain employee-table query, not rule resolution. */
export async function countActiveEmployees(companyDb: Kysely<CompanyDatabase>): Promise<number> {
  const row = await companyDb.selectFrom('employee').select(({ fn }) => fn.countAll<number>().as('count')).where('is_active', '=', IS_ACTIVE).executeTakeFirstOrThrow();
  return Number(row.count);
}
