import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import { createVoucherInTransaction } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import { writeAuditLog } from '@mhts/core-audit';
import { resolveApplicability } from './applicability';
import { computeGratuityEligibility, computeGratuityFormulaAmount, computeMonthlyProvisionIncrement, computeYearsOfServiceDays } from './gratuity';
import { getPayrollLedgerIds } from './ledgers';
import { resolveGratuityEligibilityRule, resolveWageDefinitionCap } from './rules';
import { getActiveSalaryStructure } from './salaryStructure';
import type { EmploymentType, GratuityRecordStatus, GratuityRecordSummary, RecordSeparationInput, SettleGratuityInput } from './types';

const IS_ACTIVE = 1 as unknown as boolean; // better-sqlite3 only binds numbers/strings/bigints/buffers/null, not JS booleans.

async function latestCumulativeProvision(companyDb: Kysely<CompanyDatabase>, employeeId: string): Promise<number> {
  const row = await companyDb
    .selectFrom('gratuity_provision_line')
    .innerJoin('gratuity_provision_run', 'gratuity_provision_run.id', 'gratuity_provision_line.gratuity_provision_run_id')
    .select('gratuity_provision_line.cumulative_provision_after as cumulativeProvisionAfter')
    .where('gratuity_provision_line.employee_id', '=', employeeId)
    .orderBy('gratuity_provision_run.period_year', 'desc')
    .orderBy('gratuity_provision_run.period_month', 'desc')
    .executeTakeFirst();
  return row?.cumulativeProvisionAfter ?? 0;
}

/**
 * Monthly, company-wide formula-based accrual (NOT an actuarial AS-15/Ind
 * AS-19 valuation — flag this wherever it's surfaced in the UI): for every
 * eligible active employee, tops up their share of the Gratuity Provision
 * ledger by however much the formula amount grew this month (longer tenure,
 * or a salary revision), in ONE balanced voucher for the whole run — same
 * "one voucher per run" pattern as postPayrollRun.
 */
export async function runGratuityProvisioning(companyDb: Kysely<CompanyDatabase>, systemDb: Kysely<SystemDatabase>, periodYear: number, periodMonth: number, actorUserId: string | null): Promise<string> {
  const existing = await companyDb.selectFrom('gratuity_provision_run').select('id').where('period_year', '=', periodYear).where('period_month', '=', periodMonth).executeTakeFirst();
  if (existing) {
    throw new Error(`A gratuity provisioning run for ${periodMonth}/${periodYear} already exists`);
  }

  const periodEndDate = new Date(Date.UTC(periodYear, periodMonth, 0)).toISOString().slice(0, 10);
  const [wageCap, gratuityRule, applicability] = await Promise.all([
    resolveWageDefinitionCap(systemDb, periodEndDate),
    resolveGratuityEligibilityRule(systemDb, periodEndDate),
    resolveApplicability(companyDb, systemDb, periodEndDate),
  ]);

  const employees = await companyDb.selectFrom('employee').selectAll().where('is_active', '=', IS_ACTIVE).execute();

  const lines: { employeeId: string; daysOfServiceSnapshot: number; provisionedAmount: number; cumulativeProvisionAfter: number }[] = [];
  let totalIncrement = 0;

  for (const employee of employees) {
    if (!employee.date_of_joining) continue;
    const structure = await getActiveSalaryStructure(companyDb, employee.id, periodEndDate, wageCap);
    if (!structure) continue;

    const daysOfService = computeYearsOfServiceDays(employee.date_of_joining, periodEndDate);
    const eligibility = computeGratuityEligibility(employee.employment_type as EmploymentType | null, daysOfService, gratuityRule, applicability.gratuityApplies);
    const cumulativeSoFar = await latestCumulativeProvision(companyDb, employee.id);
    const increment = computeMonthlyProvisionIncrement(eligibility.isEligible, structure.monthlyStatutoryWageBase, daysOfService, cumulativeSoFar);

    if (increment > 0) {
      lines.push({ employeeId: employee.id, daysOfServiceSnapshot: daysOfService, provisionedAmount: increment, cumulativeProvisionAfter: cumulativeSoFar + increment });
      totalIncrement += increment;
    }
  }

  const runId = randomUUID();
  // Resolved BEFORE opening the transaction below — calling back into `companyDb` (rather than
  // `trx`) from inside its own transaction callback deadlocks Kysely's single-connection queue
  // (the transaction holds the only connection; the nested query waits forever for one that will
  // never free up), so every read this function needs happens up front, same as postPayrollRun.
  const ledgerIds = await getPayrollLedgerIds(companyDb);
  return companyDb.transaction().execute(async (trx) => {
    let voucherId: string | null = null;
    if (totalIncrement > 0) {
      const voucherLines: VoucherLineInput[] = [
        { ledgerId: ledgerIds.gratuityExpenseLedgerId, debitAmount: totalIncrement, creditAmount: 0 },
        { ledgerId: ledgerIds.gratuityProvisionLedgerId, debitAmount: 0, creditAmount: totalIncrement },
      ];
      const result = await createVoucherInTransaction(
        trx,
        { voucherType: 'GRATUITY_PROVISION', financialYear: `${periodYear}-${String((periodYear + 1) % 100).padStart(2, '0')}`, voucherDate: periodEndDate, narration: `Gratuity provisioning for ${periodMonth}/${periodYear}`, lines: voucherLines },
        actorUserId,
      );
      voucherId = result.voucherId;
    }

    await trx.insertInto('gratuity_provision_run').values({ id: runId, period_year: periodYear, period_month: periodMonth, voucher_id: voucherId }).execute();
    for (const line of lines) {
      await trx
        .insertInto('gratuity_provision_line')
        .values({ id: randomUUID(), gratuity_provision_run_id: runId, employee_id: line.employeeId, days_of_service_snapshot: line.daysOfServiceSnapshot, provisioned_amount: line.provisionedAmount, cumulative_provision_after: line.cumulativeProvisionAfter })
        .execute();
    }
    await writeAuditLog(trx, { actorUserId, action: 'CREATE', entityType: 'GratuityProvisionRun', entityId: runId, afterData: { periodYear, periodMonth, totalIncrement, voucherId } });
    return runId;
  });
}

