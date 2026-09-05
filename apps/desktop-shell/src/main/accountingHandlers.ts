import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import {
  listAccountGroups as coreListAccountGroups,
  listLedgerAccounts,
  createLedgerAccount,
  createVoucher as coreCreateVoucher,
  computeTrialBalance,
  computeFinancialYearLabel,
} from '@mhts/core-accounting';
import { session } from './session';
import type {
  AccountGroupSummary,
  CreateLedgerInput,
  CreateVoucherInput,
  LedgerAccountSummary,
  TrialBalanceResult,
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

export async function createVoucher(systemDb: Kysely<SystemDatabase>, input: CreateVoucherInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('ACCOUNTING.CREATE_VOUCHER');

  const company = await systemDb.selectFrom('company').select('financial_year_start_month').where('id', '=', info.companyId).executeTakeFirstOrThrow();
  const financialYear = computeFinancialYearLabel(company.financial_year_start_month, new Date(input.voucherDate));

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
      })),
    },
    info.userId,
  );
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
