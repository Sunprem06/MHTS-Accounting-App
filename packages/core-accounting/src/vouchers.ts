import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { VOUCHER_TYPES } from './types';
import type { CreateVoucherInput, VoucherLineInput, VoucherSummary, VoucherType } from './types';

function validateLines(lines: VoucherLineInput[]): { totalDebit: number; totalCredit: number } {
  if (lines.length < 2) {
    throw new Error('A voucher needs at least two lines');
  }

  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    const hasDebit = line.debitAmount > 0;
    const hasCredit = line.creditAmount > 0;
    if (hasDebit === hasCredit) {
      throw new Error('Each voucher line must have exactly one of a debit or a credit amount');
    }
    if (!Number.isInteger(line.debitAmount) || !Number.isInteger(line.creditAmount)) {
      throw new Error('Amounts must be whole paise, not fractional');
    }
    if (line.debitAmount < 0 || line.creditAmount < 0) {
      throw new Error('Amounts cannot be negative');
    }
    totalDebit += line.debitAmount;
    totalCredit += line.creditAmount;
  }

  if (totalDebit === 0) {
    throw new Error('A voucher cannot be for a zero amount');
  }
  if (totalDebit !== totalCredit) {
    throw new Error(`Unbalanced voucher: total debit (${totalDebit}) does not equal total credit (${totalCredit})`);
  }
  return { totalDebit, totalCredit };
}

interface InsertVoucherOptions {
  id: string;
  voucherType: VoucherType;
  financialYear: string;
  voucherDate: string;
  narration: string | null;
  lines: VoucherLineInput[];
  actorUserId: string | null;
  reversesVoucherId: string | null;
}

/** Shared by createVoucher and cancelVoucher's auto-generated reversal — sequential numbering, insert, and the audit entry, all inside the caller's transaction. */
async function insertVoucherWithLines(trx: Transaction<CompanyDatabase>, options: InsertVoucherOptions): Promise<number> {
  const maxNumberRow = await trx
    .selectFrom('voucher')
    .select(({ fn }) => fn.max('voucher_number').as('maxNumber'))
    .where('voucher_type', '=', options.voucherType)
    .where('financial_year', '=', options.financialYear)
    .executeTakeFirst();
  const voucherNumber = (maxNumberRow?.maxNumber ?? 0) + 1;

  await trx
    .insertInto('voucher')
    .values({
      id: options.id,
      voucher_type: options.voucherType,
      financial_year: options.financialYear,
      voucher_number: voucherNumber,
      voucher_date: options.voucherDate,
      narration: options.narration,
      created_by: options.actorUserId,
      cancelled_at: null,
      cancelled_by_voucher_id: null,
      reverses_voucher_id: options.reversesVoucherId,
    })
    .execute();

  for (const line of options.lines) {
    await trx
      .insertInto('voucher_line')
      .values({
        id: randomUUID(),
        voucher_id: options.id,
        ledger_id: line.ledgerId,
        debit_amount: line.debitAmount,
        credit_amount: line.creditAmount,
        line_narration: line.lineNarration ?? null,
      })
      .execute();
  }

  await writeAuditLog(trx, {
    actorUserId: options.actorUserId,
    action: 'CREATE',
    entityType: 'Voucher',
    entityId: options.id,
    afterData: { voucherType: options.voucherType, financialYear: options.financialYear, voucherNumber, voucherDate: options.voucherDate, narration: options.narration, lines: options.lines, reversesVoucherId: options.reversesVoucherId },
  });

  return voucherNumber;
}

/**
 * The validating half of createVoucher, usable by a caller that already has
 * its own open transaction (e.g. @mhts/core-sales-purchase posting an
 * invoice's voucher and inserting its own invoice/line rows as ONE atomic
 * unit — CLAUDE.md Rule #4 applies just as much to "invoice touching ledger
 * + receivable" as it does to a plain voucher). Enforces that debits equal
 * credits — the literal implementation of "unbalanced entries impossible" —
 * and writes the audit log entry inside the same transaction, so a voucher
 * can never exist without being audited.
 */
export async function createVoucherInTransaction(
  trx: Transaction<CompanyDatabase>,
  input: CreateVoucherInput,
  actorUserId: string | null,
): Promise<{ voucherId: string; voucherNumber: number }> {
  if (!VOUCHER_TYPES.includes(input.voucherType)) {
    throw new Error(`Unknown voucher type: ${input.voucherType}`);
  }
  validateLines(input.lines);

  const ledgerIds = [...new Set(input.lines.map((line) => line.ledgerId))];
  const existingLedgers = await trx.selectFrom('ledger_account').select('id').where('id', 'in', ledgerIds).execute();
  if (existingLedgers.length !== ledgerIds.length) {
    throw new Error('One or more ledger accounts do not exist');
  }

  const voucherId = randomUUID();
  const voucherNumber = await insertVoucherWithLines(trx, {
    id: voucherId,
    voucherType: input.voucherType,
    financialYear: input.financialYear,
    voucherDate: input.voucherDate,
    narration: input.narration ?? null,
    lines: input.lines,
    actorUserId,
    reversesVoucherId: null,
  });

  return { voucherId, voucherNumber };
}

