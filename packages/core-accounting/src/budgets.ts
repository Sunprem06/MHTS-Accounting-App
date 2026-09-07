import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export interface BudgetLineInput {
  /** 1-12, calendar month number. */
  periodMonth: number;
  /** Paise. */
  amountPaise: number;
}

export interface CreateBudgetInput {
  name: string;
  financialYear: string;
  /** At least one of ledgerId/costCentreId is required. */
  ledgerId?: string;
  costCentreId?: string;
  /** Exactly 12 lines, one per calendar month, no duplicates. */
  lines: BudgetLineInput[];
  createdBy: string | null;
}

/**
 * Splits an annual total evenly across 12 calendar months, paise-exact —
 * any remainder from integer division goes to the first month rather than
 * being silently dropped (same "absorb the remainder, don't lose it"
 * principle stock-layer costing already applies to FIFO consumption).
 * A pure convenience for callers building a flat monthly budget; a caller
 * with a genuinely seasonal budget builds BudgetLineInput[] directly instead.
 */
export function splitAnnualBudgetEvenly(totalPaise: number): BudgetLineInput[] {
  if (!Number.isInteger(totalPaise) || totalPaise < 0) {
    throw new Error('Annual budget total must be a non-negative whole number of paise');
  }
  const base = Math.floor(totalPaise / 12);
  const remainder = totalPaise - base * 12;
  return Array.from({ length: 12 }, (_, i) => ({
    periodMonth: i + 1,
    amountPaise: base + (i === 0 ? remainder : 0),
  }));
}

export async function createBudget(companyDb: Kysely<CompanyDatabase>, input: CreateBudgetInput): Promise<string> {
  if (!input.name.trim()) {
    throw new Error('Budget name is required');
  }
  if (!input.ledgerId && !input.costCentreId) {
    throw new Error('A budget must be scoped to a ledger, a cost centre, or both');
  }
  if (input.lines.length !== 12) {
    throw new Error('A budget needs exactly 12 monthly lines');
  }
  const months = new Set(input.lines.map((line) => line.periodMonth));
  if (months.size !== 12 || ![...months].every((m) => m >= 1 && m <= 12)) {
    throw new Error('Budget lines must cover months 1-12 exactly once each');
  }
  for (const line of input.lines) {
    if (!Number.isInteger(line.amountPaise) || line.amountPaise < 0) {
      throw new Error('Budget line amounts must be whole, non-negative paise');
    }
  }
  if (input.ledgerId) {
    const ledger = await companyDb.selectFrom('ledger_account').select('id').where('id', '=', input.ledgerId).executeTakeFirst();
    if (!ledger) {
      throw new Error('Ledger account not found');
    }
  }
  if (input.costCentreId) {
    const costCentre = await companyDb.selectFrom('cost_centre').select('id').where('id', '=', input.costCentreId).executeTakeFirst();
    if (!costCentre) {
      throw new Error('Cost centre not found');
    }
  }

  const budgetId = randomUUID();
  await companyDb
    .insertInto('budget')
    .values({
      id: budgetId,
      name: input.name.trim(),
      financial_year: input.financialYear,
      ledger_id: input.ledgerId ?? null,
      cost_centre_id: input.costCentreId ?? null,
      created_by: input.createdBy,
    })
    .execute();

  for (const line of input.lines) {
    await companyDb
      .insertInto('budget_line')
      .values({ id: randomUUID(), budget_id: budgetId, period_month: line.periodMonth, amount_paise: line.amountPaise })
      .execute();
  }

  return budgetId;
}

export interface BudgetSummary {
  id: string;
  name: string;
  financialYear: string;
  ledgerId: string | null;
  ledgerName: string | null;
  costCentreId: string | null;
  costCentreName: string | null;
  lines: BudgetLineInput[];
}

export async function listBudgets(companyDb: Kysely<CompanyDatabase>): Promise<BudgetSummary[]> {
  const budgets = await companyDb
    .selectFrom('budget')
    .leftJoin('ledger_account', 'ledger_account.id', 'budget.ledger_id')
    .leftJoin('cost_centre', 'cost_centre.id', 'budget.cost_centre_id')
    .select([
      'budget.id as id',
      'budget.name as name',
      'budget.financial_year as financialYear',
      'budget.ledger_id as ledgerId',
      'ledger_account.name as ledgerName',
      'budget.cost_centre_id as costCentreId',
      'cost_centre.name as costCentreName',
    ])
    .orderBy('budget.financial_year', 'desc')
    .orderBy('budget.name')
    .execute();

  const lines = await companyDb.selectFrom('budget_line').selectAll().execute();
  const linesByBudget = new Map<string, BudgetLineInput[]>();
  for (const line of lines) {
    const list = linesByBudget.get(line.budget_id) ?? [];
    list.push({ periodMonth: line.period_month, amountPaise: line.amount_paise });
    linesByBudget.set(line.budget_id, list);
  }

  return budgets.map((b) => ({
    ...b,
    lines: (linesByBudget.get(b.id) ?? []).sort((a, c) => a.periodMonth - c.periodMonth),
  }));
}

export async function updateBudgetLine(companyDb: Kysely<CompanyDatabase>, budgetId: string, periodMonth: number, amountPaise: number): Promise<void> {
  if (!Number.isInteger(amountPaise) || amountPaise < 0) {
    throw new Error('Budget line amount must be a whole, non-negative paise value');
  }
  const line = await companyDb
    .selectFrom('budget_line')
    .select('id')
    .where('budget_id', '=', budgetId)
    .where('period_month', '=', periodMonth)
    .executeTakeFirst();
  if (!line) {
    throw new Error('Budget line not found');
  }
  await companyDb.updateTable('budget_line').set({ amount_paise: amountPaise }).where('id', '=', line.id).execute();
}
