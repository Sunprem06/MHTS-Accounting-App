import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { ensureEmployeeSalaryPayableLedger } from './ledgers';
import { computeStatutoryWageBase } from './wageClassification';
import type { WageDefinitionCapPayload } from './types';
import type { AssignSalaryStructureInput, ComponentType, SalaryStructureLineSummary, SalaryStructureSummary } from './types';

const IS_ACTIVE = 1 as unknown as boolean; // better-sqlite3 only binds numbers/strings/bigints/buffers/null, not JS booleans.

/**
 * Resolves each active component's monthly amount from the employee's
 * annual CTC. PCT_OF_BASIC is resolved against the sum of FLAT/PCT_OF_CTC
 * components already flagged is_statutory_wage_base ("Basic") — a
 * deliberate, documented simplification: this schema has no separate
 * "designated Basic component" concept, so "Basic" means whatever the
 * company has already flagged as wage-base among its flat/CTC-percentage
 * components. PCT_OF_BASIC components should themselves not be flagged
 * is_statutory_wage_base in most real structures (they're typically
 * allowances defined as a percent of Basic) — nothing enforces that here,
 * it's a modelling convention communicated in the Manage Salary Components
 * screen, not a hard constraint.
 */
function resolveMonthlyAmounts(
  components: { id: string; calculationType: string; flatAmountPaise: number | null; percentBasisPoints: number | null; isStatutoryWageBase: boolean }[],
  annualCtc: number,
): Map<string, number> {
  const amounts = new Map<string, number>();
  let basicSum = 0;

  for (const component of components) {
    if (component.calculationType === 'FLAT') {
      const amount = component.flatAmountPaise ?? 0;
      amounts.set(component.id, amount);
      if (component.isStatutoryWageBase) basicSum += amount;
    } else if (component.calculationType === 'PCT_OF_CTC') {
      const amount = Math.round((annualCtc * (component.percentBasisPoints ?? 0)) / 10000 / 12);
      amounts.set(component.id, amount);
      if (component.isStatutoryWageBase) basicSum += amount;
    }
  }

  for (const component of components) {
    if (component.calculationType === 'PCT_OF_BASIC') {
      const amount = Math.round((basicSum * (component.percentBasisPoints ?? 0)) / 10000);
      amounts.set(component.id, amount);
    }
  }

  return amounts;
}

/** A raise (or initial assignment) is a new row, never an edit of history — same discipline @mhts/core-rules-engine's createRuleSetVersion uses for rate changes. */
export async function assignSalaryStructure(companyDb: Kysely<CompanyDatabase>, input: AssignSalaryStructureInput, actorUserId: string | null): Promise<string> {
  if (!Number.isInteger(input.annualCtc) || input.annualCtc <= 0) {
    throw new Error('Annual CTC must be a positive whole-paise amount');
  }
  const employee = await companyDb.selectFrom('employee').select('id').where('id', '=', input.employeeId).executeTakeFirst();
  if (!employee) {
    throw new Error('Employee not found');
  }

  const components = await companyDb
    .selectFrom('salary_component_definition')
    .select(['id', 'calculation_type as calculationType', 'flat_amount_paise as flatAmountPaise', 'percent_basis_points as percentBasisPoints', 'is_statutory_wage_base as isStatutoryWageBase'])
    .where('is_active', '=', IS_ACTIVE)
    .execute();
  if (components.length === 0) {
    throw new Error('No active salary components defined — add some from Manage Salary Components first');
  }
  const normalizedComponents = components.map((c) => ({ ...c, isStatutoryWageBase: Boolean(c.isStatutoryWageBase) }));
  const monthlyAmounts = resolveMonthlyAmounts(normalizedComponents, input.annualCtc);

  const structureId = randomUUID();
  await companyDb.transaction().execute(async (trx) => {
    const previous = await trx
      .selectFrom('salary_structure')
      .select('id')
      .where('employee_id', '=', input.employeeId)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst();
    if (previous) {
      const dayBefore = new Date(input.effectiveFrom);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      await trx
        .updateTable('salary_structure')
        .set({ status: 'SUPERSEDED', effective_to: dayBefore.toISOString().slice(0, 10) })
        .where('id', '=', previous.id)
        .execute();
    }

    await trx
      .insertInto('salary_structure')
      .values({ id: structureId, employee_id: input.employeeId, effective_from: input.effectiveFrom, effective_to: null, annual_ctc: input.annualCtc, status: 'ACTIVE', created_by: actorUserId })
      .execute();

    for (const component of normalizedComponents) {
      await trx
        .insertInto('salary_structure_line')
        .values({ id: randomUUID(), salary_structure_id: structureId, component_id: component.id, monthly_amount: monthlyAmounts.get(component.id) ?? 0 })
        .execute();
    }

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'SalaryStructure',
      entityId: structureId,
      afterData: { employeeId: input.employeeId, effectiveFrom: input.effectiveFrom, annualCtc: input.annualCtc },
    });
  });

  await ensureEmployeeSalaryPayableLedger(companyDb, input.employeeId);
  return structureId;
}

