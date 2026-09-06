import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { createVoucherInTransaction } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import { attachPaymentInstrumentInTransaction } from '@mhts/core-banking';
import { writeAuditLog } from '@mhts/core-audit';
import type { OutstandingReimbursementRow, ReimburseExpenseClaimInput } from './types';

/** APPROVED claims with a remaining balance — what a reimbursement screen offers to settle against. Mirrors core-sales-purchase's listOutstandingPurchaseInvoices join-and-subtract-settled shape. */
export async function listOutstandingReimbursements(companyDb: Kysely<CompanyDatabase>, employeeId?: string): Promise<OutstandingReimbursementRow[]> {
  let query = companyDb
    .selectFrom('expense_claim')
    .innerJoin('voucher', 'voucher.id', 'expense_claim.voucher_id')
    .innerJoin('employee', 'employee.id', 'expense_claim.employee_id')
    .leftJoin('expense_claim_line', 'expense_claim_line.expense_claim_id', 'expense_claim.id')
    .select(({ fn }) => [
      'expense_claim.id as expenseClaimId',
      'expense_claim.voucher_id as voucherId',
      'voucher.voucher_number as voucherNumber',
      'expense_claim.claim_date as claimDate',
      'expense_claim.employee_id as employeeId',
      'employee.name as employeeName',
      fn.sum<number>('expense_claim_line.amount').as('netAmount'),
    ])
    .where('expense_claim.status', '=', 'APPROVED')
    .where('voucher.cancelled_at', 'is', null)
    .groupBy('expense_claim.id');
  if (employeeId) {
    query = query.where('expense_claim.employee_id', '=', employeeId);
  }
  const claims = await query.execute();

  const settled = await companyDb
    .selectFrom('expense_claim_settlement')
    .innerJoin('voucher', 'voucher.id', 'expense_claim_settlement.voucher_id')
    .select(({ fn }) => ['expense_claim_settlement.expense_claim_id as expenseClaimId', fn.sum<number>('expense_claim_settlement.amount_applied').as('settled')])
    .where('voucher.cancelled_at', 'is', null)
    .groupBy('expense_claim_settlement.expense_claim_id')
    .execute();
  const settledByClaim = new Map(settled.map((row) => [row.expenseClaimId, Number(row.settled ?? 0)]));

  return claims
    .map((row) => {
      const netAmount = Number(row.netAmount ?? 0);
      const settledAmount = settledByClaim.get(row.expenseClaimId) ?? 0;
      return {
        expenseClaimId: row.expenseClaimId,
        // Non-null: the INNER JOIN on voucher.id = expense_claim.voucher_id excludes any row where voucher_id is null.
        voucherId: row.voucherId as string,
        voucherNumber: row.voucherNumber,
        claimDate: row.claimDate,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        netAmount,
        settledAmount,
        outstandingAmount: netAmount - settledAmount,
      };
    })
    .filter((row) => row.outstandingAmount > 0)
    .sort((a, b) => a.claimDate.localeCompare(b.claimDate) || a.voucherNumber - b.voucherNumber);
}

/**
 * Records a reimbursement against one approved expense claim — a real
 * PAYMENT voucher (Dr the employee's ledger, Cr the payment ledger) plus the
 * settlement row, atomically (Rule #4). Composes createVoucherInTransaction
 * + core-banking's attachPaymentInstrumentInTransaction directly inside ONE
 * transaction — NOT via core-banking's recordVoucherWithInstrument, which
 * opens its own transaction and has no hook for the settlement insert.
 */
export async function reimburseExpenseClaim(companyDb: Kysely<CompanyDatabase>, input: ReimburseExpenseClaimInput, actorUserId: string | null): Promise<string> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('Reimbursement amount must be a positive whole-paise amount');
  }

  const claim = await companyDb.selectFrom('expense_claim').selectAll().where('id', '=', input.expenseClaimId).executeTakeFirst();
  if (!claim) {
    throw new Error('Expense claim not found');
  }
  if (claim.status !== 'APPROVED') {
    throw new Error(`Cannot reimburse a ${claim.status} claim`);
  }

  const outstanding = await listOutstandingReimbursements(companyDb, claim.employee_id);
  const row = outstanding.find((o) => o.expenseClaimId === input.expenseClaimId);
  const available = row?.outstandingAmount ?? 0;
  if (input.amount > available) {
    throw new Error(`Reimbursement amount exceeds the claim's remaining outstanding balance (₹${(available / 100).toFixed(2)})`);
  }

  const employee = await companyDb.selectFrom('employee').selectAll().where('id', '=', claim.employee_id).executeTakeFirstOrThrow();

  const voucherLines: VoucherLineInput[] = [
    { ledgerId: employee.ledger_account_id, debitAmount: input.amount, creditAmount: 0 },
    { ledgerId: input.paymentLedgerId, debitAmount: 0, creditAmount: input.amount },
  ];

  return companyDb.transaction().execute(async (trx) => {
    const { voucherId } = await createVoucherInTransaction(
      trx,
      { voucherType: 'PAYMENT', financialYear: input.financialYear, voucherDate: input.paymentDate, narration: input.narration, lines: voucherLines },
      actorUserId,
    );

    if (input.instrument) {
      await attachPaymentInstrumentInTransaction(trx, voucherId, input.instrument, actorUserId);
    }

    await trx
      .insertInto('expense_claim_settlement')
      .values({ id: randomUUID(), expense_claim_id: input.expenseClaimId, voucher_id: voucherId, amount_applied: input.amount })
      .execute();

    if (input.amount === available) {
      await trx.updateTable('expense_claim').set({ status: 'REIMBURSED' }).where('id', '=', input.expenseClaimId).execute();
    }

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'ExpenseClaimSettlement',
      entityId: voucherId,
      afterData: { expenseClaimId: input.expenseClaimId, amount: input.amount, fullySettled: input.amount === available },
    });

    return voucherId;
  });
}
