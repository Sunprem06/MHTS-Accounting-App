import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { BrowserWindow, dialog } from 'electron';
import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import {
  createBankAccount as coreCreateBankAccount,
  listBankAccounts as coreListBankAccounts,
  recordVoucherWithInstrument,
  updateInstrumentStatus as coreUpdateInstrumentStatus,
  listPaymentInstruments as coreListPaymentInstruments,
  listReconcilableLines as coreListReconcilableLines,
  markLineReconciled as coreMarkLineReconciled,
  markLineUnreconciled as coreMarkLineUnreconciled,
  computeBankReconciliationStatement,
  parseBankStatementCsv,
  mapStatementRows,
  importStatementLines,
  listStatementImports as coreListStatementImports,
  getStatementImportLines as coreGetStatementImportLines,
  resolveStatementLineMatch as coreResolveStatementLineMatch,
} from '@mhts/core-banking';
import { computeFinancialYearLabel } from '@mhts/core-accounting';
import { session } from './session';
import type {
  BankAccountSummary,
  BankReconciliationStatement,
  CreateBankAccountInput,
  GetReconciliationStatementInput,
  ImportStatementFileInput,
  ImportStatementResult,
  InstrumentStatus,
  ListReconcilableLinesInput,
  MarkReconciledInput,
  PaymentInstrumentSummary,
  ReconcilableLineRow,
  RecordBankVoucherInput,
  ResolveStatementLineMatchInput,
  StatementImportSummary,
  StatementLineSummary,
  StatementPreview,
  UpdateInstrumentStatusInput,
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

export async function listBankAccounts(): Promise<BankAccountSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('BANKING.VIEW_REPORTS');
  const accounts = await coreListBankAccounts(companyDb);
  return accounts.map((account) => ({ ...account, currentBalance: paiseToRupees(account.currentBalance) }));
}

export async function createBankAccount(input: CreateBankAccountInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('BANKING.MANAGE_BANK_ACCOUNTS');
  return coreCreateBankAccount(
    companyDb,
    {
      name: input.name,
      accountNumber: input.accountNumber,
      ifscCode: input.ifscCode,
      bankName: input.bankName,
      branchName: input.branchName,
      accountType: input.accountType,
      openingBalance: input.openingBalanceRupees !== undefined ? rupeesToPaise(input.openingBalanceRupees) : undefined,
      openingBalanceSide: input.openingBalanceSide,
    },
    info.userId,
  );
}

/**
 * Single entry point for Payment/Receipt/Contra screens, whether or not a
 * bank ledger/instrument is involved (recordVoucherWithInstrument degrades
 * to a plain voucher post when instrument is null). Posting itself is
 * gated by the same ACCOUNTING.CREATE_VOUCHER permission as any other
 * voucher — attaching instrument details additionally requires
 * BANKING.RECORD_PAYMENT_INSTRUMENT, only checked when one is provided.
 */
export async function recordBankVoucher(systemDb: Kysely<SystemDatabase>, input: RecordBankVoucherInput): Promise<string> {
  const { info, companyDb } = requireSessionWithCompanyDb('ACCOUNTING.CREATE_VOUCHER');
  if (input.instrument && !info.permissions.includes('BANKING.RECORD_PAYMENT_INSTRUMENT')) {
    throw new Error('You do not have permission (BANKING.RECORD_PAYMENT_INSTRUMENT) for this action');
  }

  const startMonth = await financialYearStartMonth(systemDb, info.companyId);
  const financialYear = computeFinancialYearLabel(startMonth, new Date(input.voucherDate));

  return recordVoucherWithInstrument(
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
    input.instrument,
    info.userId,
  );
}

export async function updateInstrumentStatus(input: UpdateInstrumentStatusInput): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('BANKING.RECORD_PAYMENT_INSTRUMENT');
  await coreUpdateInstrumentStatus(companyDb, input.voucherId, input.status, input.statusDate, info.userId);
}

export async function listPaymentInstruments(status?: InstrumentStatus): Promise<PaymentInstrumentSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('BANKING.VIEW_REPORTS');
  return coreListPaymentInstruments(companyDb, status ? { status } : undefined);
}

