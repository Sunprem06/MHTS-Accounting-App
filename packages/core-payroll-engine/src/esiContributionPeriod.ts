import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export interface ContributionPeriodBounds {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

/** The ESI Act's two fixed calendar contribution periods: 1 Apr-30 Sep, and 1 Oct-31 Mar (spanning into the next calendar year). Independent of the company's own accounting financial-year setting — these bounds are a statutory fixture, not configurable. */
export function contributionPeriodBounds(periodYear: number, periodMonth: number): ContributionPeriodBounds {
  if (periodMonth >= 4 && periodMonth <= 9) {
    return { startYear: periodYear, startMonth: 4, endYear: periodYear, endMonth: 9 };
  }
  if (periodMonth >= 10) {
    return { startYear: periodYear, startMonth: 10, endYear: periodYear + 1, endMonth: 3 };
  }
  // periodMonth is 1-3 — the tail end of a period that started in the PRIOR calendar year.
  return { startYear: periodYear - 1, startMonth: 10, endYear: periodYear, endMonth: 3 };
}

/** Encodes (year, month) as a single comparable integer (year*12+month) so "before"/"within bounds" comparisons don't need special-casing the Oct-Mar period's calendar-year rollover. */
function monthKey(year: number, month: number): number {
  return year * 12 + month;
}

/**
 * True if this employee had an ESI (employee or employer) payslip line in
 * any payroll run STRICTLY BEFORE the given period, but still within the
 * same statutory contribution period — see contributionPeriodBounds().
 * Drives computeEsi()'s forceApplicable option in payrollRun.ts. Uses the
 * exact payslip_line.label strings payrollRun.ts itself writes ('ESI
 * (employee)' / 'ESI (employer)') — no new column or migration needed.
 * Filtered in application code rather than in SQL (this employee's total
 * payslip-line history is small) to keep the query a plain column filter,
 * matching this file's own comparison-in-code style.
 */
export async function wasEsiApplicableEarlierInContributionPeriod(
  companyDb: Kysely<CompanyDatabase>,
  employeeId: string,
  periodYear: number,
  periodMonth: number,
): Promise<boolean> {
  const bounds = contributionPeriodBounds(periodYear, periodMonth);
  const periodStartKey = monthKey(bounds.startYear, bounds.startMonth);
  const currentKey = monthKey(periodYear, periodMonth);

  const candidates = await companyDb
    .selectFrom('payslip_line')
    .innerJoin('payslip', 'payslip.id', 'payslip_line.payslip_id')
    .innerJoin('payroll_run', 'payroll_run.id', 'payslip.payroll_run_id')
    .select(['payroll_run.period_year as periodYear', 'payroll_run.period_month as periodMonth'])
    .where('payslip.employee_id', '=', employeeId)
    .where('payslip_line.label', 'in', ['ESI (employee)', 'ESI (employer)'])
    .execute();

  return candidates.some((c) => {
    const key = monthKey(c.periodYear, c.periodMonth);
    return key >= periodStartKey && key < currentKey;
  });
}
