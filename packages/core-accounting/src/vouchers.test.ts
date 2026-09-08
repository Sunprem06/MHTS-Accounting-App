import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { seedChartOfAccounts, listAccountGroups, createLedgerAccount } from './chartOfAccounts';
import { cancelVoucher, createVoucher, listVouchers } from './vouchers';
import { computeTrialBalance } from './trialBalance';

/**
 * The double-entry balancing invariant ("unbalanced entries impossible") is
 * the Blueprint's literal Phase 1 exit criterion and the foundation every
 * other module's ledger posting depends on — the single highest-priority
 * integration test in core-accounting.
 */
describe('core-accounting: createVoucher / computeTrialBalance / cancelVoucher (double-entry invariant)', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let cashLedgerId: string;
  let capitalLedgerId: string;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
    await seedChartOfAccounts(companyDb);

    const ledgers = await listAccountGroups(companyDb);
    const assetGroup = ledgers.find((g) => g.nature === 'ASSET')!;
    const equityGroup = ledgers.find((g) => g.nature === 'EQUITY')!;
    cashLedgerId = await createLedgerAccount(companyDb, { name: 'Test Cash', groupId: assetGroup.id, openingBalance: 0, openingBalanceSide: 'DEBIT' });
    capitalLedgerId = await createLedgerAccount(companyDb, { name: 'Test Capital', groupId: equityGroup.id, openingBalance: 0, openingBalanceSide: 'CREDIT' });
  });

  afterEach(async () => {
    await handle.close();
  });

  it('a balanced voucher posts successfully and the Trial Balance ties out to the paisa', async () => {
    await createVoucher(
      companyDb,
      {
        voucherType: 'JOURNAL',
        financialYear: '2025-2026',
        voucherDate: '2025-12-01',
        narration: 'Owner capital introduced',
        lines: [
          { ledgerId: cashLedgerId, debitAmount: 100_000_00, creditAmount: 0 },
          { ledgerId: capitalLedgerId, debitAmount: 0, creditAmount: 100_000_00 },
        ],
      },
      null,
    );

    const tb = await computeTrialBalance(companyDb);
    expect(tb.totalDebit).toBe(tb.totalCredit);
    expect(tb.totalDebit).toBe(100_000_00);
  });

  it('rejects an unbalanced voucher — the literal "unbalanced entries impossible" exit criterion', async () => {
    await expect(
      createVoucher(
        companyDb,
        {
          voucherType: 'JOURNAL',
          financialYear: '2025-2026',
          voucherDate: '2025-12-01',
          narration: 'Deliberately unbalanced',
          lines: [
            { ledgerId: cashLedgerId, debitAmount: 100_00, creditAmount: 0 },
            { ledgerId: capitalLedgerId, debitAmount: 0, creditAmount: 50_00 },
          ],
        },
        null,
      ),
    ).rejects.toThrow(/Unbalanced/);

    const tb = await computeTrialBalance(companyDb);
    expect(tb.totalDebit).toBe(0); // nothing was posted — rejected atomically, not partially
  });

  it('rejects a voucher with fewer than two lines', async () => {
    await expect(
      createVoucher(companyDb, { voucherType: 'JOURNAL', financialYear: '2025-2026', voucherDate: '2025-12-01', narration: null, lines: [{ ledgerId: cashLedgerId, debitAmount: 100_00, creditAmount: 0 }] }, null),
    ).rejects.toThrow();
  });

  it('rejects a line with both a debit and a credit amount (or neither)', async () => {
    await expect(
      createVoucher(
        companyDb,
        { voucherType: 'JOURNAL', financialYear: '2025-2026', voucherDate: '2025-12-01', narration: null, lines: [{ ledgerId: cashLedgerId, debitAmount: 100_00, creditAmount: 100_00 }, { ledgerId: capitalLedgerId, debitAmount: 0, creditAmount: 100_00 }] },
        null,
      ),
    ).rejects.toThrow(/exactly one/);
  });

  it('rejects a fractional (non-paise-integer) amount', async () => {
    await expect(
      createVoucher(
        companyDb,
        { voucherType: 'JOURNAL', financialYear: '2025-2026', voucherDate: '2025-12-01', narration: null, lines: [{ ledgerId: cashLedgerId, debitAmount: 100.5, creditAmount: 0 }, { ledgerId: capitalLedgerId, debitAmount: 0, creditAmount: 100.5 }] },
        null,
      ),
    ).rejects.toThrow(/whole paise/);
  });

  it('cancelVoucher posts an automatic mirror-image reversal, never edits the original — the Trial Balance nets back to zero and both vouchers remain visible in the register', async () => {
    const voucherId = await createVoucher(
      companyDb,
      { voucherType: 'JOURNAL', financialYear: '2025-2026', voucherDate: '2025-12-01', narration: 'To be cancelled', lines: [{ ledgerId: cashLedgerId, debitAmount: 50_000_00, creditAmount: 0 }, { ledgerId: capitalLedgerId, debitAmount: 0, creditAmount: 50_000_00 }] },
      null,
    );

    await cancelVoucher(companyDb, voucherId, '2025-2026', '2025-12-02', null);

    const tb = await computeTrialBalance(companyDb);
    expect(tb.totalDebit).toBe(0);
    expect(tb.totalCredit).toBe(0);

    const vouchers = await listVouchers(companyDb);
    expect(vouchers).toHaveLength(2); // the original (now cancelled) + the reversal
    const original = vouchers.find((v) => v.id === voucherId)!;
    expect(original.cancelledAt).not.toBeNull();
    expect(original.cancelledByVoucherId).not.toBeNull();
  });

  it('refuses to cancel an already-cancelled voucher', async () => {
    const voucherId = await createVoucher(
      companyDb,
      { voucherType: 'JOURNAL', financialYear: '2025-2026', voucherDate: '2025-12-01', narration: null, lines: [{ ledgerId: cashLedgerId, debitAmount: 10_00, creditAmount: 0 }, { ledgerId: capitalLedgerId, debitAmount: 0, creditAmount: 10_00 }] },
      null,
    );
    await cancelVoucher(companyDb, voucherId, '2025-2026', '2025-12-02', null);
    await expect(cancelVoucher(companyDb, voucherId, '2025-2026', '2025-12-03', null)).rejects.toThrow(/already been cancelled/);
  });

  it('refuses to cancel a reversal voucher itself', async () => {
    const voucherId = await createVoucher(
      companyDb,
      { voucherType: 'JOURNAL', financialYear: '2025-2026', voucherDate: '2025-12-01', narration: null, lines: [{ ledgerId: cashLedgerId, debitAmount: 10_00, creditAmount: 0 }, { ledgerId: capitalLedgerId, debitAmount: 0, creditAmount: 10_00 }] },
      null,
    );
    const reversalId = await cancelVoucher(companyDb, voucherId, '2025-2026', '2025-12-02', null);
    await expect(cancelVoucher(companyDb, reversalId, '2025-2026', '2025-12-03', null)).rejects.toThrow(/reversal voucher/);
  });

  it('voucher numbering is sequential per voucher type per financial year, starting at 1', async () => {
    const idA = await createVoucher(companyDb, { voucherType: 'JOURNAL', financialYear: '2025-2026', voucherDate: '2025-12-01', narration: null, lines: [{ ledgerId: cashLedgerId, debitAmount: 10_00, creditAmount: 0 }, { ledgerId: capitalLedgerId, debitAmount: 0, creditAmount: 10_00 }] }, null);
    const idB = await createVoucher(companyDb, { voucherType: 'JOURNAL', financialYear: '2025-2026', voucherDate: '2025-12-02', narration: null, lines: [{ ledgerId: cashLedgerId, debitAmount: 20_00, creditAmount: 0 }, { ledgerId: capitalLedgerId, debitAmount: 0, creditAmount: 20_00 }] }, null);

    const vouchers = await listVouchers(companyDb);
    const a = vouchers.find((v) => v.id === idA)!;
    const b = vouchers.find((v) => v.id === idB)!;
    expect([a.voucherNumber, b.voucherNumber].sort()).toEqual([1, 2]);
  });
});
