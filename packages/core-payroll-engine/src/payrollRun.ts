import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import { createVoucherInTransaction } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import { attachPaymentInstrumentInTransaction } from '@mhts/core-banking';
import type { PaymentInstrumentInput } from '@mhts/core-banking';
import { writeAuditLog } from '@mhts/core-audit';
import { resolveApplicability } from './applicability';
import { computeAttendanceSummary } from './attendance';
import { computeEsi } from './esi';
import { getPayrollLedgerIds } from './ledgers';
import { computePf } from './pf';
import { computePt } from './pt';
import { resolveEsiRule, resolvePfRule, resolvePtRule, resolveTdsSlabNewRegime, resolveWageDefinitionCap } from './rules';
import { computeMonthlyTdsNewRegime } from './salaryTds';
import { getActiveSalaryStructure } from './salaryStructure';
import { getCompanyPayrollSettings } from './companySettings';
import type { CreatePayrollRunInput, DisbursePayslipInput, PayrollRunSummary, PayrollRunStatus, PayslipForPrint, PayslipLineSummary, PayslipLineType, PayslipListItemForPrint, PayslipSummary } from './types';

const IS_ACTIVE = 1 as unknown as boolean; // better-sqlite3 only binds numbers/strings/bigints/buffers/null, not JS booleans.

