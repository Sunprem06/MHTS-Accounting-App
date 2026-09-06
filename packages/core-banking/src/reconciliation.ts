import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { computeLedgerBalances } from '@mhts/core-accounting';
import type { BankReconciliationStatement, MatchedVia, ReconcilableLineRow } from './types';

/** better-sqlite3 cannot bind raw JS booleans as query parameters — same convention as core-sales-purchase's gstReturns.ts/receivablesPayables.ts. */
const IS_FALSE = 0 as unknown as boolean;

interface DateRange {
  fromDate?: string;
  toDate?: string;
}

/**
 * Every voucher_line posted against this bank ledger, regardless of voucher
 * type — a JOURNAL entry (bank charges, interest credited, etc.) moves the
 * bank ledger just as much as a Payment/Receipt does, and the exit
 * criterion ("bank rec matches ledger to the paisa") means ALL of the
 * ledger's movements must be reconcilable, not just the ones carrying a
 * payment instrument. A cancelled voucher's reversal is a real, independent
 * line and reconciles independently — no special-casing needed, matching
 * how computeLedgerBalances already treats it.
 */
export async function listReconcilableLines(companyDb: Kysely<CompanyDatabase>, bankLedgerId: string, range: DateRange = {}): Promise<ReconcilableLineRow[]> {
  let query = companyDb
    .selectFrom('voucher_line')
    .innerJoin('voucher', 'voucher.id', 'voucher_line.voucher_id')
    .leftJoin('bank_reconciliation', 'bank_reconciliation.voucher_line_id', 'voucher_line.id')
    .select([
      'voucher_line.id as voucherLineId',
      'voucher.id as voucherId',
      'voucher.voucher_type as voucherType',
      'voucher.voucher_number as voucherNumber',
      'voucher.voucher_date as voucherDate',
      'voucher.narration as narration',
      'voucher_line.debit_amount as debitAmount',
      'voucher_line.credit_amount as creditAmount',
      'bank_reconciliation.is_reconciled as isReconciled',
      'bank_reconciliation.reconciled_at as reconciledAt',
      'bank_reconciliation.bank_statement_date as bankStatementDate',
      'bank_reconciliation.matched_via as matchedVia',
    ])
    .where('voucher_line.ledger_id', '=', bankLedgerId)
    .orderBy('voucher.voucher_date', 'desc');

  if (range.fromDate) {
    query = query.where('voucher.voucher_date', '>=', range.fromDate);
  }
  if (range.toDate) {
    query = query.where('voucher.voucher_date', '<=', range.toDate);
  }

  const rows = await query.execute();
  return rows.map((row) => ({
    ...row,
    isReconciled: Boolean(row.isReconciled),
    matchedVia: (row.matchedVia as MatchedVia | null) ?? null,
  }));
}

/**
 * The composable half — usable inside a caller's own transaction, same
 * reasoning as core-accounting's createVoucherInTransaction. This is what
 * lets statementImport.ts persist an import batch AND reconcile its
 * confident auto-matches as one atomic unit.
 */
