import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb, createTempSystemDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { seedChartOfAccounts, listAccountGroups, createLedgerAccount, createVoucher, convertForeignToBase, computeTrialBalance } from '@mhts/core-accounting';
import { seedMultiCurrencyLedgers, getMultiCurrencyLedgerIds } from './ledgers';
import { setExchangeRate } from './exchangeRates';
import { previewFxRevaluation, postFxRevaluation } from './revaluation';

/**
 * DB-integration coverage for a real FX-revaluation RUN POSTING — the pure
 * BigInt conversion math already has its own unit tests (exchangeRates.test.ts);
 * this proves a rate CHANGE between booking and revaluation produces a real,
 * balanced FX_REVALUATION voucher against the correct ledgers, flagged as a
 * gap in Phase 11's Open Questions (broader DB-integration coverage for
 * depreciation/FX-revaluation/bank reconciliation run posting).
 */
describe('core-multi-currency: postFxRevaluation (real GL posting)', () => {
  let companyHandle: TempDbHandle<CompanyDatabase>;
  let systemHandle: TempDbHandle<SystemDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let systemDb: Kysely<SystemDatabase>;
  let foreignDebtorLedgerId: string;
  let salesLedgerId: string;

  beforeEach(async () => {
    companyHandle = await createTempCompanyDb();
    systemHandle = await createTempSystemDb();
    companyDb = companyHandle.db;
    systemDb = systemHandle.db;

    await seedChartOfAccounts(companyDb);
    await seedMultiCurrencyLedgers(companyDb);

    const groups = await listAccountGroups(companyDb);
    const debtorsGroupId = groups.find((g) => g.name === 'Sundry Debtors')!.id;
    const salesGroupId = groups.find((g) => g.name === 'Sales Accounts')!.id;
    foreignDebtorLedgerId = await createLedgerAccount(companyDb, { name: 'US Customer (USD)', groupId: debtorsGroupId, openingBalance: 0, openingBalanceSide: 'DEBIT' });
    salesLedgerId = await createLedgerAccount(companyDb, { name: 'Export Sales', groupId: salesGroupId, openingBalance: 0, openingBalanceSide: 'CREDIT' });

    // Booked at Rs 83/USD on 2025-06-01.
    await setExchangeRate(systemDb, { currency: 'USD', effectiveFrom: '2025-04-01', rateMicros: 83_000_000 }, null);
  });

  afterEach(async () => {
    await companyHandle.close();
    await systemHandle.close();
  });

  it('a rate change between booking and revaluation posts a real, balanced FX_REVALUATION voucher with the correct gain/loss direction', async () => {
    const bookingRateMicros = 83_000_000;
    const foreignAmount = 100_000; // $1,000.00
    const baseAmount = convertForeignToBase(foreignAmount, bookingRateMicros); // Rs 83,000

    await createVoucher(
      companyDb,
      {
        voucherType: 'JOURNAL',
        financialYear: '2025-26',
        voucherDate: '2025-06-01',
        narration: 'Sale to US customer',
        lines: [
          { ledgerId: foreignDebtorLedgerId, debitAmount: baseAmount, creditAmount: 0, foreignCurrency: 'USD', foreignAmount, exchangeRateMicros: bookingRateMicros },
          { ledgerId: salesLedgerId, debitAmount: 0, creditAmount: baseAmount },
        ],
      },
      null,
    );

    // USD strengthens to Rs 85 by the revaluation date.
    await setExchangeRate(systemDb, { currency: 'USD', effectiveFrom: '2025-09-01', rateMicros: 85_000_000 }, null);

    const preview = await previewFxRevaluation(companyDb, systemDb, '2025-09-30');
    expect(preview.lines).toHaveLength(1);
    const expectedAdjustment = convertForeignToBase(foreignAmount, 85_000_000) - baseAmount; // Rs 2,000 gain
    expect(preview.lines[0].adjustmentAmount).toBe(expectedAdjustment);
    expect(expectedAdjustment).toBeGreaterThan(0);

    const run = await postFxRevaluation(companyDb, systemDb, { asOfDate: '2025-09-30', financialYear: '2025-26' }, null);
    expect(run.voucherId).not.toBeNull();

    // The debtor ledger increased by the gain (foreign receivable now worth more base currency),
    // and the whole company still balances — the offsetting credit lands on Unrealized Forex Gain/Loss.
    const { unrealizedForexGainLossLedgerId } = await getMultiCurrencyLedgerIds(companyDb);
    const trialBalance = await computeTrialBalance(companyDb);
    expect(trialBalance.totalDebit).toBe(trialBalance.totalCredit);

    const debtorRow = trialBalance.rows.find((r) => r.ledgerId === foreignDebtorLedgerId)!;
    expect(debtorRow.debitBalance).toBe(baseAmount + expectedAdjustment);

    const gainRow = trialBalance.rows.find((r) => r.ledgerId === unrealizedForexGainLossLedgerId)!;
    expect(gainRow.creditBalance).toBe(expectedAdjustment);
  });

  it('a run with no rate change since booking posts no voucher at all (zero-adjustment exposures are skipped)', async () => {
    const foreignAmount = 50_000; // $500.00
    const baseAmount = convertForeignToBase(foreignAmount, 83_000_000);
    await createVoucher(
      companyDb,
      {
        voucherType: 'JOURNAL',
        financialYear: '2025-26',
        voucherDate: '2025-06-01',
        narration: 'Sale to US customer',
        lines: [
          { ledgerId: foreignDebtorLedgerId, debitAmount: baseAmount, creditAmount: 0, foreignCurrency: 'USD', foreignAmount, exchangeRateMicros: 83_000_000 },
          { ledgerId: salesLedgerId, debitAmount: 0, creditAmount: baseAmount },
        ],
      },
      null,
    );

    // No new rate set — the same Rs 83 rate from beforeEach is still in force on the revaluation date.
    const result = await postFxRevaluation(companyDb, systemDb, { asOfDate: '2025-09-30', financialYear: '2025-26' }, null);
    expect(result.voucherId).toBeNull();

    const runs = await companyDb.selectFrom('fx_revaluation_run').selectAll().execute();
    expect(runs).toHaveLength(1);
    expect(runs[0].voucher_id).toBeNull();
  });

  it('running twice after one real rate change posts exactly one voucher, not two (the second run sees zero further adjustment)', async () => {
    const foreignAmount = 100_000; // $1,000.00
    const baseAmount = convertForeignToBase(foreignAmount, 83_000_000);
    await createVoucher(
      companyDb,
      {
        voucherType: 'JOURNAL',
        financialYear: '2025-26',
        voucherDate: '2025-06-01',
        narration: 'Sale to US customer',
        lines: [
          { ledgerId: foreignDebtorLedgerId, debitAmount: baseAmount, creditAmount: 0, foreignCurrency: 'USD', foreignAmount, exchangeRateMicros: 83_000_000 },
          { ledgerId: salesLedgerId, debitAmount: 0, creditAmount: baseAmount },
        ],
      },
      null,
    );
    await setExchangeRate(systemDb, { currency: 'USD', effectiveFrom: '2025-09-01', rateMicros: 85_000_000 }, null);

    const first = await postFxRevaluation(companyDb, systemDb, { asOfDate: '2025-09-30', financialYear: '2025-26' }, null);
    expect(first.voucherId).not.toBeNull();

    const second = await postFxRevaluation(companyDb, systemDb, { asOfDate: '2025-09-30', financialYear: '2025-26' }, null);
    expect(second.voucherId).toBeNull(); // the first run's own fx_revaluation_line record means this run sees zero FURTHER movement

    const postedVouchers = await companyDb.selectFrom('voucher').selectAll().where('voucher_type', '=', 'FX_REVALUATION').execute();
    expect(postedVouchers).toHaveLength(1); // exactly one real voucher across both calls
  });
});
