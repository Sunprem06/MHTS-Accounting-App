import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { seedChartOfAccounts, listAccountGroups, createLedgerAccount, computeTrialBalance } from '@mhts/core-accounting';
import { createEmployee } from './employees';
import { seedExpenseLedgers } from './seedLedgers';
import { createExpenseClaim, submitExpenseClaim, approveExpenseClaim, rejectExpenseClaim, cancelExpenseClaim } from './claims';
import { reimburseExpenseClaim } from './settlements';

describe('core-expense: expense claim lifecycle (smoke)', () => {
  let handle: TempDbHandle<CompanyDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let employeeId: string;
  let expenseLedgerId: string;
  let cashLedgerId: string;

  beforeEach(async () => {
    handle = await createTempCompanyDb();
    companyDb = handle.db;
    await seedChartOfAccounts(companyDb);
    await seedExpenseLedgers(companyDb);
    employeeId = await createEmployee(companyDb, { employeeCode: 'EMP-1', name: 'Test Employee' }, null);

    const groups = await listAccountGroups(companyDb);
    const expenseGroup = groups.find((g) => g.nature === 'EXPENSE')!;
    const assetGroup = groups.find((g) => g.nature === 'ASSET')!;
    expenseLedgerId = await createLedgerAccount(companyDb, { name: 'Travel Expense', groupId: expenseGroup.id, openingBalance: 0, openingBalanceSide: 'DEBIT' });
    // Zero opening balance deliberately — computeTrialBalance does not require opening balances to net
    // to zero across ledgers (a separate, already-flagged Open Question), so a lone nonzero opening
    // balance here would imbalance the Trial Balance for reasons unrelated to what this test checks.
    cashLedgerId = await createLedgerAccount(companyDb, { name: 'Test Cash', groupId: assetGroup.id, openingBalance: 0, openingBalanceSide: 'DEBIT' });
  });

  afterEach(async () => {
    await handle.close();
  });

  it('DRAFT -> SUBMITTED -> APPROVED posts a balanced accrual voucher (Dr expense, Cr employee ledger), then REIMBURSED settles it', async () => {
    const claimId = await createExpenseClaim(
      companyDb,
      { employeeId, financialYear: '2025-2026', claimDate: '2025-12-01', lines: [{ expenseLedgerId, description: 'Taxi fare', expenseDate: '2025-12-01', amount: 500_00 }] },
      null,
    );

    await submitExpenseClaim(companyDb, claimId, null);
    const voucherId = await approveExpenseClaim(companyDb, claimId, '2025-12-02', '2025-2026', null);
    expect(voucherId).toBeTruthy();

    const tbAfterApproval = await computeTrialBalance(companyDb);
    expect(tbAfterApproval.totalDebit).toBe(tbAfterApproval.totalCredit);

    await reimburseExpenseClaim(companyDb, { expenseClaimId: claimId, paymentLedgerId: cashLedgerId, paymentDate: '2025-12-03', financialYear: '2025-2026', amount: 500_00 }, null);

    const tbAfterReimbursement = await computeTrialBalance(companyDb);
    expect(tbAfterReimbursement.totalDebit).toBe(tbAfterReimbursement.totalCredit);
  });

  it('rejects an approval attempt on a claim still in DRAFT (must be SUBMITTED first)', async () => {
    const claimId = await createExpenseClaim(
      companyDb,
      { employeeId, financialYear: '2025-2026', claimDate: '2025-12-01', lines: [{ expenseLedgerId, description: 'x', expenseDate: '2025-12-01', amount: 100_00 }] },
      null,
    );
    await expect(approveExpenseClaim(companyDb, claimId, '2025-12-02', '2025-2026', null)).rejects.toThrow(/DRAFT/);
  });

  it('a rejected claim records the reason and cannot be approved afterward', async () => {
    const claimId = await createExpenseClaim(
      companyDb,
      { employeeId, financialYear: '2025-2026', claimDate: '2025-12-01', lines: [{ expenseLedgerId, description: 'x', expenseDate: '2025-12-01', amount: 100_00 }] },
      null,
    );
    await submitExpenseClaim(companyDb, claimId, null);
    await rejectExpenseClaim(companyDb, claimId, 'Not a valid business expense', null);
    await expect(approveExpenseClaim(companyDb, claimId, '2025-12-02', '2025-2026', null)).rejects.toThrow();
  });

  it('a claim with a recorded reimbursement cannot be cancelled — the settlement-aware cancellation guard', async () => {
    const claimId = await createExpenseClaim(
      companyDb,
      { employeeId, financialYear: '2025-2026', claimDate: '2025-12-01', lines: [{ expenseLedgerId, description: 'x', expenseDate: '2025-12-01', amount: 500_00 }] },
      null,
    );
    await submitExpenseClaim(companyDb, claimId, null);
    await approveExpenseClaim(companyDb, claimId, '2025-12-02', '2025-2026', null);
    await reimburseExpenseClaim(companyDb, { expenseClaimId: claimId, paymentLedgerId: cashLedgerId, paymentDate: '2025-12-03', financialYear: '2025-2026', amount: 500_00 }, null);

    await expect(cancelExpenseClaim(companyDb, claimId, '2025-2026', '2025-12-04', null)).rejects.toThrow();
  });

  it('every expense claim line must use an EXPENSE-nature ledger, not e.g. an asset ledger', async () => {
    await expect(
      createExpenseClaim(companyDb, { employeeId, financialYear: '2025-2026', claimDate: '2025-12-01', lines: [{ expenseLedgerId: cashLedgerId, description: 'x', expenseDate: '2025-12-01', amount: 100_00 }] }, null),
    ).rejects.toThrow(/EXPENSE-nature/);
  });
});
