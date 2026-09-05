import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { VOUCHER_TYPES } from './types';
import type { CreateVoucherInput } from './types';

function validate(input: CreateVoucherInput): void {
  if (!VOUCHER_TYPES.includes(input.voucherType)) {
    throw new Error(`Unknown voucher type: ${input.voucherType}`);
  }
  if (input.lines.length < 2) {
    throw new Error('A voucher needs at least two lines');
  }

  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of input.lines) {
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
}

/**
 * Creates a voucher and its lines atomically (CLAUDE.md Rule #4), enforcing
 * that debits equal credits — this is the literal implementation of "unbalanced
 * entries impossible." Also writes the append-only audit log entry as part of
 * the SAME transaction, so a voucher can never exist without being audited.
 */
export async function createVoucher(
  companyDb: Kysely<CompanyDatabase>,
  input: CreateVoucherInput,
  actorUserId: string | null,
): Promise<string> {
  validate(input);

  const ledgerIds = [...new Set(input.lines.map((line) => line.ledgerId))];
  const existingLedgers = await companyDb.selectFrom('ledger_account').select('id').where('id', 'in', ledgerIds).execute();
  if (existingLedgers.length !== ledgerIds.length) {
    throw new Error('One or more ledger accounts do not exist');
  }

  const voucherId = randomUUID();

  await companyDb.transaction().execute(async (trx) => {
    const maxNumberRow = await trx
      .selectFrom('voucher')
      .select(({ fn }) => fn.max('voucher_number').as('maxNumber'))
      .where('voucher_type', '=', input.voucherType)
      .where('financial_year', '=', input.financialYear)
      .executeTakeFirst();
    const voucherNumber = (maxNumberRow?.maxNumber ?? 0) + 1;

    await trx
      .insertInto('voucher')
      .values({
        id: voucherId,
        voucher_type: input.voucherType,
        financial_year: input.financialYear,
        voucher_number: voucherNumber,
        voucher_date: input.voucherDate,
        narration: input.narration ?? null,
        created_by: actorUserId,
      })
      .execute();

    for (const line of input.lines) {
      await trx
        .insertInto('voucher_line')
        .values({
          id: randomUUID(),
          voucher_id: voucherId,
          ledger_id: line.ledgerId,
          debit_amount: line.debitAmount,
          credit_amount: line.creditAmount,
          line_narration: line.lineNarration ?? null,
        })
        .execute();
    }

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'Voucher',
      entityId: voucherId,
      afterData: { ...input, voucherNumber },
    });
  });

  return voucherId;
}
