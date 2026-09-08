import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb, createTempSystemDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { seedChartOfAccounts, listLedgerAccounts, computeTrialBalance } from '@mhts/core-accounting';
import { seedDefaultFixedAssetRules } from './rules';
import { seedFixedAssetLedgers, getFixedAssetLedgerIds } from './ledgers';
import { createAssetClass } from './assetClasses';
import { acquireFixedAsset } from './fixedAssets';
import { previewDepreciationRun, postDepreciationRun } from './depreciation';

/**
 * DB-integration coverage for a real depreciation RUN POSTING — the pure
 * math (computeSchedule2Depreciation/computeItWdvBlockDepreciation) already
 * has its own unit tests (depreciationMath.test.ts); this proves the run
 * actually posts a real, balanced GL voucher whose amount matches what the
 * schedule engine computed, and that the IT WDV book's memo-only entry never
 * gets a voucher_id — a gap flagged in Phase 11's Open Questions (broader
 * DB-integration coverage for depreciation/FX-revaluation/bank
 * reconciliation run posting, beyond the pure-function math tests).
 */
describe('core-fixed-assets: postDepreciationRun (real GL posting)', () => {
  let companyHandle: TempDbHandle<CompanyDatabase>;
  let systemHandle: TempDbHandle<SystemDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let systemDb: Kysely<SystemDatabase>;
  let cashLedgerId: string;
  let assetClassId: string;

  beforeEach(async () => {
    companyHandle = await createTempCompanyDb();
    systemHandle = await createTempSystemDb();
    companyDb = companyHandle.db;
    systemDb = systemHandle.db;

    await seedChartOfAccounts(companyDb);
    await seedFixedAssetLedgers(companyDb);
    await seedDefaultFixedAssetRules(systemDb);

    const ledgers = await listLedgerAccounts(companyDb);
    cashLedgerId = ledgers.find((l) => l.name === 'Cash')!.id;
    assetClassId = await createAssetClass(companyDb, { name: 'Laptops', schedule2RateCategory: 'COMPUTERS_AND_LAPTOPS', itWdvBlockCategory: 'COMPUTERS_AND_LAPTOPS' });
  });

  afterEach(async () => {
    await companyHandle.close();
    await systemHandle.close();
  });

  it('posts one balanced DEPRECIATION voucher whose amount matches the schedule engine, and leaves IT WDV memo-only', async () => {
    await acquireFixedAsset(
      companyDb,
      { assetClassId, name: 'Laptop #1', assetCode: 'FA-001', purchaseDate: '2025-04-01', purchaseCostPaise: 100_000_00, financialYear: '2025-26', paidFromLedgerId: cashLedgerId },
      null,
    );

    const preview = await previewDepreciationRun(companyDb, systemDb, '2025-26', 4);
    expect(preview).toHaveLength(1);
    const expectedSchedule2 = preview[0].schedule2DepreciationPaise;
    const expectedItWdv = preview[0].itWdvDepreciationPaise;
    expect(expectedSchedule2).toBeGreaterThan(0);
    expect(expectedItWdv).toBeGreaterThan(0);

    const { voucherIds } = await postDepreciationRun(companyDb, systemDb, '2025-26', 4, null);
    expect(voucherIds).toHaveLength(1);

    // The posted voucher must balance (Rule #4) and land on exactly the ledgers the run promises.
    const ledgerIds = await getFixedAssetLedgerIds(companyDb);
    const trialBalance = await computeTrialBalance(companyDb);
    expect(trialBalance.totalDebit).toBe(trialBalance.totalCredit); // the whole company still balances

    const depreciationExpenseRow = trialBalance.rows.find((r) => r.ledgerId === ledgerIds.depreciationExpenseLedgerId)!;
    expect(depreciationExpenseRow.debitBalance).toBe(expectedSchedule2);

    const assetClass = await companyDb.selectFrom('asset_class').selectAll().where('id', '=', assetClassId).executeTakeFirstOrThrow();
    const accumDepRow = trialBalance.rows.find((r) => r.ledgerId === assetClass.accumulated_depreciation_ledger_id)!;
    expect(accumDepRow.creditBalance).toBe(expectedSchedule2);

    // The IT WDV book is a real, independently-different figure, and is NEVER GL-posted (memo-only).
    const entries = await companyDb.selectFrom('asset_depreciation_entry').selectAll().execute();
    const schedule2Entry = entries.find((e) => e.book === 'SCHEDULE2')!;
    const itWdvEntry = entries.find((e) => e.book === 'IT_WDV')!;
    expect(schedule2Entry.voucher_id).toBe(voucherIds[0]);
    expect(itWdvEntry.voucher_id).toBeNull();
    expect(itWdvEntry.depreciation_amount_paise).toBe(expectedItWdv);
    expect(itWdvEntry.depreciation_amount_paise).not.toBe(schedule2Entry.depreciation_amount_paise); // the literal dual-depreciation exit criterion
  });

  it('re-running the same period is a safe no-op (already-processed assets are skipped, not double-posted)', async () => {
    await acquireFixedAsset(
      companyDb,
      { assetClassId, name: 'Laptop #2', assetCode: 'FA-002', purchaseDate: '2025-04-01', purchaseCostPaise: 50_000_00, financialYear: '2025-26', paidFromLedgerId: cashLedgerId },
      null,
    );
    const first = await postDepreciationRun(companyDb, systemDb, '2025-26', 4, null);
    expect(first.voucherIds).toHaveLength(1);

    const second = await postDepreciationRun(companyDb, systemDb, '2025-26', 4, null);
    expect(second.voucherIds).toHaveLength(0); // nothing left to process — no duplicate voucher

    const entries = await companyDb.selectFrom('asset_depreciation_entry').selectAll().where('book', '=', 'SCHEDULE2').execute();
    expect(entries).toHaveLength(1); // exactly one entry, not two
  });
});
