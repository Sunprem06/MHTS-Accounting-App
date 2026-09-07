import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import {
  createBranch as coreCreateBranch,
  listBranches as coreListBranches,
  updateBranch as coreUpdateBranch,
  recordInterBranchTransfer as coreRecordInterBranchTransfer,
  computeBranchProfitAndLoss,
  computeBranchBalanceSheet,
  computeFinancialYearLabel,
} from '@mhts/core-accounting';
import { session } from './session';
import type {
  BranchBalanceSheetResult,
  BranchProfitAndLossRow,
  BranchReportInput,
  BranchSummary,
  CreateBranchInput,
  RecordInterBranchTransferInput,
  UpdateBranchInput,
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

export async function createBranch(input: CreateBranchInput): Promise<string> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.MANAGE_BRANCHES');
  return coreCreateBranch(companyDb, input);
}

export async function listBranches(): Promise<BranchSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.VIEW_REPORTS');
  return coreListBranches(companyDb);
}

export async function updateBranch(input: UpdateBranchInput): Promise<void> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.MANAGE_BRANCHES');
  await coreUpdateBranch(companyDb, input.branchId, { name: input.name, code: input.code, address: input.address, isActive: input.isActive });
}

async function financialYearStartMonth(systemDb: Kysely<SystemDatabase>, companyId: string): Promise<number> {
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', companyId).executeTakeFirstOrThrow();
  return company.financial_year_start_month;
}

export async function recordInterBranchTransfer(systemDb: Kysely<SystemDatabase>, input: RecordInterBranchTransferInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('ACCOUNTING.MANAGE_BRANCHES');
  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(input.transferDate));
  return coreRecordInterBranchTransfer(
    companyDb,
    {
      fromBranchId: input.fromBranchId,
      toBranchId: input.toBranchId,
      fromLedgerId: input.fromLedgerId,
      toLedgerId: input.toLedgerId,
      amount: rupeesToPaise(input.amountRupees),
      transferDate: input.transferDate,
      financialYear,
      narration: input.narration,
    },
    info.userId,
  );
}

export async function getBranchProfitAndLoss(input: BranchReportInput): Promise<BranchProfitAndLossRow[]> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.VIEW_REPORTS');
  const rows = await computeBranchProfitAndLoss(companyDb, input);
  return rows.map((row) => ({ ...row, totalIncome: paiseToRupees(row.totalIncome), totalExpense: paiseToRupees(row.totalExpense), net: paiseToRupees(row.net) }));
}

export async function getBranchBalanceSheet(asOfDate: string): Promise<BranchBalanceSheetResult> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.VIEW_REPORTS');
  const result = await computeBranchBalanceSheet(companyDb, asOfDate);
  return {
    asOfDate: result.asOfDate,
    rows: result.rows.map((row) => ({ ...row, amount: paiseToRupees(row.amount) })),
    branchSummaries: result.branchSummaries.map((row) => ({
      branchId: row.branchId,
      branchName: row.branchName,
      totalAssets: paiseToRupees(row.totalAssets),
      totalLiabilitiesAndEquity: paiseToRupees(row.totalLiabilitiesAndEquity),
      currentEarnings: paiseToRupees(row.currentEarnings),
    })),
    consolidatedTotalAssets: paiseToRupees(result.consolidatedTotalAssets),
    consolidatedTotalLiabilitiesAndEquity: paiseToRupees(result.consolidatedTotalLiabilitiesAndEquity),
  };
}