/**
 * Records an employee's separation: computes eligibility and the formula
 * amount as of the separation date, and immediately true-ups the Gratuity
 * Provision ledger to exactly match that formula amount via one adjustment
 * voucher (a top-up if the running provision was short, a release if the
 * employee turns out ineligible or the provision overshot) — so
 * settleGratuity later can pay out precisely what's been provisioned, with
 * no residual balance left behind for this employee.
 */
export async function recordSeparation(companyDb: Kysely<CompanyDatabase>, systemDb: Kysely<SystemDatabase>, input: RecordSeparationInput, actorUserId: string | null): Promise<string> {
  const employee = await companyDb.selectFrom('employee').selectAll().where('id', '=', input.employeeId).executeTakeFirst();
  if (!employee) {
    throw new Error('Employee not found');
  }
  const existingRecord = await companyDb.selectFrom('gratuity_record').select('id').where('employee_id', '=', input.employeeId).executeTakeFirst();
  if (existingRecord) {
    throw new Error('A gratuity record already exists for this employee');
  }
  if (!employee.date_of_joining) {
    throw new Error("This employee's date of joining is not set — required to compute years of service");
  }

  const [wageCap, gratuityRule, applicability] = await Promise.all([
    resolveWageDefinitionCap(systemDb, input.separationDate),
    resolveGratuityEligibilityRule(systemDb, input.separationDate),
    resolveApplicability(companyDb, systemDb, input.separationDate),
  ]);
  const structure = await getActiveSalaryStructure(companyDb, input.employeeId, input.separationDate, wageCap);
  const daysOfService = computeYearsOfServiceDays(employee.date_of_joining, input.separationDate);
  const eligibility = computeGratuityEligibility(employee.employment_type as EmploymentType | null, daysOfService, gratuityRule, applicability.gratuityApplies);
  const formulaAmount = eligibility.isEligible && structure ? computeGratuityFormulaAmount(structure.monthlyStatutoryWageBase, daysOfService) : 0;
  const cumulativeProvision = await latestCumulativeProvision(companyDb, input.employeeId);
  const adjustmentAmount = formulaAmount - cumulativeProvision;

  const recordId = randomUUID();
  // Resolved before the transaction opens — see runGratuityProvisioning's identical comment above.
  const ledgerIds = await getPayrollLedgerIds(companyDb);
  return companyDb.transaction().execute(async (trx) => {
    let adjustmentVoucherId: string | null = null;
    if (adjustmentAmount !== 0) {
      const voucherLines: VoucherLineInput[] =
        adjustmentAmount > 0
          ? [
              { ledgerId: ledgerIds.gratuityExpenseLedgerId, debitAmount: adjustmentAmount, creditAmount: 0 },
              { ledgerId: ledgerIds.gratuityProvisionLedgerId, debitAmount: 0, creditAmount: adjustmentAmount },
            ]
          : [
              { ledgerId: ledgerIds.gratuityProvisionLedgerId, debitAmount: -adjustmentAmount, creditAmount: 0 },
              { ledgerId: ledgerIds.gratuityExpenseLedgerId, debitAmount: 0, creditAmount: -adjustmentAmount },
            ];
      const result = await createVoucherInTransaction(
        trx,
        {
          voucherType: 'GRATUITY_PROVISION',
          financialYear: `${new Date(input.separationDate).getUTCFullYear()}-${String((new Date(input.separationDate).getUTCFullYear() + 1) % 100).padStart(2, '0')}`,
          voucherDate: input.separationDate,
          narration: `Gratuity provision true-up on ${employee.name}'s separation`,
          lines: voucherLines,
        },
        actorUserId,
      );
      adjustmentVoucherId = result.voucherId;
    }

    await trx
      .insertInto('gratuity_record')
      .values({
        id: recordId,
        employee_id: input.employeeId,
        separation_date: input.separationDate,
        is_eligible: (eligibility.isEligible ? 1 : 0) as unknown as boolean,
        eligibility_reason: eligibility.reason,
        years_of_service_days: daysOfService,
        formula_amount: formulaAmount,
        cumulative_provision_at_separation: cumulativeProvision + adjustmentAmount,
        adjustment_amount: adjustmentAmount,
        adjustment_voucher_id: adjustmentVoucherId,
        settlement_voucher_id: null,
        status: 'DRAFT' satisfies GratuityRecordStatus,
        created_by: actorUserId,
      })
      .execute();

    await trx.updateTable('employee').set({ date_of_leaving: input.separationDate, is_active: 0 as unknown as boolean }).where('id', '=', input.employeeId).execute();

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'GratuityRecord',
      entityId: recordId,
      afterData: { employeeId: input.employeeId, isEligible: eligibility.isEligible, formulaAmount, adjustmentAmount },
    });

    return recordId;
  });
}