function periodDateBounds(periodYear: number, periodMonth: number): { firstDay: string; lastDay: string } {
  const firstDay = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`;
  const lastDayNum = new Date(Date.UTC(periodYear, periodMonth, 0)).getUTCDate();
  const lastDay = `${periodYear}-${String(periodMonth).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
  return { firstDay, lastDay };
}

export async function createPayrollRun(companyDb: Kysely<CompanyDatabase>, input: CreatePayrollRunInput, actorUserId: string | null): Promise<string> {
  if (input.periodMonth < 1 || input.periodMonth > 12) {
    throw new Error('Period month must be between 1 and 12');
  }
  const existing = await companyDb.selectFrom('payroll_run').select('id').where('period_year', '=', input.periodYear).where('period_month', '=', input.periodMonth).executeTakeFirst();
  if (existing) {
    throw new Error(`A payroll run for ${input.periodMonth}/${input.periodYear} already exists`);
  }

  const id = randomUUID();
  await companyDb.transaction().execute(async (trx) => {
    await trx
      .insertInto('payroll_run')
      .values({ id, financial_year: input.financialYear, period_month: input.periodMonth, period_year: input.periodYear, status: 'DRAFT', created_by: actorUserId })
      .execute();
    await writeAuditLog(trx, { actorUserId, action: 'CREATE', entityType: 'PayrollRun', entityId: id, afterData: { periodMonth: input.periodMonth, periodYear: input.periodYear } });
  });
  return id;
}

/**
 * Computes every active, salary-structured employee's payslip for this run:
 * gross earnings prorated for LOP (attendance.ts), statutory deductions
 * resolved fresh from the RuleSet as of the period's last day (rules.ts —
 * never a hardcoded rate), and employer contributions shown informationally.
 * No GL impact yet — that happens at postPayrollRun. Re-runnable while
 * DRAFT/PROCESSED (recomputes and replaces existing payslips) but never once
 * POSTED, since a posted run's voucher amounts must never drift from what
 * was actually recorded.
 */
export async function processPayrollRun(companyDb: Kysely<CompanyDatabase>, systemDb: Kysely<SystemDatabase>, payrollRunId: string, actorUserId: string | null): Promise<void> {
  const run = await companyDb.selectFrom('payroll_run').selectAll().where('id', '=', payrollRunId).executeTakeFirst();
  if (!run) {
    throw new Error('Payroll run not found');
  }
  if (run.status === 'POSTED' || run.status === 'CANCELLED') {
    throw new Error(`Cannot process a ${run.status} payroll run`);
  }

  const { lastDay } = periodDateBounds(run.period_year, run.period_month);
  const [wageCap, pfRule, esiRule, tdsRule, settings, applicability] = await Promise.all([
    resolveWageDefinitionCap(systemDb, lastDay),
    resolvePfRule(systemDb, lastDay),
    resolveEsiRule(systemDb, lastDay),
    resolveTdsSlabNewRegime(systemDb, lastDay),
    getCompanyPayrollSettings(companyDb),
    resolveApplicability(companyDb, systemDb, lastDay),
  ]);
  const ptRule = await resolvePtRule(systemDb, settings.ptJurisdiction, lastDay);

  const employees = await companyDb.selectFrom('employee').selectAll().where('is_active', '=', IS_ACTIVE).execute();

  interface ComputedPayslip {
    employeeId: string;
    paidDaysTenths: number;
    lopDaysTenths: number;
    grossEarnings: number;
    totalDeductions: number;
    employerContributions: number;
    netPay: number;
    lines: PayslipLineSummary[];
  }
  const computedPayslips: ComputedPayslip[] = [];

  // All reads happen against the plain companyDb, BEFORE the write transaction opens below — none
  // of this depends on anything the transaction itself changes, so there's no need to route these
  // through a Transaction handle (which core-payroll-engine's helpers aren't typed to accept anyway).
  for (const employee of employees) {
    const structure = await getActiveSalaryStructure(companyDb, employee.id, lastDay, wageCap);
    if (!structure) {
      continue; // No salary structure assigned yet — this employee is skipped from this run, not an error.
    }

    const attendance = await computeAttendanceSummary(companyDb, employee.id, run.period_year, run.period_month);
    const proration = attendance.paidDaysTenths / attendance.totalDaysInMonthTenths;

    const lines: PayslipLineSummary[] = [];
    let grossEarnings = 0;
    let totalDeductions = 0;
    let employerContributions = 0;

    for (const line of structure.lines) {
      const proratedAmount = Math.round(line.monthlyAmount * proration);
      if (line.componentType === 'EARNING') {
        grossEarnings += proratedAmount;
        lines.push({ lineType: 'EARNING', label: line.componentName, componentId: line.componentId, amount: proratedAmount });
      } else {
        totalDeductions += proratedAmount;
        lines.push({ lineType: 'DEDUCTION', label: line.componentName, componentId: line.componentId, amount: proratedAmount });
      }
    }

    const proratedWageBase = Math.round(structure.monthlyStatutoryWageBase * proration);

    if (applicability.pfApplies && !employee.pf_voluntary_opt_out) {
      const pf = computePf(proratedWageBase, pfRule);
      if (pf.employeeContribution > 0) {
        totalDeductions += pf.employeeContribution;
        lines.push({ lineType: 'DEDUCTION', label: 'Provident Fund (employee)', componentId: null, amount: pf.employeeContribution });
      }
      if (pf.employerContribution > 0) {
        employerContributions += pf.employerContribution;
        lines.push({ lineType: 'EMPLOYER_CONTRIBUTION', label: 'Provident Fund (employer)', componentId: null, amount: pf.employerContribution });
      }
    }

    if (applicability.esiApplies) {
      const esi = computeEsi(grossEarnings, esiRule);
      if (esi.applicable && esi.employeeContribution > 0) {
        totalDeductions += esi.employeeContribution;
        lines.push({ lineType: 'DEDUCTION', label: 'ESI (employee)', componentId: null, amount: esi.employeeContribution });
      }
      if (esi.applicable && esi.employerContribution > 0) {
        employerContributions += esi.employerContribution;
        lines.push({ lineType: 'EMPLOYER_CONTRIBUTION', label: 'ESI (employer)', componentId: null, amount: esi.employerContribution });
      }
    }

    const ptAmount = computePt(grossEarnings, ptRule);
    if (ptAmount > 0) {
      totalDeductions += ptAmount;
      lines.push({ lineType: 'DEDUCTION', label: 'Professional Tax', componentId: null, amount: ptAmount });
    }

    if (settings.tdsRegime === 'NEW') {
      const annualProjection = grossEarnings * 12;
      const tdsAmount = computeMonthlyTdsNewRegime(annualProjection, tdsRule, 12);
      if (tdsAmount > 0) {
        totalDeductions += tdsAmount;
        lines.push({ lineType: 'DEDUCTION', label: 'Salary TDS (192, new regime estimate)', componentId: null, amount: tdsAmount });
      }
    }
    // Old regime: no auto-computed TDS line — see salaryTds.ts. A user adds one manually via overridePayslipTdsAmount if applicable.

    const netPay = grossEarnings - totalDeductions;
    if (netPay <= 0) {
      throw new Error(`${employee.name}'s deductions (₹${(totalDeductions / 100).toFixed(2)}) meet or exceed gross earnings for this period — cannot produce a non-positive payslip`);
    }

    computedPayslips.push({
      employeeId: employee.id,
      paidDaysTenths: attendance.paidDaysTenths,
      lopDaysTenths: attendance.lopDaysTenths,
      grossEarnings,
      totalDeductions,
      employerContributions,
      netPay,
      lines,
    });
  }

  await companyDb.transaction().execute(async (trx) => {
    const existingPayslips = await trx.selectFrom('payslip').select('id').where('payroll_run_id', '=', payrollRunId).execute();
    for (const payslip of existingPayslips) {
      await trx.deleteFrom('payslip_line').where('payslip_id', '=', payslip.id).execute();
      await trx.deleteFrom('payslip').where('id', '=', payslip.id).execute();
    }

    for (const computed of computedPayslips) {
      const payslipId = randomUUID();
      await trx
        .insertInto('payslip')
        .values({
          id: payslipId,
          payroll_run_id: payrollRunId,
          employee_id: computed.employeeId,
          paid_days: computed.paidDaysTenths,
          lop_days: computed.lopDaysTenths,
          gross_earnings: computed.grossEarnings,
          total_deductions: computed.totalDeductions,
          employer_contributions: computed.employerContributions,
          net_pay: computed.netPay,
        })
        .execute();

      for (const line of computed.lines) {
        await trx.insertInto('payslip_line').values({ id: randomUUID(), payslip_id: payslipId, line_type: line.lineType, label: line.label, component_id: line.componentId, amount: line.amount }).execute();
      }
    }

    await trx.updateTable('payroll_run').set({ status: 'PROCESSED', processed_at: new Date().toISOString() }).where('id', '=', payrollRunId).execute();
    await writeAuditLog(trx, { actorUserId, action: 'UPDATE', entityType: 'PayrollRun', entityId: payrollRunId, afterData: { status: 'PROCESSED' } });
  });
}

/** Overrides a PROCESSED (not yet POSTED) payslip's Salary TDS line — the "user-overridable" half of the both-regimes TDS design (salaryTds.ts): required when the company is on the old regime (no auto-computation exists to override), optional as a correction on the new regime's auto-estimate. Recomputes total_deductions/net_pay to keep the payslip internally consistent. */
export async function overridePayslipTdsAmount(companyDb: Kysely<CompanyDatabase>, payslipId: string, newTdsAmount: number, actorUserId: string | null): Promise<void> {
  if (!Number.isInteger(newTdsAmount) || newTdsAmount < 0) {
    throw new Error('TDS amount must be a non-negative whole-paise amount');
  }
  const payslip = await companyDb.selectFrom('payslip').selectAll().where('id', '=', payslipId).executeTakeFirst();
  if (!payslip) {
    throw new Error('Payslip not found');
  }
  const run = await companyDb.selectFrom('payroll_run').select('status').where('id', '=', payslip.payroll_run_id).executeTakeFirstOrThrow();
  if (run.status !== 'PROCESSED') {
    throw new Error(`Cannot edit a payslip on a ${run.status} payroll run`);
  }

  await companyDb.transaction().execute(async (trx) => {
    const existingTdsLine = await trx.selectFrom('payslip_line').select(['id', 'amount']).where('payslip_id', '=', payslipId).where('label', 'like', 'Salary TDS%').executeTakeFirst();
    const previousAmount = existingTdsLine?.amount ?? 0;

    if (existingTdsLine) {
      if (newTdsAmount === 0) {
        await trx.deleteFrom('payslip_line').where('id', '=', existingTdsLine.id).execute();
      } else {
        await trx.updateTable('payslip_line').set({ amount: newTdsAmount, label: 'Salary TDS (192, manually entered)' }).where('id', '=', existingTdsLine.id).execute();
      }
    } else if (newTdsAmount > 0) {
      await trx
        .insertInto('payslip_line')
        .values({ id: randomUUID(), payslip_id: payslipId, line_type: 'DEDUCTION', label: 'Salary TDS (192, manually entered)', component_id: null, amount: newTdsAmount })
        .execute();
    }

    const newTotalDeductions = payslip.total_deductions - previousAmount + newTdsAmount;
    const newNetPay = payslip.gross_earnings - newTotalDeductions;
    if (newNetPay <= 0) {
      throw new Error('This TDS amount would reduce net pay to zero or below');
    }
    await trx.updateTable('payslip').set({ total_deductions: newTotalDeductions, net_pay: newNetPay }).where('id', '=', payslipId).execute();

    await writeAuditLog(trx, { actorUserId, action: 'UPDATE', entityType: 'Payslip', entityId: payslipId, beforeData: { tdsAmount: previousAmount }, afterData: { tdsAmount: newTdsAmount } });
  });
}

async function loadPayslipsForRun(companyDb: Kysely<CompanyDatabase>, payrollRunId: string): Promise<PayslipSummary[]> {
  const payslips = await companyDb
    .selectFrom('payslip')
    .innerJoin('employee', 'employee.id', 'payslip.employee_id')
    .select([
      'payslip.id as id',
      'payslip.payroll_run_id as payrollRunId',
      'payslip.employee_id as employeeId',
      'employee.name as employeeName',
      'payslip.paid_days as paidDays',
      'payslip.lop_days as lopDays',
      'payslip.gross_earnings as grossEarnings',
      'payslip.total_deductions as totalDeductions',
      'payslip.employer_contributions as employerContributions',
      'payslip.net_pay as netPay',
    ])
    .where('payslip.payroll_run_id', '=', payrollRunId)
    .orderBy('employee.name')
    .execute();

  if (payslips.length === 0) {
    return [];
  }

  const lines = await companyDb
    .selectFrom('payslip_line')
    .select(['payslip_id as payslipId', 'line_type as lineType', 'label', 'component_id as componentId', 'amount'])
    .where(
      'payslip_id',
      'in',
      payslips.map((p) => p.id),
    )
    .execute();
  const linesByPayslip = new Map<string, typeof lines>();
  for (const line of lines) {
    const existing = linesByPayslip.get(line.payslipId) ?? [];
    existing.push(line);
    linesByPayslip.set(line.payslipId, existing);
  }

  const settlements = await companyDb
    .selectFrom('payslip_settlement')
    .innerJoin('voucher', 'voucher.id', 'payslip_settlement.voucher_id')
    .select(({ fn }) => ['payslip_settlement.payslip_id as payslipId', fn.sum<number>('payslip_settlement.amount_applied').as('settled')])
    .where('voucher.cancelled_at', 'is', null)
    .groupBy('payslip_settlement.payslip_id')
    .execute();
  const settledByPayslip = new Map(settlements.map((s) => [s.payslipId, Number(s.settled ?? 0)]));

  return payslips.map((p) => ({
    ...p,
    lines: (linesByPayslip.get(p.id) ?? []).map((l) => ({ lineType: l.lineType as PayslipLineType, label: l.label, componentId: l.componentId, amount: l.amount })),
    outstandingAmount: p.netPay - (settledByPayslip.get(p.id) ?? 0),
  }));
}

export async function getPayrollRun(companyDb: Kysely<CompanyDatabase>, payrollRunId: string): Promise<PayrollRunSummary> {
  const run = await companyDb.selectFrom('payroll_run').selectAll().where('id', '=', payrollRunId).executeTakeFirst();
  if (!run) {
    throw new Error('Payroll run not found');
  }
  const payslips = await loadPayslipsForRun(companyDb, payrollRunId);
  return { id: run.id, financialYear: run.financial_year, periodMonth: run.period_month, periodYear: run.period_year, status: run.status as PayrollRunStatus, voucherId: run.voucher_id, payslips };
}

/** Phase 9 Increment 1 (Print + Templates) — full employee+run assembly for a printed payslip. Money stays paise (converted at the IPC boundary, same convention as every other handler in this codebase). */
export async function getPayslipForPrint(companyDb: Kysely<CompanyDatabase>, payslipId: string): Promise<PayslipForPrint> {
  const row = await companyDb
    .selectFrom('payslip')
    .innerJoin('employee', 'employee.id', 'payslip.employee_id')
    .innerJoin('payroll_run', 'payroll_run.id', 'payslip.payroll_run_id')
    .select([
      'employee.name as employeeName',
      'employee.employee_code as employeeCode',
      'employee.designation as designation',
      'employee.pan as pan',
      'employee.bank_account_number as bankAccountNumber',
      'employee.bank_ifsc as bankIfsc',
      'employee.uan as uan',
      'payroll_run.financial_year as financialYear',
      'payroll_run.period_month as periodMonth',
      'payroll_run.period_year as periodYear',
      'payslip.paid_days as paidDays',
      'payslip.lop_days as lopDays',
      'payslip.gross_earnings as grossEarnings',
      'payslip.total_deductions as totalDeductions',
      'payslip.net_pay as netPay',
    ])
    .where('payslip.id', '=', payslipId)
    .executeTakeFirst();
  if (!row) {
    throw new Error('Payslip not found');
  }

  const lineRows = await companyDb
    .selectFrom('payslip_line')
    .select(['line_type as lineType', 'label', 'component_id as componentId', 'amount'])
    .where('payslip_id', '=', payslipId)
    .execute();
  const lines: PayslipLineSummary[] = lineRows.map((l) => ({ lineType: l.lineType as PayslipLineType, label: l.label, componentId: l.componentId, amount: l.amount }));

  return { ...row, lines };
}

/** Phase 9 Increment 2 (Print + Templates) — a flat cross-run payslip listing for the Print Centre (PayrollRunScreen's own listing is scoped to one selected run at a time). */
export async function listPayslipsForPrint(companyDb: Kysely<CompanyDatabase>): Promise<PayslipListItemForPrint[]> {
  const rows = await companyDb
    .selectFrom('payslip')
    .innerJoin('employee', 'employee.id', 'payslip.employee_id')
    .innerJoin('payroll_run', 'payroll_run.id', 'payslip.payroll_run_id')
    .select([
      'payslip.id as id',
      'employee.name as employeeName',
      'employee.employee_code as employeeCode',
      'payroll_run.financial_year as financialYear',
      'payroll_run.period_month as periodMonth',
      'payroll_run.period_year as periodYear',
      'payslip.net_pay as netPay',
      'payroll_run.status as runStatus',
    ])
    .orderBy('payroll_run.period_year', 'desc')
    .orderBy('payroll_run.period_month', 'desc')
    .orderBy('employee.name', 'asc')
    .execute();

  return rows.map((r) => ({ ...r, runStatus: r.runStatus as PayrollRunStatus }));
}

export async function listPayrollRuns(companyDb: Kysely<CompanyDatabase>): Promise<PayrollRunSummary[]> {
  const runs = await companyDb.selectFrom('payroll_run').selectAll().orderBy('period_year', 'desc').orderBy('period_month', 'desc').execute();
  return Promise.all(
    runs.map(async (run) => ({
      id: run.id,
      financialYear: run.financial_year,
      periodMonth: run.period_month,
      periodYear: run.period_year,
      status: run.status as PayrollRunStatus,
      voucherId: run.voucher_id,
      payslips: await loadPayslipsForRun(companyDb, run.id),
    })),
  );
}

/**
 * Posts one balanced 'PAYROLL' voucher for the entire run (CLAUDE.md Rule
 * #4 — every payslip's GL impact is one atomic unit, not one voucher per
 * employee): Dr each earning component's expense ledger (grouped, so a
 * component with a custom expense_ledger_id gets its own line) plus employer
 * PF/ESI contribution ledgers, Cr each employee's own salary-payable ledger
 * for their net pay, Cr the PF/ESI/PT/Salary-TDS payable ledgers for the
 * combined amounts owed to statutory authorities.
 */
export async function postPayrollRun(companyDb: Kysely<CompanyDatabase>, payrollRunId: string, voucherDate: string, actorUserId: string | null): Promise<string> {
  const run = await companyDb.selectFrom('payroll_run').selectAll().where('id', '=', payrollRunId).executeTakeFirst();
  if (!run) {
    throw new Error('Payroll run not found');
  }
  if (run.status !== 'PROCESSED') {
    throw new Error(`Cannot post a ${run.status} payroll run — it must be PROCESSED first`);
  }

  const payslips = await loadPayslipsForRun(companyDb, payrollRunId);
  if (payslips.length === 0) {
    throw new Error('This payroll run has no payslips to post');
  }

  const ledgerIds = await getPayrollLedgerIds(companyDb);
  const earningLedgerTotals = new Map<string, number>();
  earningLedgerTotals.set(ledgerIds.salariesWagesLedgerId, 0);
  let employerPfTotal = 0;
  let employerEsiTotal = 0;
  let pfPayableTotal = 0;
  let esiPayableTotal = 0;
  let ptPayableTotal = 0;
  let tdsPayableTotal = 0;

  const employeeLines: VoucherLineInput[] = [];

  for (const payslip of payslips) {
    for (const line of payslip.lines) {
      if (line.lineType === 'EARNING') {
        earningLedgerTotals.set(ledgerIds.salariesWagesLedgerId, (earningLedgerTotals.get(ledgerIds.salariesWagesLedgerId) ?? 0) + line.amount);
      } else if (line.lineType === 'EMPLOYER_CONTRIBUTION') {
        if (line.label.startsWith('Provident Fund')) employerPfTotal += line.amount;
        else if (line.label.startsWith('ESI')) employerEsiTotal += line.amount;
      } else if (line.lineType === 'DEDUCTION') {
        if (line.label.startsWith('Provident Fund')) pfPayableTotal += line.amount;
        else if (line.label.startsWith('ESI')) esiPayableTotal += line.amount;
        else if (line.label.startsWith('Professional Tax')) ptPayableTotal += line.amount;
        else if (line.label.startsWith('Salary TDS')) tdsPayableTotal += line.amount;
      }
    }
    const employee = await companyDb.selectFrom('employee').select('salary_payable_ledger_id').where('id', '=', payslip.employeeId).executeTakeFirstOrThrow();
    if (!employee.salary_payable_ledger_id) {
      throw new Error(`${payslip.employeeName} has no salary-payable ledger — this should not happen for an employee with a payslip`);
    }
    employeeLines.push({ ledgerId: employee.salary_payable_ledger_id, debitAmount: 0, creditAmount: payslip.netPay });
  }
  // Employee PF/ESI deductions are already netted OUT of net pay above; the payable ledgers below need the EMPLOYEE share added back on top of the employer share already accumulated.
  pfPayableTotal += employerPfTotal;
  esiPayableTotal += employerEsiTotal;

  const voucherLines: VoucherLineInput[] = [
    ...[...earningLedgerTotals.entries()].filter(([, amount]) => amount > 0).map(([ledgerId, amount]) => ({ ledgerId, debitAmount: amount, creditAmount: 0 })),
    ...(employerPfTotal > 0 ? [{ ledgerId: ledgerIds.employerPfContributionLedgerId, debitAmount: employerPfTotal, creditAmount: 0 }] : []),
    ...(employerEsiTotal > 0 ? [{ ledgerId: ledgerIds.employerEsiContributionLedgerId, debitAmount: employerEsiTotal, creditAmount: 0 }] : []),
    ...employeeLines,
    ...(pfPayableTotal > 0 ? [{ ledgerId: ledgerIds.pfPayableLedgerId, debitAmount: 0, creditAmount: pfPayableTotal }] : []),
    ...(esiPayableTotal > 0 ? [{ ledgerId: ledgerIds.esiPayableLedgerId, debitAmount: 0, creditAmount: esiPayableTotal }] : []),
    ...(ptPayableTotal > 0 ? [{ ledgerId: ledgerIds.ptPayableLedgerId, debitAmount: 0, creditAmount: ptPayableTotal }] : []),
    ...(tdsPayableTotal > 0 ? [{ ledgerId: ledgerIds.salaryTdsPayableLedgerId, debitAmount: 0, creditAmount: tdsPayableTotal }] : []),
  ];

  return companyDb.transaction().execute(async (trx) => {
    const { voucherId } = await createVoucherInTransaction(
      trx,
      { voucherType: 'PAYROLL', financialYear: run.financial_year, voucherDate, narration: `Payroll for ${run.period_month}/${run.period_year}`, lines: voucherLines },
      actorUserId,
    );
    await trx.updateTable('payroll_run').set({ status: 'POSTED', voucher_id: voucherId, posted_at: new Date().toISOString() }).where('id', '=', payrollRunId).execute();
    await writeAuditLog(trx, { actorUserId, action: 'UPDATE', entityType: 'PayrollRun', entityId: payrollRunId, afterData: { status: 'POSTED', voucherId } });
    return voucherId;
  });
}

/** Disbursement mirrors core-expense's reimburseExpenseClaim exactly: a PAYMENT voucher (Dr the employee's salary-payable ledger, Cr the payment ledger) plus a settlement row, atomically. */
export async function disbursePayslip(companyDb: Kysely<CompanyDatabase>, input: DisbursePayslipInput, actorUserId: string | null, instrument?: PaymentInstrumentInput): Promise<string> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('Disbursement amount must be a positive whole-paise amount');
  }
  const payslip = await companyDb.selectFrom('payslip').selectAll().where('id', '=', input.payslipId).executeTakeFirst();
  if (!payslip) {
    throw new Error('Payslip not found');
  }
  const run = await companyDb.selectFrom('payroll_run').select('status').where('id', '=', payslip.payroll_run_id).executeTakeFirstOrThrow();
  if (run.status !== 'POSTED') {
    throw new Error('This payslip cannot be disbursed until its payroll run is posted');
  }

  const settledRow = await companyDb
    .selectFrom('payslip_settlement')
    .innerJoin('voucher', 'voucher.id', 'payslip_settlement.voucher_id')
    .select(({ fn }) => fn.sum<number>('payslip_settlement.amount_applied').as('settled'))
    .where('payslip_settlement.payslip_id', '=', input.payslipId)
    .where('voucher.cancelled_at', 'is', null)
    .executeTakeFirst();
  const outstanding = payslip.net_pay - Number(settledRow?.settled ?? 0);
  if (input.amount > outstanding) {
    throw new Error(`Disbursement amount exceeds the payslip's remaining outstanding balance (₹${(outstanding / 100).toFixed(2)})`);
  }

  const employee = await companyDb.selectFrom('employee').selectAll().where('id', '=', payslip.employee_id).executeTakeFirstOrThrow();
  const voucherLines: VoucherLineInput[] = [
    { ledgerId: employee.salary_payable_ledger_id!, debitAmount: input.amount, creditAmount: 0 },
    { ledgerId: input.paymentLedgerId, debitAmount: 0, creditAmount: input.amount },
  ];

  return companyDb.transaction().execute(async (trx: Transaction<CompanyDatabase>) => {
    const { voucherId } = await createVoucherInTransaction(
      trx,
      { voucherType: 'PAYMENT', financialYear: input.financialYear, voucherDate: input.paymentDate, narration: input.narration, lines: voucherLines },
      actorUserId,
    );
    if (instrument) {
      await attachPaymentInstrumentInTransaction(trx, voucherId, instrument, actorUserId);
    }
    await trx.insertInto('payslip_settlement').values({ id: randomUUID(), payslip_id: input.payslipId, voucher_id: voucherId, amount_applied: input.amount }).execute();
    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'PayslipSettlement',
      entityId: voucherId,
      afterData: { payslipId: input.payslipId, amount: input.amount, fullySettled: input.amount === outstanding },
    });
    return voucherId;
  });
}
