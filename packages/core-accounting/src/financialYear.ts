/** e.g. startMonth=4 (April), date in Jan 2027 -> '2026-27' (the year the FY started, not the calendar year). */
export function computeFinancialYearLabel(financialYearStartMonth: number, date: Date): string {
  const month = date.getUTCMonth() + 1; // 1-12
  const year = date.getUTCFullYear();
  const startYear = month >= financialYearStartMonth ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}