async function loadStructureWithLines(companyDb: Kysely<CompanyDatabase>, structureId: string, wageCap: WageDefinitionCapPayload): Promise<SalaryStructureSummary> {
  const structure = await companyDb.selectFrom('salary_structure').selectAll().where('id', '=', structureId).executeTakeFirstOrThrow();
  const lineRows = await companyDb
    .selectFrom('salary_structure_line')
    .innerJoin('salary_component_definition', 'salary_component_definition.id', 'salary_structure_line.component_id')
    .select([
      'salary_structure_line.component_id as componentId',
      'salary_component_definition.name as componentName',
      'salary_component_definition.component_type as componentType',
      'salary_component_definition.is_statutory_wage_base as isStatutoryWageBase',
      'salary_structure_line.monthly_amount as monthlyAmount',
    ])
    .where('salary_structure_line.salary_structure_id', '=', structureId)
    .execute();

  const lines: SalaryStructureLineSummary[] = lineRows.map((row) => ({ ...row, componentType: row.componentType as ComponentType, isStatutoryWageBase: Boolean(row.isStatutoryWageBase) }));
  const earningLines = lines.filter((line) => line.componentType === 'EARNING');
  const classification = computeStatutoryWageBase(earningLines.map((line) => ({ isStatutoryWageBase: line.isStatutoryWageBase, monthlyAmount: line.monthlyAmount })), wageCap);

  return {
    id: structure.id,
    employeeId: structure.employee_id,
    effectiveFrom: structure.effective_from,
    effectiveTo: structure.effective_to,
    annualCtc: structure.annual_ctc,
    status: structure.status as 'ACTIVE' | 'SUPERSEDED',
    lines,
    monthlyStatutoryWageBase: classification.effectiveWageBase,
  };
}

export async function getActiveSalaryStructure(companyDb: Kysely<CompanyDatabase>, employeeId: string, asOfDate: string, wageCap: WageDefinitionCapPayload): Promise<SalaryStructureSummary | null> {
  const structure = await companyDb
    .selectFrom('salary_structure')
    .select('id')
    .where('employee_id', '=', employeeId)
    .where('effective_from', '<=', asOfDate)
    .where((eb) => eb.or([eb('effective_to', 'is', null), eb('effective_to', '>=', asOfDate)]))
    .orderBy('effective_from', 'desc')
    .executeTakeFirst();
  if (!structure) {
    return null;
  }
  return loadStructureWithLines(companyDb, structure.id, wageCap);
}

export async function listSalaryStructuresForEmployee(companyDb: Kysely<CompanyDatabase>, employeeId: string, wageCap: WageDefinitionCapPayload): Promise<SalaryStructureSummary[]> {
  const structures = await companyDb.selectFrom('salary_structure').select('id').where('employee_id', '=', employeeId).orderBy('effective_from', 'desc').execute();
  return Promise.all(structures.map((s) => loadStructureWithLines(companyDb, s.id, wageCap)));
}
