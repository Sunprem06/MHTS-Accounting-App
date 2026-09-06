import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { ATTENDANCE_STATUSES } from './types';
import type { AttendanceRecordSummary, AttendanceStatus, MarkAttendanceInput } from './types';

function datesInRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function upsertAttendance(db: Kysely<CompanyDatabase> | Transaction<CompanyDatabase>, employeeId: string, date: string, status: AttendanceStatus, leaveApplicationId: string | null): Promise<void> {
  const existing = await db.selectFrom('attendance_record').select('id').where('employee_id', '=', employeeId).where('attendance_date', '=', date).executeTakeFirst();
  if (existing) {
    await db.updateTable('attendance_record').set({ status, leave_application_id: leaveApplicationId }).where('id', '=', existing.id).execute();
  } else {
    await db.insertInto('attendance_record').values({ id: randomUUID(), employee_id: employeeId, attendance_date: date, status, leave_application_id: leaveApplicationId }).execute();
  }
}

/** Bulk-mark a date range for many employees at once — a business marking exceptions (absences, half-days, a company holiday) doesn't want to click through one row per employee per day. ON_LEAVE is excluded from the allowed statuses here: it's set only by leave.ts's approveLeave, never directly, so it always carries a real leave_application_id. */
export async function markAttendance(companyDb: Kysely<CompanyDatabase>, input: MarkAttendanceInput): Promise<void> {
  // The type system already excludes 'ON_LEAVE' from MarkAttendanceInput.status, but this is
  // an IPC boundary — untrusted JSON from the renderer could still smuggle it through at runtime.
  const status: string = input.status;
  if (!ATTENDANCE_STATUSES.includes(input.status) || status === 'ON_LEAVE') {
    throw new Error(`Invalid attendance status for direct marking: ${input.status}`);
  }
  if (input.toDate < input.fromDate) {
    throw new Error('End date cannot be before start date');
  }
  if (input.employeeIds.length === 0) {
    throw new Error('Select at least one employee');
  }

  const dates = datesInRange(input.fromDate, input.toDate);
  await companyDb.transaction().execute(async (trx) => {
    for (const employeeId of input.employeeIds) {
      for (const date of dates) {
        await upsertAttendance(trx, employeeId, date, input.status, null);
      }
    }
  });
}

/** Called from leave.ts's approveLeave, inside its own transaction — marks every day of an approved leave application ON_LEAVE, overwriting any prior manual mark for those dates. */
export async function upsertAttendanceForApprovedLeaveInTransaction(trx: Transaction<CompanyDatabase>, employeeId: string, fromDate: string, toDate: string, leaveApplicationId: string): Promise<void> {
  for (const date of datesInRange(fromDate, toDate)) {
    await upsertAttendance(trx, employeeId, date, 'ON_LEAVE', leaveApplicationId);
  }
}

export async function listAttendanceForEmployee(companyDb: Kysely<CompanyDatabase>, employeeId: string, periodYear: number, periodMonth: number): Promise<AttendanceRecordSummary[]> {
  const monthStr = String(periodMonth).padStart(2, '0');
  const rows = await companyDb
    .selectFrom('attendance_record')
    .select(['employee_id as employeeId', 'attendance_date as attendanceDate', 'status'])
    .where('employee_id', '=', employeeId)
    .where('attendance_date', 'like', `${periodYear}-${monthStr}-%`)
    .orderBy('attendance_date')
    .execute();
  return rows.map((row) => ({ ...row, status: row.status as AttendanceStatus }));
}

export interface AttendanceSummary {
  /** Tenths of a day — see migration 012's doc comment on payslip.paid_days/lop_days. */
  totalDaysInMonthTenths: number;
  lopDaysTenths: number;
  paidDaysTenths: number;
}

/**
 * The default assumption is PRESENT for every calendar day of the month
 * unless explicitly marked otherwise — a business only needs to record
 * exceptions (absences, half-days, holidays), not confirm every ordinary
 * working day. ABSENT costs a full day of LOP, HALF_DAY costs half; ON_LEAVE
 * (only ever set via an approved leave application) and HOLIDAY/WEEKLY_OFF
 * are paid non-working days, not LOP.
 */
export async function computeAttendanceSummary(companyDb: Kysely<CompanyDatabase>, employeeId: string, periodYear: number, periodMonth: number): Promise<AttendanceSummary> {
  const totalDaysInMonth = new Date(Date.UTC(periodYear, periodMonth, 0)).getUTCDate();
  const totalDaysInMonthTenths = totalDaysInMonth * 10;

  const records = await listAttendanceForEmployee(companyDb, employeeId, periodYear, periodMonth);
  let lopDaysTenths = 0;
  for (const record of records) {
    if (record.status === 'ABSENT') lopDaysTenths += 10;
    else if (record.status === 'HALF_DAY') lopDaysTenths += 5;
  }

  return { totalDaysInMonthTenths, lopDaysTenths, paidDaysTenths: totalDaysInMonthTenths - lopDaysTenths };
}
