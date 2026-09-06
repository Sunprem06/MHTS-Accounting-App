import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { upsertAttendanceForApprovedLeaveInTransaction } from './attendance';
import type { ApplyLeaveInput, LeaveApplicationStatus, LeaveApplicationSummary, LeaveBalanceSummary, LeaveTypeInput, LeaveTypeSummary } from './types';

function wholeDaysInclusive(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00Z`).getTime();
  const to = new Date(`${toDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
}

export async function createLeaveType(companyDb: Kysely<CompanyDatabase>, input: LeaveTypeInput): Promise<string> {
  if (!input.name.trim()) {
    throw new Error('Leave type name is required');
  }
  if (!Number.isInteger(input.annualEntitlementDays) || input.annualEntitlementDays < 0) {
    throw new Error('Annual entitlement must be a non-negative whole number of days');
  }
  const id = randomUUID();
  await companyDb
    .insertInto('leave_type')
    .values({ id, name: input.name.trim(), is_paid: (input.isPaid ? 1 : 0) as unknown as boolean, annual_entitlement_days: input.annualEntitlementDays, is_active: 1 as unknown as boolean })
    .execute();
  return id;
}

export async function listLeaveTypes(companyDb: Kysely<CompanyDatabase>): Promise<LeaveTypeSummary[]> {
  const rows = await companyDb.selectFrom('leave_type').selectAll().orderBy('name').execute();
  return rows.map((row) => ({ id: row.id, name: row.name, isPaid: Boolean(row.is_paid), annualEntitlementDays: row.annual_entitlement_days, isActive: Boolean(row.is_active) }));
}

/** Full annual entitlement granted upfront as the FY's opening balance (not accrued month-by-month) — a deliberate simplification; a mid-year joiner's pro-rated entitlement isn't modeled. */
async function ensureLeaveBalance(trx: Transaction<CompanyDatabase>, employeeId: string, leaveTypeId: string, financialYear: string): Promise<{ id: string; openingBalanceDays: number; accruedDays: number; availedDays: number }> {
  const existing = await trx
    .selectFrom('leave_balance')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .where('leave_type_id', '=', leaveTypeId)
    .where('financial_year', '=', financialYear)
    .executeTakeFirst();
  if (existing) {
    return { id: existing.id, openingBalanceDays: existing.opening_balance_days, accruedDays: existing.accrued_days, availedDays: existing.availed_days };
  }

  const leaveType = await trx.selectFrom('leave_type').select('annual_entitlement_days').where('id', '=', leaveTypeId).executeTakeFirstOrThrow();
  const id = randomUUID();
  await trx
    .insertInto('leave_balance')
    .values({ id, employee_id: employeeId, leave_type_id: leaveTypeId, financial_year: financialYear, opening_balance_days: leaveType.annual_entitlement_days, accrued_days: 0, availed_days: 0 })
    .execute();
  return { id, openingBalanceDays: leaveType.annual_entitlement_days, accruedDays: 0, availedDays: 0 };
}

export async function listLeaveBalances(companyDb: Kysely<CompanyDatabase>, employeeId: string, financialYear: string): Promise<LeaveBalanceSummary[]> {
  const leaveTypes = await listLeaveTypes(companyDb);
  const balances = await companyDb
    .selectFrom('leave_balance')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .where('financial_year', '=', financialYear)
    .execute();
  const balanceByType = new Map(balances.map((b) => [b.leave_type_id, b]));

  return leaveTypes
    .filter((lt) => lt.isActive)
    .map((leaveType) => {
      const balance = balanceByType.get(leaveType.id);
      const openingBalanceDays = balance?.opening_balance_days ?? leaveType.annualEntitlementDays;
      const accruedDays = balance?.accrued_days ?? 0;
      const availedDays = balance?.availed_days ?? 0;
      return { employeeId, leaveTypeId: leaveType.id, leaveTypeName: leaveType.name, financialYear, openingBalanceDays, accruedDays, availedDays, balanceDays: openingBalanceDays + accruedDays - availedDays };
    });
}

export async function applyLeave(companyDb: Kysely<CompanyDatabase>, input: ApplyLeaveInput, actorUserId: string | null): Promise<string> {
  if (input.toDate < input.fromDate) {
    throw new Error('Leave end date cannot be before the start date');
  }
  const employee = await companyDb.selectFrom('employee').select('id').where('id', '=', input.employeeId).executeTakeFirst();
  if (!employee) {
    throw new Error('Employee not found');
  }
  const leaveType = await companyDb.selectFrom('leave_type').select('id').where('id', '=', input.leaveTypeId).executeTakeFirst();
  if (!leaveType) {
    throw new Error('Leave type not found');
  }

  const days = wholeDaysInclusive(input.fromDate, input.toDate);
  const id = randomUUID();
  await companyDb.transaction().execute(async (trx) => {
    await trx
      .insertInto('leave_application')
      .values({
        id,
        employee_id: input.employeeId,
        leave_type_id: input.leaveTypeId,
        from_date: input.fromDate,
        to_date: input.toDate,
        days,
        status: 'PENDING' satisfies LeaveApplicationStatus,
        reason: input.reason ?? null,
        approved_by: null,
      })
      .execute();
    await writeAuditLog(trx, { actorUserId, action: 'CREATE', entityType: 'LeaveApplication', entityId: id, afterData: { employeeId: input.employeeId, fromDate: input.fromDate, toDate: input.toDate, days } });
  });
  return id;
}

export async function listLeaveApplications(companyDb: Kysely<CompanyDatabase>, employeeId?: string): Promise<LeaveApplicationSummary[]> {
  let query = companyDb
    .selectFrom('leave_application')
    .innerJoin('employee', 'employee.id', 'leave_application.employee_id')
    .innerJoin('leave_type', 'leave_type.id', 'leave_application.leave_type_id')
    .select([
      'leave_application.id as id',
      'leave_application.employee_id as employeeId',
      'employee.name as employeeName',
      'leave_application.leave_type_id as leaveTypeId',
      'leave_type.name as leaveTypeName',
      'leave_application.from_date as fromDate',
      'leave_application.to_date as toDate',
      'leave_application.days as days',
      'leave_application.status as status',
      'leave_application.reason as reason',
    ])
    .orderBy('leave_application.from_date', 'desc');
  if (employeeId) {
    query = query.where('leave_application.employee_id', '=', employeeId);
  }
  const rows = await query.execute();
  return rows.map((row) => ({ ...row, status: row.status as LeaveApplicationStatus }));
}

/** Approving debits the leave balance (throws if it would go negative — an approver who wants to grant leave beyond balance should reject and let it fall through to attendance as unpaid LOP instead) and marks each covered date ON_LEAVE on attendance_record, atomically. */
export async function approveLeave(companyDb: Kysely<CompanyDatabase>, leaveApplicationId: string, financialYear: string, actorUserId: string | null): Promise<void> {
  const application = await companyDb.selectFrom('leave_application').selectAll().where('id', '=', leaveApplicationId).executeTakeFirst();
  if (!application) {
    throw new Error('Leave application not found');
  }
  if (application.status !== 'PENDING') {
    throw new Error(`Cannot approve a ${application.status} leave application`);
  }

  await companyDb.transaction().execute(async (trx) => {
    const balance = await ensureLeaveBalance(trx, application.employee_id, application.leave_type_id, financialYear);
    const remaining = balance.openingBalanceDays + balance.accruedDays - balance.availedDays;
    if (application.days > remaining) {
      throw new Error(`This leave application (${application.days} day(s)) exceeds the employee's remaining balance (${remaining} day(s))`);
    }

    await trx.updateTable('leave_balance').set({ availed_days: balance.availedDays + application.days }).where('id', '=', balance.id).execute();
    await trx.updateTable('leave_application').set({ status: 'APPROVED' satisfies LeaveApplicationStatus, approved_by: actorUserId }).where('id', '=', leaveApplicationId).execute();
    await upsertAttendanceForApprovedLeaveInTransaction(trx, application.employee_id, application.from_date, application.to_date, leaveApplicationId);

    await writeAuditLog(trx, {
      actorUserId,
      action: 'UPDATE',
      entityType: 'LeaveApplication',
      entityId: leaveApplicationId,
      beforeData: { status: 'PENDING' },
      afterData: { status: 'APPROVED' },
    });
  });
}

export async function rejectLeave(companyDb: Kysely<CompanyDatabase>, leaveApplicationId: string, reason: string, actorUserId: string | null): Promise<void> {
  const application = await companyDb.selectFrom('leave_application').selectAll().where('id', '=', leaveApplicationId).executeTakeFirst();
  if (!application) {
    throw new Error('Leave application not found');
  }
  if (application.status !== 'PENDING') {
    throw new Error(`Cannot reject a ${application.status} leave application`);
  }

  await companyDb.transaction().execute(async (trx) => {
    await trx.updateTable('leave_application').set({ status: 'REJECTED' satisfies LeaveApplicationStatus, reason: `${application.reason ?? ''} [Rejected: ${reason}]`.trim() }).where('id', '=', leaveApplicationId).execute();
    await writeAuditLog(trx, { actorUserId, action: 'UPDATE', entityType: 'LeaveApplication', entityId: leaveApplicationId, beforeData: { status: 'PENDING' }, afterData: { status: 'REJECTED', reason } });
  });
}
