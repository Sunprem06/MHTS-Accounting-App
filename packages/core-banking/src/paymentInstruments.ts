import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { createVoucherInTransaction } from '@mhts/core-accounting';
import type { CreateVoucherInput } from '@mhts/core-accounting';
import { INSTRUMENT_STATUSES, INSTRUMENT_TYPES } from './types';
import type { InstrumentStatus, InstrumentType, PaymentInstrumentInput, PaymentInstrumentSummary } from './types';

/** The composable half — usable inside a caller's own transaction (mirrors createVoucherInTransaction's own reasoning). */
export async function attachPaymentInstrumentInTransaction(
  trx: Transaction<CompanyDatabase>,
  voucherId: string,
  input: PaymentInstrumentInput,
  actorUserId: string | null,
): Promise<string> {
  if (!INSTRUMENT_TYPES.includes(input.instrumentType)) {
    throw new Error(`Unknown payment instrument type: ${input.instrumentType}`);
  }

  const instrumentId = randomUUID();
  await trx
    .insertInto('voucher_payment_instrument')
    .values({
      id: instrumentId,
      voucher_id: voucherId,
      instrument_type: input.instrumentType,
      cheque_number: input.chequeNumber ?? null,
      cheque_date: input.chequeDate ?? null,
      utr_reference: input.utrReference ?? null,
      instrument_status: 'PENDING',
      status_date: null,
    })
    .execute();

  await writeAuditLog(trx, {
    actorUserId,
    action: 'CREATE',
    entityType: 'VoucherPaymentInstrument',
    entityId: instrumentId,
    afterData: { voucherId, instrumentType: input.instrumentType, chequeNumber: input.chequeNumber ?? null, utrReference: input.utrReference ?? null },
  });

  return instrumentId;
}

/**
 * Single entry point for Payment/Receipt/Contra screens: posts the voucher
 * and (when given) its payment-instrument details as ONE atomic transaction
 * (CLAUDE.md Rule #4) — a cheque payment can never exist without its
 * instrument record, or vice versa. Degrades to a plain voucher post when
 * instrumentInput is null, so callers have a single code path regardless of
 * whether a bank ledger/instrument is involved.
 */
export async function recordVoucherWithInstrument(
  companyDb: Kysely<CompanyDatabase>,
  voucherInput: CreateVoucherInput,
  instrumentInput: PaymentInstrumentInput | null,
  actorUserId: string | null,
): Promise<string> {
  return companyDb.transaction().execute(async (trx) => {
    const { voucherId } = await createVoucherInTransaction(trx, voucherInput, actorUserId);
    if (instrumentInput) {
      await attachPaymentInstrumentInTransaction(trx, voucherId, instrumentInput, actorUserId);
    }
    return voucherId;
  });
}

export async function updateInstrumentStatus(
  companyDb: Kysely<CompanyDatabase>,
  voucherId: string,
  status: InstrumentStatus,
  statusDate: string,
  actorUserId: string | null,
): Promise<void> {
  if (!INSTRUMENT_STATUSES.includes(status)) {
    throw new Error(`Unknown instrument status: ${status}`);
  }

  await companyDb.transaction().execute(async (trx) => {
    const existing = await trx.selectFrom('voucher_payment_instrument').selectAll().where('voucher_id', '=', voucherId).executeTakeFirst();
    if (!existing) {
      throw new Error('No payment instrument is attached to this voucher');
    }

    await trx.updateTable('voucher_payment_instrument').set({ instrument_status: status, status_date: statusDate }).where('voucher_id', '=', voucherId).execute();

    await writeAuditLog(trx, {
      actorUserId,
      action: 'UPDATE',
      entityType: 'VoucherPaymentInstrument',
      entityId: existing.id,
      beforeData: { instrumentStatus: existing.instrument_status },
      afterData: { instrumentStatus: status, statusDate },
    });
  });
}

export async function listPaymentInstruments(companyDb: Kysely<CompanyDatabase>, filter?: { status?: InstrumentStatus }): Promise<PaymentInstrumentSummary[]> {
  let query = companyDb
    .selectFrom('voucher_payment_instrument')
    .innerJoin('voucher', 'voucher.id', 'voucher_payment_instrument.voucher_id')
    .select([
      'voucher_payment_instrument.id as id',
      'voucher_payment_instrument.voucher_id as voucherId',
      'voucher.voucher_type as voucherType',
      'voucher.voucher_number as voucherNumber',
      'voucher.voucher_date as voucherDate',
      'voucher_payment_instrument.instrument_type as instrumentType',
      'voucher_payment_instrument.cheque_number as chequeNumber',
      'voucher_payment_instrument.cheque_date as chequeDate',
      'voucher_payment_instrument.utr_reference as utrReference',
      'voucher_payment_instrument.instrument_status as instrumentStatus',
      'voucher_payment_instrument.status_date as statusDate',
    ])
    .orderBy('voucher.voucher_date', 'desc');

  if (filter?.status) {
    query = query.where('voucher_payment_instrument.instrument_status', '=', filter.status);
  }

  const rows = await query.execute();
  return rows.map((row) => ({
    ...row,
    instrumentType: row.instrumentType as InstrumentType,
    instrumentStatus: row.instrumentStatus as InstrumentStatus,
  }));
}
