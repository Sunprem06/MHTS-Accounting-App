import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import {
  createCostCentre as coreCreateCostCentre,
  listCostCentres as coreListCostCentres,
  updateCostCentre as coreUpdateCostCentre,
  computeCostCentreSummary,
  createBudget as coreCreateBudget,
  listBudgets as coreListBudgets,
  updateBudgetLine as coreUpdateBudgetLine,
  computeBudgetVsActual,
} from '@mhts/core-accounting';
import { session } from './session';
import type {
  BudgetSummary,
  BudgetVsActualResult,
  CostCentreReportInput,
  CostCentreSummary,
  CostCentreSummaryRow,
  CreateBudgetInput,
  CreateCostCentreInput,
  UpdateBudgetLineInput,
  UpdateCostCentreInput,
} from '../shared/ipc';

const PAISE_PER_RUPEE = 100;
const rupeesToPaise = (rupees: number): number => Math.round(rupees * PAISE_PER_RUPEE);
const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;

function requireSessionWithCompanyDb(requiredPermission: string) {
  const info = session.get();
  const companyDb = session.getCompanyDb();
  if (!info || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!info.permissions.includes(requiredPermission)) {
    throw new Error(`You do not have permission (${requiredPermission}) for this action`);
  }
  return { info, companyDb };
}

async function financialYearStartMonth(systemDb: Kysely<SystemDatabase>, companyId: string): Promise<number> {
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', companyId).executeTakeFirstOrThrow();
  return company.financial_year_start_month;
}

export async function createCostCentre(input: CreateCostCentreInput): Promise<string> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.MANAGE_COST_CENTRES');
  return coreCreateCostCentre(companyDb, input);
}

export async function listCostCentres(): Promise<CostCentreSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.VIEW_REPORTS');
  return coreListCostCentres(companyDb);
}

export async function updateCostCentre(input: UpdateCostCentreInput): Promise<void> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.MANAGE_COST_CENTRES');
  await coreUpdateCostCentre(companyDb, input.costCentreId, { name: input.name, code: input.code, isActive: input.isActive });
}

export async function getCostCentreReport(input: CostCentreReportInput): Promise<CostCentreSummaryRow[]> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.VIEW_REPORTS');
  const rows = await computeCostCentreSummary(companyDb, input);
  return rows.map((row) => ({ ...row, totalIncome: paiseToRupees(row.totalIncome), totalExpense: paiseToRupees(row.totalExpense), net: paiseToRupees(row.net) }));
}

export async function createBudget(input: CreateBudgetInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('ACCOUNTING.MANAGE_BUDGETS');
  return coreCreateBudget(companyDb, {
    name: input.name,
    financialYear: input.financialYear,
    ledgerId: input.ledgerId,
    costCentreId: input.costCentreId,
    lines: input.lines.map((line) => ({ periodMonth: line.periodMonth, amountPaise: rupeesToPaise(line.amountRupees) })),
    createdBy: info.userId,
  });
}

function toIpcBudget(budget: Awaited<ReturnType<typeof coreListBudgets>>[number]): BudgetSummary {
  return { ...budget, lines: budget.lines.map((line) => ({ periodMonth: line.periodMonth, amountRupees: paiseToRupees(line.amountPaise) })) };
}

export async function listBudgets(): Promise<BudgetSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.MANAGE_BUDGETS');
  const budgets = await coreListBudgets(companyDb);
  return budgets.map(toIpcBudget);
}

export async function updateBudgetLine(input: UpdateBudgetLineInput): Promise<void> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.MANAGE_BUDGETS');
  await coreUpdateBudgetLine(companyDb, input.budgetId, input.periodMonth, rupeesToPaise(input.amountRupees));
}

export async function getBudgetVsActual(systemDb: Kysely<SystemDatabase>, budgetId: string): Promise<BudgetVsActualResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('ACCOUNTING.MANAGE_BUDGETS');
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const result = await computeBudgetVsActual(companyDb, budgetId, startMonth);
  return {
    budget: toIpcBudget(result.budget),
    rows: result.rows.map((row) => ({
      periodMonth: row.periodMonth,
      budgetedAmount: paiseToRupees(row.budgetedPaise),
      actualAmount: paiseToRupees(row.actualPaise),
      varianceAmount: paiseToRupees(row.variancePaise),
      variancePercent: row.variancePercent,
    })),
  };
}