/**
 * Creates a voucher and its lines atomically (CLAUDE.md Rule #4) in a
 * transaction of its own — the standalone entry point used by the generic
 * Journal/Payment/Receipt/Contra screens, which have nothing else to commit
 * alongside the voucher itself.
 */
export async function createVoucher(
  companyDb: Kysely<CompanyDatabase>,
  input: CreateVoucherInput,
  actorUserId: string | null,
): Promise<string> {
  const { voucherId } = await companyDb.transaction().execute((trx) => createVoucherInTransaction(trx, input, actorUserId));
  return voucherId;
}

export async function listVouchers(companyDb: Kysely<CompanyDatabase>): Promise<VoucherSummary[]> {
  const rows = await companyDb
    .selectFrom('voucher')
    .leftJoin('voucher_line', 'voucher_line.voucher_id', 'voucher.id')
    .select(({ fn }) => [
      'voucher.id as id',
      'voucher.voucher_type as voucherType',
      'voucher.voucher_number as voucherNumber',
      'voucher.financial_year as financialYear',
      'voucher.voucher_date as voucherDate',
      'voucher.narration as narration',
      'voucher.cancelled_at as cancelledAt',
      'voucher.cancelled_by_voucher_id as cancelledByVoucherId',
      'voucher.reverses_voucher_id as reversesVoucherId',
      fn.sum<number>('voucher_line.debit_amount').as('totalAmount'),
    ])
    .groupBy('voucher.id')
    .orderBy('voucher.voucher_date', 'desc')
    .orderBy('voucher.created_at', 'desc')
    .execute();

  return rows.map((row) => ({ ...row, voucherType: row.voucherType as VoucherType, totalAmount: Number(row.totalAmount) }));
}

/**
 * Cancels a voucher by posting an automatic reversal (mirror-image lines),
 * never by editing or deleting the original — consistent with the
 * append-only audit philosophy already established for audit_log. The
 * original is marked cancelled and linked to its reversal; the reversal is
 * marked as reversing the original. Both changes commit in one transaction.
 */
export async function cancelVoucher(
  companyDb: Kysely<CompanyDatabase>,
  voucherId: string,
  reversalFinancialYear: string,
  reversalDate: string,
  actorUserId: string | null,
): Promise<string> {
  const original = await companyDb.selectFrom('voucher').selectAll().where('id', '=', voucherId).executeTakeFirst();
  if (!original) {
    throw new Error('Voucher not found');
  }
  if (original.cancelled_at) {
    throw new Error('This voucher has already been cancelled');
  }
  if (original.reverses_voucher_id) {
    throw new Error('A reversal voucher cannot itself be cancelled');
  }

  const originalLines = await companyDb.selectFrom('voucher_line').selectAll().where('voucher_id', '=', voucherId).execute();
  const reversalLines: VoucherLineInput[] = originalLines.map((line) => ({
    ledgerId: line.ledger_id,
    debitAmount: line.credit_amount,
    creditAmount: line.debit_amount,
    lineNarration: line.line_narration ?? undefined,
  }));

  const reversalId = randomUUID();
  await companyDb.transaction().execute(async (trx) => {
    await insertVoucherWithLines(trx, {
      id: reversalId,
      voucherType: original.voucher_type as VoucherType,
      financialYear: reversalFinancialYear,
      voucherDate: reversalDate,
      narration: `Reversal of ${original.voucher_type} #${original.voucher_number}${original.narration ? ` (${original.narration})` : ''}`,
      lines: reversalLines,
      actorUserId,
      reversesVoucherId: voucherId,
    });

    await trx
      .updateTable('voucher')
      .set({ cancelled_at: reversalDate, cancelled_by_voucher_id: reversalId })
      .where('id', '=', voucherId)
      .execute();

    await writeAuditLog(trx, {
      actorUserId,
      action: 'UPDATE',
      entityType: 'Voucher',
      entityId: voucherId,
      beforeData: { cancelledAt: null },
      afterData: { cancelledAt: reversalDate, cancelledByVoucherId: reversalId },
    });
  });

  return reversalId;
}