export async function listReconcilableLines(input: ListReconcilableLinesInput): Promise<ReconcilableLineRow[]> {
  const { companyDb } = requireSessionWithCompanyDb('BANKING.VIEW_REPORTS');
  const rows = await coreListReconcilableLines(companyDb, input.bankLedgerId, { fromDate: input.fromDate, toDate: input.toDate });
  return rows.map((row) => ({ ...row, debitAmount: paiseToRupees(row.debitAmount), creditAmount: paiseToRupees(row.creditAmount) }));
}

export async function markLineReconciled(input: MarkReconciledInput): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('BANKING.RECONCILE');
  await coreMarkLineReconciled(companyDb, input.voucherLineId, input.bankStatementDate, info.userId, 'MANUAL');
}

export async function markLineUnreconciled(voucherLineId: string): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('BANKING.RECONCILE');
  await coreMarkLineUnreconciled(companyDb, voucherLineId, info.userId);
}

export async function getReconciliationStatement(input: GetReconciliationStatementInput): Promise<BankReconciliationStatement> {
  const { companyDb } = requireSessionWithCompanyDb('BANKING.VIEW_REPORTS');
  const statement = await computeBankReconciliationStatement(companyDb, input.bankLedgerId, input.asOfDate);
  return {
    ...statement,
    bookBalance: paiseToRupees(statement.bookBalance),
    unclearedPayments: paiseToRupees(statement.unclearedPayments),
    unclearedReceipts: paiseToRupees(statement.unclearedReceipts),
    calculatedBankBalance: paiseToRupees(statement.calculatedBankBalance),
  };
}

/** Native open-file dialog — the user's own click IS the consent for which file gets read, same reasoning as backupCompany's save dialog. */
export async function pickStatementFile(): Promise<{ fileName: string; csvText: string } | null> {
  requireSessionWithCompanyDb('BANKING.IMPORT_STATEMENT');

  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, { properties: ['openFile'], filters: [{ name: 'CSV', extensions: ['csv'] }] })
    : await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'CSV', extensions: ['csv'] }] });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const csvText = readFileSync(filePath, 'utf-8');
  return { fileName: basename(filePath), csvText };
}

const PREVIEW_ROW_COUNT = 10;

export async function previewStatementCsv(csvText: string): Promise<StatementPreview> {
  requireSessionWithCompanyDb('BANKING.IMPORT_STATEMENT');
  const { headers, rows } = parseBankStatementCsv(csvText);
  return { headers, previewRows: rows.slice(0, PREVIEW_ROW_COUNT) };
}

function toIpcStatementLine(line: Awaited<ReturnType<typeof coreGetStatementImportLines>>[number]): StatementLineSummary {
  return {
    id: line.id,
    importId: line.importId,
    statementDate: line.statementDate,
    description: line.description,
    amount: paiseToRupees(line.amountPaise),
    direction: line.direction,
    matchStatus: line.matchStatus,
    matchedVoucherLineId: line.matchedVoucherLineId,
    isLikelyDuplicate: line.isLikelyDuplicate,
    candidateVoucherLineIds: line.candidateVoucherLineIds,
  };
}

export async function importStatementFile(input: ImportStatementFileInput): Promise<ImportStatementResult> {
  const { info, companyDb } = requireSessionWithCompanyDb('BANKING.IMPORT_STATEMENT');
  const { rows } = parseBankStatementCsv(input.csvText);
  const parsedLines = mapStatementRows(rows, input.mapping);
  const result = await importStatementLines(companyDb, input.bankAccountId, parsedLines, input.fileName, info.userId);
  return {
    import: result.import,
    lines: result.lines.map(toIpcStatementLine),
  };
}

export async function listStatementImports(bankAccountId: string): Promise<StatementImportSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('BANKING.VIEW_REPORTS');
  return coreListStatementImports(companyDb, bankAccountId);
}

export async function getStatementImportLines(importId: string): Promise<StatementLineSummary[]> {
  const { companyDb } = requireSessionWithCompanyDb('BANKING.VIEW_REPORTS');
  const lines = await coreGetStatementImportLines(companyDb, importId);
  return lines.map(toIpcStatementLine);
}

export async function resolveStatementLineMatch(input: ResolveStatementLineMatchInput): Promise<void> {
  const { info, companyDb } = requireSessionWithCompanyDb('BANKING.IMPORT_STATEMENT');
  await coreResolveStatementLineMatch(companyDb, input.statementLineId, input.voucherLineId, info.userId);
}
