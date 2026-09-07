import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import { convertForeignToBase, createVoucherInTransaction } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import { resolveExchangeRate } from './exchangeRates';
import { getMultiCurrencyLedgerIds } from './ledgers';
import type { FxRevaluationLineDetail, FxRevaluationPreview, FxRevaluationRunSummary } from './types';

interface ExposureRow {
  ledgerId: string;
  ledgerName: string;
  currency: string;
  foreignBalance: number;
  baseBalanceBefore: number;
}

/**
 * Every distinct (ledger, foreign currency) FX exposure with any activity
 * on or before asOfDate — sums foreign_amount and debit/credit_amount the
 * same debit-positive way computeLedgerBalances does for the base-currency
 * figure.
 *
 * A revaluation run's own adjustment line posts as a PLAIN base-currency
 * amount (not tagged with foreign_currency) — the amount is a pure
 * valuation change of an unchanged foreign balance, not a new foreign-
 * currency transaction, so it can't satisfy voucher_line's "debit/credit
 * must equal foreignAmount x rate" invariant the way a real FX transaction
 * does. That means baseBalanceBefore, if computed purely from foreign-
 * tagged lines, would silently forget every prior revaluation's effect.
 * fx_revaluation_line is the durable record of that effect (see
 * postFxRevaluation) — summing its adjustment_amount for this (ledger,
 * currency) is what makes baseBalanceBefore correct on a second run, and
 * is the same idempotency trick Increment 1's depreciation run used:
 * re-deriving from durable records, never a separate mutable snapshot.
 */