/** Pays out a settled, eligible gratuity record directly from the Gratuity Provision ledger (Dr Gratuity Provision, Cr payment ledger) — not through the employee's salary-payable ledger, since recordSeparation already trued the provision up to exactly the formula amount owed. */
export async function settleGratuity(companyDb: Kysely<CompanyDatabase>, input: SettleGratuityInput, actorUserId: string | null): Promise<string> {
  const record = await companyDb.selectFrom('gratuity_record').selectAll().where('id', '=', input.gratuityRecordId).executeTakeFirst();
  if (!record) {
    throw new Error('Gratuity record not found');
  }
  if (record.status !== 'DRAFT') {
    throw new Error('This gratuity record has already been settled');
  }
  if (!record.is_eligible || record.formula_amount <= 0) {
    throw new Error('This employee is not eligible for a gratuity payout');
  }

  const ledgerIds = await getPayrollLedgerIds(companyDb);
  const voucherLines: VoucherLineInput[] = [
    { ledgerId: ledgerIds.gratuityProvisionLedgerId, debitAmount: record.formula_amount, creditAmount: 0 },
    { ledgerId: input.paymentLedgerId, debitAmount: 0, creditAmount: record.formula_amount },
  ];

  return companyDb.transaction().execute(async (trx) => {
    const { voucherId } = await createVoucherInTransaction(
      trx,
      { voucherType: 'PAYMENT', financialYear: input.financialYear, voucherDate: input.paymentDate, narration: input.narration ?? 'Gratuity settlement', lines: voucherLines },
      actorUserId,
    );
    await trx.updateTable('gratuity_record').set({ settlement_voucher_id: voucherId, status: 'SETTLED' satisfies GratuityRecordStatus }).where('id', '=', input.gratuityRecordId).execute();
    await writeAuditLog(trx, { actorUserId, action: 'UPDATE', entityType: 'GratuityRecord', entityId: input.gratuityRecordId, afterData: { status: 'SETTLED', voucherId } });
    return voucherId;
  });
}

export async function listGratuityRecords(companyDb: Kysely<CompanyDatabase>): Promise<GratuityRecordSummary[]> {
  const rows = await companyDb
    .selectFrom('gratuity_record')
    .innerJoin('employee', 'employee.id', 'gratuity_record.employee_id')
    .select([
      'gratuity_record.id as id',
      'gratuity_record.employee_id as employeeId',
      'employee.name as employeeName',
      'gratuity_record.separation_date as separationDate',
      'gratuity_record.is_eligible as isEligible',
      'gratuity_record.eligibility_reason as eligibilityReason',
      'gratuity_record.years_of_service_days as yearsOfServiceDays',
      'gratuity_record.formula_amount as formulaAmount',
      'gratuity_record.cumulative_provision_at_separation as cumulativeProvisionAtSeparation',
      'gratuity_record.adjustment_amount as adjustmentAmount',
      'gratuity_record.status as status',
      'gratuity_record.settlement_voucher_id as settlementVoucherId',
    ])
    .orderBy('gratuity_record.separation_date', 'desc')
    .execute();

  return rows.map((row) => ({ ...row, isEligible: Boolean(row.isEligible), status: row.status as GratuityRecordStatus }));
}