export async function upsertReconciliationInTransaction(
  trx: Transaction<CompanyDatabase>,
  voucherLineId: string,
  isReconciled: boolean,
  bankStatementDate: string | null,
  matchedVia: MatchedVia | null,
  actorUserId: string | null,
): Promise<void> {
  const line = await trx.selectFrom('voucher_line').select('id').where('id', '=', voucherLineId).executeTakeFirst();
  if (!line) {
    throw new Error('Voucher line not found');
  }

  const existing = await trx.selectFrom('bank_reconciliation').selectAll().where('voucher_line_id', '=', voucherLineId).executeTakeFirst();
  const now = new Date().toISOString();

  if (existing) {
    await trx
      .updateTable('bank_reconciliation')
      .set({
        is_reconciled: isReconciled ? 1 : 0,
        reconciled_at: isReconciled ? now : null,
        reconciled_by: isReconciled ? actorUserId : null,
        bank_statement_date: isReconciled ? bankStatementDate : null,
        matched_via: isReconciled ? matchedVia : null,
      })
      .where('voucher_line_id', '=', voucherLineId)
      .execute();
  } else {
    await trx
      .insertInto('bank_reconciliation')
      .values({
        id: randomUUID(),
        voucher_line_id: voucherLineId,
        is_reconciled: isReconciled ? 1 : 0,
        reconciled_at: isReconciled ? now : null,
        reconciled_by: isReconciled ? actorUserId : null,
        bank_statement_date: isReconciled ? bankStatementDate : null,
        matched_via: isReconciled ? matchedVia : null,
      })
      .execute();
  }

  await writeAuditLog(trx, {
    actorUserId,
    action: 'UPDATE',
    entityType: 'BankReconciliation',
    entityId: voucherLineId,
    beforeData: existing ? { isReconciled: Boolean(existing.is_reconciled) } : { isReconciled: false },
    afterData: { isReconciled, bankStatementDate, matchedVia },
  });
}

/** Pure metadata write — never touches voucher/voucher_line. Marking a line reconciled does not post anything. Opens its own transaction — the standalone entry point for manual tick-off. */
export async function markLineReconciled(companyDb: Kysely<CompanyDatabase>, voucherLineId: string, bankStatementDate: string, actorUserId: string | null, matchedVia: MatchedVia = 'MANUAL'): Promise<void> {
  await companyDb.transaction().execute((trx) => upsertReconciliationInTransaction(trx, voucherLineId, true, bankStatementDate, matchedVia, actorUserId));
}

export async function markLineUnreconciled(companyDb: Kysely<CompanyDatabase>, voucherLineId: string, actorUserId: string | null): Promise<void> {
  await companyDb.transaction().execute((trx) => upsertReconciliationInTransaction(trx, voucherLineId, false, null, null, actorUserId));
}

/**
 * Standard Indian-SME bank reconciliation layout: Book Balance (from the
 * same computeLedgerBalances primitive Trial Balance/P&L/Balance Sheet
 * already trust) adjusted for items the bank hasn't processed yet.
 *
 * On this ledger, credit_amount > 0 = money that left the bank (a payment
 * issued) and debit_amount > 0 = money that entered it (a receipt/deposit)
 * — verified against the Payment/Receipt/Contra voucher screens' own
 * debit/credit construction, not assumed.
 */
export async function computeBankReconciliationStatement(companyDb: Kysely<CompanyDatabase>, bankLedgerId: string, asOfDate: string): Promise<BankReconciliationStatement> {
  const balances = await computeLedgerBalances(companyDb, { natures: ['ASSET'], toDate: asOfDate });
  const bookBalance = balances.find((row) => row.ledgerId === bankLedgerId)?.netSigned ?? 0;

  const unreconciledRows = await companyDb
    .selectFrom('voucher_line')
    .innerJoin('voucher', 'voucher.id', 'voucher_line.voucher_id')
    .leftJoin('bank_reconciliation', 'bank_reconciliation.voucher_line_id', 'voucher_line.id')
    .select(['voucher_line.debit_amount as debitAmount', 'voucher_line.credit_amount as creditAmount'])
    .where('voucher_line.ledger_id', '=', bankLedgerId)
    .where('voucher.voucher_date', '<=', asOfDate)
    .where(({ eb, or }) => or([eb('bank_reconciliation.is_reconciled', 'is', null), eb('bank_reconciliation.is_reconciled', '=', IS_FALSE)]))
    .execute();

  let unclearedPayments = 0;
  let unclearedReceipts = 0;
  for (const row of unreconciledRows) {
    unclearedPayments += row.creditAmount;
    unclearedReceipts += row.debitAmount;
  }

  return {
    bankLedgerId,
    asOfDate,
    bookBalance,
    unclearedPayments,
    unclearedReceipts,
    calculatedBankBalance: bookBalance + unclearedPayments - unclearedReceipts,
    unclearedLineCount: unreconciledRows.length,
  };
}
