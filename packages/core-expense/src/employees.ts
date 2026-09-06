import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { computeLedgerBalances } from '@mhts/core-accounting';
import { EMPLOYEE_REIMBURSEMENTS_GROUP } from './seedLedgers';
import type { CreateEmployeeInput, EmployeeSummary } from './types';

/** Creates an employee and their own dedicated reimbursement ledger atomically — same pattern as core-sales-purchase's createParty. The employee can't exist without a ledger to accrue reimbursements against, and vice versa. */
export async function createEmployee(companyDb: Kysely<CompanyDatabase>, input: CreateEmployeeInput, actorUserId: string | null): Promise<string> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Employee name is required');
  }
  if (!input.employeeCode.trim()) {
    throw new Error('Employee code is required');
  }

  const group = await companyDb.selectFrom('account_group').select('id').where('name', '=', EMPLOYEE_REIMBURSEMENTS_GROUP).executeTakeFirstOrThrow();

  const employeeId = randomUUID();
  const ledgerId = randomUUID();

  await companyDb.transaction().execute(async (trx) => {
    await trx
      .insertInto('ledger_account')
      .values({
        id: ledgerId,
        name,
        group_id: group.id,
        opening_balance: 0,
        opening_balance_side: 'CREDIT',
        is_system_ledger: 0,
      })
      .execute();

    await trx
      .insertInto('employee')
      .values({
        id: employeeId,
        employee_code: input.employeeCode.trim(),
        name,
        department: input.department?.trim() || null,
        ledger_account_id: ledgerId,
        is_active: 1,
      })
      .execute();

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'Employee',
      entityId: employeeId,
      afterData: { employeeCode: input.employeeCode.trim(), name, department: input.department ?? null },
    });
  });

  return employeeId;
}

export async function listEmployees(companyDb: Kysely<CompanyDatabase>): Promise<EmployeeSummary[]> {
  const rows = await companyDb
    .selectFrom('employee')
    .innerJoin('ledger_account', 'ledger_account.id', 'employee.ledger_account_id')
    .select([
      'employee.id as id',
      'employee.employee_code as employeeCode',
      'employee.name as name',
      'employee.department as department',
      'employee.ledger_account_id as ledgerAccountId',
      'employee.is_active as isActive',
    ])
    .orderBy('employee.name')
    .execute();

  if (rows.length === 0) {
    return [];
  }

  const balances = await computeLedgerBalances(companyDb, { natures: ['LIABILITY'] });
  const balanceByLedger = new Map(balances.map((row) => [row.ledgerId, row.netSigned]));

  return rows.map((row) => ({
    id: row.id,
    employeeCode: row.employeeCode,
    name: row.name,
    department: row.department,
    ledgerAccountId: row.ledgerAccountId,
    isActive: Boolean(row.isActive),
    // computeLedgerBalances is debit-positive; a liability ledger accrues credits (amounts owed), so the outstanding balance is the negation.
    outstandingBalance: -(balanceByLedger.get(row.ledgerAccountId) ?? 0),
  }));
}
