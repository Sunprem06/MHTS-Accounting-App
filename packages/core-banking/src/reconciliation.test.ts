import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { seedChartOfAccounts, listAccountGroups, listLedgerAccounts, createLedgerAccount, createVoucher } from '@mhts/core-accounting';
import { createBankAccount, listBankAccounts } from './bankAccounts';
import { listReconcilableLines, markLineReconciled, computeBankReconciliationStatement } from './reconciliation';

/**
 * DB-integration coverage for real bank reconciliation — the CSV-import
 * math already has its own tests (statementImport.test.ts); this proves the
 * reconciliation STATEMENT itself (book balance vs. calculated bank balance,
 * adjusted for items the bank hasn't cleared yet) is correct against real
 * posted vouchers, flagged as a gap in Phase 11's Open Questions (broader
 * DB-integration coverage for depreciation/FX-revaluation/bank
 * reconciliation run posting).
 */
describe('core-banking: computeBankReconciliationStatement (real ledger data)', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let bankLedgerId: string;
  let cashLedgerId: string;
  let expenseLedgerId: string;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
    await seedChartOfAccounts(companyDb);

    await createBankAccount(companyDb, { name: 'Current Account', accountNumber: '1234567890', ifscCode: 'HDFC0001234', bankName: 'HDFC Bank', accountType: 'CURRENT' }, null);
    const bankAccounts = await listBankAccounts(companyDb);
    bankLedgerId = bankAccounts.find((a) => a.ledgerName === 'Current Account')!.ledgerAccountId;

    cashLedgerId = (await listLedgerAccounts(companyDb)).find((l) => l.name === 'Cash')!.id;
    const expenseGroupId = (await listAccountGroups(companyDb)).find((g) => g.name === 'Indirect Expenses')!.id;
    expenseLedgerId = await createLedgerAccount(companyDb, { name: 'Office Rent', groupId: expenseGroupId, openingBalance: 0, openingBalanceSide: 'DEBIT' });
  });

  afterEach(async () => {
    await handle.close();
  });

  it('the book balance matches real ledger data, and reconciling one line while leaving another open produces the correct calculated bank balance', async () => {
    // Rs 1,00,000 deposited into the bank from cash (a receipt into the bank ledger).
    await createVoucher(
      companyDb,
      { voucherType: 'CONTRA', financialYear: '2025-26', voucherDate: '2025-06-01', narration: 'Cash deposited into bank', lines: [{ ledgerId: bankLedgerId, debitAmount: 100_000_00, creditAmount: 0 }, { ledgerId: cashLedgerId, debitAmount: 0, creditAmount: 100_000_00 }] },
      null,
    );
    // Rs 15,000 rent paid by cheque (a payment out of the bank ledger) — this one is NOT yet reconciled (a cheque still in transit).
    await createVoucher(
      companyDb,
      { voucherType: 'PAYMENT', financialYear: '2025-26', voucherDate: '2025-06-10', narration: 'Office rent', lines: [{ ledgerId: expenseLedgerId, debitAmount: 15_000_00, creditAmount: 0 }, { ledgerId: bankLedgerId, debitAmount: 0, creditAmount: 15_000_00 }] },
      null,
    );

    const bookBalance = 100_000_00 - 15_000_00; // Rs 85,000, per the ledger itself
    const lines = await listReconcilableLines(companyDb, bankLedgerId);
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.isReconciled === false)).toBe(true); // nothing reconciled yet

    // The bank statement confirms the Rs 1,00,000 deposit cleared, but the Rs 15,000 cheque hasn't yet.
    const depositLine = lines.find((l) => l.debitAmount === 100_000_00)!;
    await markLineReconciled(companyDb, depositLine.voucherLineId, '2025-06-02', null);

    const statement = await computeBankReconciliationStatement(companyDb, bankLedgerId, '2025-06-30');
    expect(statement.bookBalance).toBe(bookBalance);
    // The uncleared Rs 15,000 payment means the bank's OWN balance (per its statement) is still
    // higher than the book balance by that amount — it hasn't left the bank's records yet.
    expect(statement.unclearedPayments).toBe(15_000_00);
    expect(statement.unclearedReceipts).toBe(0);
    expect(statement.calculatedBankBalance).toBe(bookBalance + 15_000_00);
    expect(statement.unclearedLineCount).toBe(1);
  });

  it('once every line is reconciled, book balance and calculated bank balance are identical', async () => {
    await createVoucher(
      companyDb,
      { voucherType: 'CONTRA', financialYear: '2025-26', voucherDate: '2025-06-01', narration: 'Cash deposited into bank', lines: [{ ledgerId: bankLedgerId, debitAmount: 50_000_00, creditAmount: 0 }, { ledgerId: cashLedgerId, debitAmount: 0, creditAmount: 50_000_00 }] },
      null,
    );
    const lines = await listReconcilableLines(companyDb, bankLedgerId);
    for (const line of lines) {
      await markLineReconciled(companyDb, line.voucherLineId, '2025-06-02', null);
    }

    const statement = await computeBankReconciliationStatement(companyDb, bankLedgerId, '2025-06-30');
    expect(statement.calculatedBankBalance).toBe(statement.bookBalance);
    expect(statement.unclearedLineCount).toBe(0);
  });
});
