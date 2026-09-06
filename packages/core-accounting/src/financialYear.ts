/** e.g. startMonth=4 (April), date in Jan 2027 -> '2026-27' (the year the FY started, not the calendar year). */
export function computeFinancialYearLabel(financialYearStartMonth: number, date: Date): string {
  const month = date.getUTCMonth() + 1; // 1-12
  const year = date.getUTCFullYear();
  const startYear = month >= financialYearStartMonth ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** The inverse of computeFinancialYearLabel: given a label like '2025-26' and the company's own start month, returns the FY's actual [fromDate, toDate] calendar bounds (inclusive) — e.g. startMonth=4, '2025-26' -> {fromDate: '2025-04-01', toDate: '2026-03-31'}. Used by GSTR-9/9C annual prep, which aggregate a whole financial year rather than an arbitrary date range. */
export function computeFinancialYearDateBounds(financialYearStartMonth: number, financialYear: string): { fromDate: string; toDate: string } {
  const startYear = Number(financialYear.slice(0, 4));
  if (!Number.isInteger(startYear)) {
    throw new Error(`Malformed financial year label: "${financialYear}"`);
  }
  const fromDate = new Date(Date.UTC(startYear, financialYearStartMonth - 1, 1));
  const toDate = new Date(Date.UTC(startYear + 1, financialYearStartMonth - 1, 1));
  toDate.setUTCDate(toDate.getUTCDate() - 1);
  return { fromDate: fromDate.toISOString().slice(0, 10), toDate: toDate.toISOString().slice(0, 10) };
}
