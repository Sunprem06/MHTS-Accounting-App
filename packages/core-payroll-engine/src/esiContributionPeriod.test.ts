import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { seedChartOfAccounts, listAccountGroups, createLedgerAccount } from '@mhts/core-accounting';
import { contributionPeriodBounds, wasEsiApplicableEarlierInContributionPeriod } from './esiContributionPeriod';

describe('core-payroll-engine: contributionPeriodBounds (pure)', () => {
  it('April through September fall in the same Apr-Sep period', () => {
    for (const month of [4, 5, 6, 7, 8, 9]) {
      expect(contributionPeriodBounds(2026, month)).toEqual({ startYear: 2026, startMonth: 4, endYear: 2026, endMonth: 9 });
    }
  });

  it('October through December fall in an Oct-Mar period ending the FOLLOWING calendar year', () => {
    for (const month of [10, 11, 12]) {
      expect(contributionPeriodBounds(2026, month)).toEqual({ startYear: 2026, startMonth: 10, endYear: 2027, endMonth: 3 });
    }
  });

  it('January through March fall in the Oct-Mar period that STARTED the PRIOR calendar year', () => {
    for (const month of [1, 2, 3]) {
      expect(contributionPeriodBounds(2026, month)).toEqual({ startYear: 2025, startMonth: 10, endYear: 2026, endMonth: 3 });
    }
  });
});

async function insertEmployee(companyDb: Kysely<CompanyDatabase>, groupId: string): Promise<string> {
  const ledgerAccountId = await createLedgerAccount(companyDb, {
    name: `Employee ${randomUUID()} Reimbursements Payable`,
    groupId,
    openingBalance: 0,
    openingBalanceSide: 'CREDIT',
  });
  const employeeId = randomUUID();
  await companyDb
    .insertInto('employee')
    .values({
      id: employeeId,
      employee_code: `EMP-${randomUUID()}`,
      name: 'Test Employee',
      department: null,
      ledger_account_id: ledgerAccountId,
      is_active: 1 as unknown as boolean,
      date_of_birth: null,
      date_of_joining: '2020-01-01',
      date_of_leaving: null,
      employment_type: 'PERMANENT',
      pan: null,
      bank_account_number: null,
      bank_ifsc: null,
      uan: null,
      esi_number: null,
      salary_payable_ledger_id: null,
      designation: null,
    })
    .execute();
  return employeeId;
}

async function insertEsiPayslip(companyDb: Kysely<CompanyDatabase>, employeeId: string, periodYear: number, periodMonth: number): Promise<void> {
  const runId = randomUUID();
  await companyDb
    .insertInto('payroll_run')
    .values({ id: runId, financial_year: '2025-26', period_month: periodMonth, period_year: periodYear, status: 'PROCESSED' })
    .execute();
  const payslipId = randomUUID();
  await companyDb
    .insertInto('payslip')
    .values({ id: payslipId, payroll_run_id: runId, employee_id: employeeId, paid_days: 300, lop_days: 0, gross_earnings: 25_000_00, total_deductions: 500_00, employer_contributions: 800_00, net_pay: 24_500_00 })
    .execute();
  await companyDb
    .insertInto('payslip_line')
    .values({ id: randomUUID(), payslip_id: payslipId, line_type: 'DEDUCTION', label: 'ESI (employee)', component_id: null, amount: 187_50 })
    .execute();
}

describe('core-payroll-engine: wasEsiApplicableEarlierInContributionPeriod (DB-backed)', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let groupId: string;
  let employeeId: string;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
    await seedChartOfAccounts(companyDb);
    const groups = await listAccountGroups(companyDb);
    groupId = groups.find((g) => g.nature === 'LIABILITY')!.id;
    employeeId = await insertEmployee(companyDb, groupId);
  });

  afterEach(async () => {
    await handle.close();
  });

  it('returns false when there is no prior payslip at all', async () => {
    expect(await wasEsiApplicableEarlierInContributionPeriod(companyDb, employeeId, 2026, 6)).toBe(false);
  });

  it('returns true when an earlier month in the SAME contribution period had an ESI line', async () => {
    await insertEsiPayslip(companyDb, employeeId, 2026, 4); // April — same Apr-Sep period as June
    expect(await wasEsiApplicableEarlierInContributionPeriod(companyDb, employeeId, 2026, 6)).toBe(true);
  });

  it('returns false when the prior ESI line was in a DIFFERENT contribution period', async () => {
    await insertEsiPayslip(companyDb, employeeId, 2026, 3); // March — the PRIOR Oct-Mar period
    expect(await wasEsiApplicableEarlierInContributionPeriod(companyDb, employeeId, 2026, 4)).toBe(false); // April starts a new period
  });

  it('does not count a LATER month in the same period (only strictly-before months matter)', async () => {
    await insertEsiPayslip(companyDb, employeeId, 2026, 8); // August
    expect(await wasEsiApplicableEarlierInContributionPeriod(companyDb, employeeId, 2026, 6)).toBe(false); // June is before August
  });

  it('correctly spans the Oct-Mar period across the calendar-year boundary', async () => {
    await insertEsiPayslip(companyDb, employeeId, 2025, 11); // November 2025
    expect(await wasEsiApplicableEarlierInContributionPeriod(companyDb, employeeId, 2026, 2)).toBe(true); // February 2026, same Oct-Mar period
  });
});
