import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import {
  listAccountGroups as coreListAccountGroups,
  listLedgerAccounts,
  createLedgerAccount,
  createVoucher as coreCreateVoucher,
  listVouchers as coreListVouchers,
  cancelVoucher as coreCancelVoucher,
  computeTrialBalance,
  computeProfitAndLoss,
  computeBalanceSheet,
  computeFinancialYearLabel,
} from '@mhts/core-accounting';
import { session } from './session';
import type {
  AccountGroupSummary,
  BalanceSheetResult,
  CreateLedgerInput,
  CreateVoucherInput,
  LedgerAccountSummary,
  ProfitAndLossInput,
  ProfitAndLossResult,
  TrialBalanceResult,
  VoucherSummary,
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

export async function listAccountGroups(): Promise<AccountGroupSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.VIEW_REPORTS');
  return coreListAccountGroups(companyDb);
}

export async function listLedgers(): Promise<LedgerAccountSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.VIEW_REPORTS');
  return listLedgerAccounts(companyDb);
}

export async function createLedger(input: CreateLedgerInput): Promise<string> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.MANAGE_CHART_OF_ACCOUNTS');
  return createLedgerAccount(companyDb, {
    name: input.name,
    groupId: input.groupId,
    openingBalance: rupeesToPaise(input.openingBalanceRupees),
    openingBalanceSide: input.openingBalanceSide,
  });
}

async function financialYearStartMonth(systemDb: Kysely<SystemDatabase>, companyId: string): Promise<number> {
  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', companyId).executeTakeFirstOrThrow();
  return company.financial_year_start_month;
}

export async function createVoucher(systemDb: Kysely<SystemDatabase>, input: CreateVoucherInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('ACCOUNTING.CREATE_VOUCHER');

  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(input.voucherDate));

  return coreCreateVoucher(
    companyDb,
    {
      voucherType: input.voucherType,
      financialYear,
      voucherDate: input.voucherDate,
      narration: input.narration,
      lines: input.lines.map((line) => ({
        ledgerId: line.ledgerId,
        debitAmount: rupeesToPaise(line.debitRupees),
        creditAmount: rupeesToPaise(line.creditRupees),
        lineNarration: line.lineNarration,
        costCentreId: line.costCentreId,
        branchId: line.branchId,
        ...(line.foreignCurrency !== undefined && line.foreignAmountUnits !== undefined && line.exchangeRate !== undefined
          ? { foreignCurrency: line.foreignCurrency, foreignAmount: rupeesToPaise(line.foreignAmountUnits), exchangeRateMicros: Math.round(line.exchangeRate * 1_000_000) }
          : {}),
      })),
    },
    info.userId,
  );
}

export async function listVouchers(): Promise<VoucherSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.VIEW_REPORTS');
  const vouchers = await coreListVouchers(companyDb);
  return vouchers.map((voucher) => ({ ...voucher, totalAmount: paiseToRupees(voucher.totalAmount) }));
}

export async function cancelVoucher(systemDb: Kysely<SystemDatabase>, voucherId: string): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('ACCOUNTING.CREATE_VOUCHER');

  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const reversalDate = new Date().toISOString().slice(0, 10);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(reversalDate));

  return coreCancelVoucher(companyDb, voucherId, financialYear, reversalDate, info.userId);
}

export async function getTrialBalance(): Promise<TrialBalanceResult> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.VIEW_REPORTS');
  const trialBalance = await computeTrialBalance(companyDb);
  return {
    rows: trialBalance.rows.map((row) => ({
      ledgerId: row.ledgerId,
      ledgerName: row.ledgerName,
      groupName: row.groupName,
      nature: row.nature,
      debitBalance: paiseToRupees(row.debitBalance),
      creditBalance: paiseToRupees(row.creditBalance),
    })),
    totalDebit: paiseToRupees(trialBalance.totalDebit),
    totalCredit: paiseToRupees(trialBalance.totalCredit),
  };
}

export async function getProfitAndLoss(input: ProfitAndLossInput): Promise<ProfitAndLossResult> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.VIEW_REPORTS');
  const pnl = await computeProfitAndLoss(companyDb, { fromDate: input.fromDate, toDate: input.toDate });
  return {
    incomeRows: pnl.incomeRows.map((row) => ({ ...row, amount: paiseToRupees(row.amount) })),
    expenseRows: pnl.expenseRows.map((row) => ({ ...row, amount: paiseToRupees(row.amount) })),
    totalIncome: paiseToRupees(pnl.totalIncome),
    totalExpense: paiseToRupees(pnl.totalExpense),
    netProfit: paiseToRupees(pnl.netProfit),
  };
}

export async function getBalanceSheet(asOfDate: string): Promise<BalanceSheetResult> {
  const { companyDb } = requireSessionWithCompanyDb('ACCOUNTING.VIEW_REPORTS');
  const balanceSheet = await computeBalanceSheet(companyDb, asOfDate);
  return {
    asOfDate: balanceSheet.asOfDate,
    assetRows: balanceSheet.assetRows.map((row) => ({ ...row, amount: paiseToRupees(row.amount) })),
    liabilityRows: balanceSheet.liabilityRows.map((row) => ({ ...row, amount: paiseToRupees(row.amount) })),
    equityRows: balanceSheet.equityRows.map((row) => ({ ...row, amount: paiseToRupees(row.amount) })),
    currentEarnings: paiseToRupees(balanceSheet.currentEarnings),
    totalAssets: paiseToRupees(balanceSheet.totalAssets),
    totalLiabilitiesAndEquity: paiseToRupees(balanceSheet.totalLiabilitiesAndEquity),
  };
}