async function findFxExposures(companyDb: Kysely<CompanyDatabase>, asOfDate: string): Promise<ExposureRow[]> {
  // foreign_amount is always positive; direction comes from which of debit/credit_amount is set on that
  // same row, so the signed foreign balance is re-aggregated in application code from the raw rows rather
  // than a SQL SUM (a portable CASE-signed SUM isn't worth it for a table this size).
  const rawLines = await companyDb
    .selectFrom('voucher_line')
    .innerJoin('voucher', 'voucher.id', 'voucher_line.voucher_id')
    .innerJoin('ledger_account', 'ledger_account.id', 'voucher_line.ledger_id')
    .where('voucher_line.foreign_currency', 'is not', null)
    .where('voucher.voucher_date', '<=', asOfDate)
    .select([
      'voucher_line.ledger_id as ledgerId',
      'ledger_account.name as ledgerName',
      'voucher_line.foreign_currency as currency',
      'voucher_line.foreign_amount as foreignAmount',
      'voucher_line.debit_amount as debitAmount',
      'voucher_line.credit_amount as creditAmount',
    ])
    .execute();

  const byKey = new Map<string, ExposureRow>();
  for (const line of rawLines) {
    const key = `${line.ledgerId}::${line.currency}`;
    const existing = byKey.get(key) ?? { ledgerId: line.ledgerId, ledgerName: line.ledgerName, currency: line.currency as string, foreignBalance: 0, baseBalanceBefore: 0 };
    const signed = line.debitAmount > 0 ? (line.foreignAmount ?? 0) : -(line.foreignAmount ?? 0);
    existing.foreignBalance += signed;
    existing.baseBalanceBefore += line.debitAmount - line.creditAmount;
    byKey.set(key, existing);
  }

  const priorAdjustments = await companyDb
    .selectFrom('fx_revaluation_line')
    .innerJoin('fx_revaluation_run', 'fx_revaluation_run.id', 'fx_revaluation_line.run_id')
    .where('fx_revaluation_run.run_date', '<=', asOfDate)
    .select(({ fn }) => ['fx_revaluation_line.ledger_id as ledgerId', 'fx_revaluation_line.currency as currency', fn.sum<number>('fx_revaluation_line.adjustment_amount').as('total')])
    .groupBy(['fx_revaluation_line.ledger_id', 'fx_revaluation_line.currency'])
    .execute();
  for (const adj of priorAdjustments) {
    const key = `${adj.ledgerId}::${adj.currency}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.baseBalanceBefore += Number(adj.total ?? 0);
    }
  }

  return [...byKey.values()];
}

async function computeRevaluationLines(companyDb: Kysely<CompanyDatabase>, systemDb: Kysely<SystemDatabase>, asOfDate: string): Promise<FxRevaluationLineDetail[]> {
  const exposures = await findFxExposures(companyDb, asOfDate);

  const lines: FxRevaluationLineDetail[] = [];
  for (const exposure of exposures) {
    const newRateMicros = await resolveExchangeRate(systemDb, exposure.currency, asOfDate);
    const magnitude = Math.abs(exposure.foreignBalance);
    const sign = exposure.foreignBalance < 0 ? -1 : 1;
    const baseBalanceAfter = sign * convertForeignToBase(magnitude, newRateMicros);
    lines.push({
      ledgerId: exposure.ledgerId,
      ledgerName: exposure.ledgerName,
      currency: exposure.currency,
      foreignBalance: exposure.foreignBalance,
      baseBalanceBefore: exposure.baseBalanceBefore,
      baseBalanceAfter,
      adjustmentAmount: baseBalanceAfter - exposure.baseBalanceBefore,
    });
  }
  return lines.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName) || a.currency.localeCompare(b.currency));
}

/** Read-only preview of what a revaluation run as of asOfDate would post. */
export async function previewFxRevaluation(companyDb: Kysely<CompanyDatabase>, systemDb: Kysely<SystemDatabase>, asOfDate: string): Promise<FxRevaluationPreview> {
  const lines = await computeRevaluationLines(companyDb, systemDb, asOfDate);
  const totalAdjustmentMagnitude = lines.reduce((sum, l) => sum + Math.abs(l.adjustmentAmount), 0);
  return { asOfDate, lines, totalAdjustmentMagnitude };
}

/**
 * Posts the revaluation run: re-runs the computation for correctness (never
 * trusts a stale UI-held preview), then posts ONE balanced FX_REVALUATION
 * voucher — one Dr/Cr line per ledger with a non-zero adjustment, plus a
 * single net offsetting line to "Unrealized Forex Gain/Loss" (only when the
 * per-ledger adjustments don't already net to exactly zero on their own).
 * Zero-adjustment exposures are skipped entirely, so re-running the same
 * date twice is a no-op — same idempotency as re-running depreciation for
 * an already-processed period. fx_revaluation_run/fx_revaluation_line
 * record every exposure's calculation, mirroring asset_depreciation_entry's
 * role for depreciation runs.
 */
export async function postFxRevaluation(
  companyDb: Kysely<CompanyDatabase>,
  systemDb: Kysely<SystemDatabase>,
  input: { asOfDate: string; financialYear: string },
  actorUserId: string | null,
): Promise<FxRevaluationRunSummary> {
  const lines = await computeRevaluationLines(companyDb, systemDb, input.asOfDate);
  const nonZeroLines = lines.filter((l) => l.adjustmentAmount !== 0);

  const { unrealizedForexGainLossLedgerId } = await getMultiCurrencyLedgerIds(companyDb);

  return companyDb.transaction().execute(async (trx) => {
    let voucherId: string | null = null;

    if (nonZeroLines.length > 0) {
      const voucherLines: VoucherLineInput[] = nonZeroLines.map((l) =>
        l.adjustmentAmount > 0
          ? { ledgerId: l.ledgerId, debitAmount: l.adjustmentAmount, creditAmount: 0 }
          : { ledgerId: l.ledgerId, debitAmount: 0, creditAmount: -l.adjustmentAmount },
      );
      const netAdjustment = nonZeroLines.reduce((sum, l) => sum + l.adjustmentAmount, 0);
      if (netAdjustment > 0) {
        voucherLines.push({ ledgerId: unrealizedForexGainLossLedgerId, debitAmount: 0, creditAmount: netAdjustment });
      } else if (netAdjustment < 0) {
        voucherLines.push({ ledgerId: unrealizedForexGainLossLedgerId, debitAmount: -netAdjustment, creditAmount: 0 });
      }

      const posted = await createVoucherInTransaction(
        trx,
        {
          voucherType: 'FX_REVALUATION',
          financialYear: input.financialYear,
          voucherDate: input.asOfDate,
          narration: `Foreign currency revaluation as of ${input.asOfDate}`,
          lines: voucherLines,
        },
        actorUserId,
      );
      voucherId = posted.voucherId;
    }

    const runId = randomUUID();
    await trx
      .insertInto('fx_revaluation_run')
      .values({ id: runId, run_date: input.asOfDate, financial_year: input.financialYear, voucher_id: voucherId, created_by: actorUserId })
      .execute();

    for (const line of lines) {
      await trx
        .insertInto('fx_revaluation_line')
        .values({
          id: randomUUID(),
          run_id: runId,
          ledger_id: line.ledgerId,
          currency: line.currency,
          foreign_balance: line.foreignBalance,
          base_balance_before: line.baseBalanceBefore,
          base_balance_after: line.baseBalanceAfter,
          adjustment_amount: line.adjustmentAmount,
        })
        .execute();
    }

    return { id: runId, runDate: input.asOfDate, financialYear: input.financialYear, voucherId, lines };
  });
}

export async function listFxRevaluationRuns(companyDb: Kysely<CompanyDatabase>): Promise<{ id: string; runDate: string; financialYear: string; voucherId: string | null }[]> {
  const rows = await companyDb.selectFrom('fx_revaluation_run').selectAll().orderBy('run_date', 'desc').execute();
  return rows.map((r) => ({ id: r.id, runDate: r.run_date, financialYear: r.financial_year, voucherId: r.voucher_id }));
}
