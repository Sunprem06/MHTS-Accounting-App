import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { CALCULATION_TYPES, COMPONENT_TYPES } from './types';
import type { ComponentType, SalaryComponentDefinitionInput, SalaryComponentDefinitionSummary } from './types';

export async function createSalaryComponentDefinition(companyDb: Kysely<CompanyDatabase>, input: SalaryComponentDefinitionInput): Promise<string> {
  if (!input.name.trim()) {
    throw new Error('Component name is required');
  }
  if (!COMPONENT_TYPES.includes(input.componentType)) {
    throw new Error(`Unknown component type: ${input.componentType}`);
  }
  if (!CALCULATION_TYPES.includes(input.calculationType)) {
    throw new Error(`Unknown calculation type: ${input.calculationType}`);
  }
  if (input.calculationType === 'FLAT') {
    if (input.flatAmountPaise === undefined || input.flatAmountPaise < 0) {
      throw new Error('A flat component needs a non-negative flat amount');
    }
  } else if (input.percent === undefined || input.percent < 0) {
    throw new Error('A percentage-based component needs a non-negative percent');
  }

  const id = randomUUID();
  await companyDb
    .insertInto('salary_component_definition')
    .values({
      id,
      name: input.name.trim(),
      component_type: input.componentType,
      calculation_type: input.calculationType,
      flat_amount_paise: input.calculationType === 'FLAT' ? input.flatAmountPaise! : null,
      percent_basis_points: input.calculationType !== 'FLAT' ? Math.round(input.percent! * 100) : null,
      is_statutory_wage_base: (input.isStatutoryWageBase ? 1 : 0) as unknown as boolean,
      display_order: input.displayOrder ?? 0,
      expense_ledger_id: input.expenseLedgerId ?? null,
      is_active: 1 as unknown as boolean,
    })
    .execute();
  return id;
}

export async function listSalaryComponentDefinitions(companyDb: Kysely<CompanyDatabase>): Promise<SalaryComponentDefinitionSummary[]> {
  const rows = await companyDb.selectFrom('salary_component_definition').selectAll().orderBy('display_order').orderBy('name').execute();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    componentType: row.component_type as ComponentType,
    calculationType: row.calculation_type as SalaryComponentDefinitionSummary['calculationType'],
    flatAmountPaise: row.flat_amount_paise,
    percentBasisPoints: row.percent_basis_points,
    isStatutoryWageBase: Boolean(row.is_statutory_wage_base),
    displayOrder: row.display_order,
    expenseLedgerId: row.expense_ledger_id,
    isActive: Boolean(row.is_active),
  }));
}
