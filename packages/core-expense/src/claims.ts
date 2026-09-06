import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { createVoucherInTransaction, cancelVoucherInTransaction } from '@mhts/core-accounting';
import type { VoucherLineInput } from '@mhts/core-accounting';
import type { CreateExpenseClaimInput, ExpenseClaimStatus, ExpenseClaimSummary } from './types';

async function validateExpenseLedgers(companyDb: Kysely<CompanyDatabase>, ledgerIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(ledgerIds)];
  const rows = await companyDb
    .selectFrom('ledger_account')
    .innerJoin('account_group', 'account_group.id', 'ledger_account.group_id')
    .select(['ledger_account.id as id', 'account_group.nature as nature'])
    .where('ledger_account.id', 'in', uniqueIds)
    .execute();
  if (rows.length !== uniqueIds.length) {
    throw new Error('One or more expense ledgers do not exist');
  }
  if (rows.some((row) => row.nature !== 'EXPENSE')) {
    throw new Error('Every expense claim line must use an EXPENSE-nature ledger');
  }
}

/** Own sequential numbering per financial year — a claim exists as DRAFT/SUBMITTED before any voucher does, same reasoning as sales_order/purchase_order (see migration 011's doc comment). */
export async function createExpenseClaim(companyDb: Kysely<CompanyDatabase>, input: CreateExpenseClaimInput, actorUserId: string | null): Promise<string> {
  if (input.lines.length === 0) {
    throw new Error('An expense claim needs at least one line');
  }
  for (const line of input.lines) {
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      throw new Error('Every expense claim line amount must be a positive whole-paise amount');
    }
  }

  const employee = await companyDb.selectFrom('employee').select('id').where('id', '=', input.employeeId).executeTakeFirst();
  if (!employee) {
    throw new Error('Employee not found');
  }

  await validateExpenseLedgers(
    companyDb,
    input.lines.map((line) => line.expenseLedgerId),
  );

  const claimId = randomUUID();

  await companyDb.transaction().execute(async (trx) => {
    const maxNumberRow = await trx
      .selectFrom('expense_claim')
      .select(({ fn }) => fn.max('claim_number').as('maxNumber'))
      .where('financial_year', '=', input.financialYear)
      .executeTakeFirst();
    const claimNumber = (maxNumberRow?.maxNumber ?? 0) + 1;

    await trx
      .insertInto('expense_claim')
      .values({
        id: claimId,
        employee_id: input.employeeId,
        financial_year: input.financialYear,
        claim_number: claimNumber,
        claim_date: input.claimDate,
        purpose: input.purpose ?? null,
        status: 'DRAFT' satisfies ExpenseClaimStatus,
        voucher_id: null,
        rejected_reason: null,
        created_by: actorUserId,
      })
      .execute();

    for (const line of input.lines) {
      await trx
        .insertInto('expense_claim_line')
        .values({
          id: randomUUID(),
          expense_claim_id: claimId,
          expense_ledger_id: line.expenseLedgerId,
          description: line.description,
          expense_date: line.expenseDate,
          amount: line.amount,
          line_narration: line.lineNarration ?? null,
        })
        .execute();
    }

    await writeAuditLog(trx, { actorUserId, action: 'CREATE', entityType: 'ExpenseClaim', entityId: claimId, afterData: { employeeId: input.employeeId, claimDate: input.claimDate } });
  });

  return claimId;
}

export async function listExpenseClaims(companyDb: Kysely<CompanyDatabase>): Promise<ExpenseClaimSummary[]> {
  const claims = await companyDb
    .selectFrom('expense_claim')
    .innerJoin('employee', 'employee.id', 'expense_claim.employee_id')
    .select([
      'expense_claim.id as id',
      'expense_claim.employee_id as employeeId',
      'employee.name as employeeName',
      'expense_claim.financial_year as financialYear',
      'expense_claim.claim_number as claimNumber',
      'expense_claim.claim_date as claimDate',
      'expense_claim.purpose as purpose',
      'expense_claim.status as status',
      'expense_claim.voucher_id as voucherId',
      'expense_claim.rejected_reason as rejectedReason',
    ])
    .orderBy('expense_claim.claim_date', 'desc')
    .orderBy('expense_claim.claim_number', 'desc')
    .execute();

  if (claims.length === 0) {
    return [];
  }

  const lines = await companyDb
    .selectFrom('expense_claim_line')
    .innerJoin('ledger_account', 'ledger_account.id', 'expense_claim_line.expense_ledger_id')
    .select([
      'expense_claim_line.id as id',
      'expense_claim_line.expense_claim_id as expenseClaimId',
      'expense_claim_line.expense_ledger_id as expenseLedgerId',
      'ledger_account.name as expenseLedgerName',
      'expense_claim_line.description as description',
      'expense_claim_line.expense_date as expenseDate',
      'expense_claim_line.amount as amount',
      'expense_claim_line.line_narration as lineNarration',
    ])
    .where(
      'expense_claim_line.expense_claim_id',
      'in',
      claims.map((claim) => claim.id),
    )
    .execute();

  const linesByClaim = new Map<string, typeof lines>();
  for (const line of lines) {
    const existing = linesByClaim.get(line.expenseClaimId) ?? [];
    existing.push(line);
    linesByClaim.set(line.expenseClaimId, existing);
  }

  return claims.map((claim) => {
    const claimLines = linesByClaim.get(claim.id) ?? [];
    return {
      id: claim.id,
      employeeId: claim.employeeId,
      employeeName: claim.employeeName,
      financialYear: claim.financialYear,
      claimNumber: claim.claimNumber,
      claimDate: claim.claimDate,
      purpose: claim.purpose,
      status: claim.status as ExpenseClaimStatus,
      voucherId: claim.voucherId,
      rejectedReason: claim.rejectedReason,
      totalAmount: claimLines.reduce((sum, line) => sum + line.amount, 0),
      lines: claimLines.map(({ expenseClaimId, ...line }) => line),
    };
  });
}

async function transitionStatus(companyDb: Kysely<CompanyDatabase>, claimId: string, from: ExpenseClaimStatus[], to: ExpenseClaimStatus, actorUserId: string | null): Promise<void> {
  const claim = await companyDb.selectFrom('expense_claim').selectAll().where('id', '=', claimId).executeTakeFirst();
  if (!claim) {
    throw new Error('Expense claim not found');
  }
  if (!from.includes(claim.status as ExpenseClaimStatus)) {
    throw new Error(`Cannot move a ${claim.status} claim to ${to}`);
  }

  await companyDb.transaction().execute(async (trx) => {
    await trx.updateTable('expense_claim').set({ status: to }).where('id', '=', claimId).execute();
    await writeAuditLog(trx, { actorUserId, action: 'UPDATE', entityType: 'ExpenseClaim', entityId: claimId, beforeData: { status: claim.status }, afterData: { status: to } });
  });
}

export function submitExpenseClaim(companyDb: Kysely<CompanyDatabase>, claimId: string, actorUserId: string | null): Promise<void> {
  return transitionStatus(companyDb, claimId, ['DRAFT'], 'SUBMITTED', actorUserId);
}

/** No voucher is ever posted for a rejected claim — nothing was accrued pre-approval. */
export async function rejectExpenseClaim(companyDb: Kysely<CompanyDatabase>, claimId: string, reason: string, actorUserId: string | null): Promise<void> {
  const claim = await companyDb.selectFrom('expense_claim').selectAll().where('id', '=', claimId).executeTakeFirst();
  if (!claim) {
    throw new Error('Expense claim not found');
  }
  if (claim.status !== 'SUBMITTED') {
    throw new Error(`Cannot reject a ${claim.status} claim`);
  }

  await companyDb.transaction().execute(async (trx) => {
    await trx.updateTable('expense_claim').set({ status: 'REJECTED' satisfies ExpenseClaimStatus, rejected_reason: reason }).where('id', '=', claimId).execute();
    await writeAuditLog(trx, {
      actorUserId,
      action: 'UPDATE',
      entityType: 'ExpenseClaim',
      entityId: claimId,
      beforeData: { status: claim.status },
      afterData: { status: 'REJECTED', rejectedReason: reason },
    });
  });
}

/** Approving a claim is the accrual: posts a real EXPENSE_CLAIM voucher (Dr each line's expense ledger, Cr the employee's ledger for the total) in the SAME transaction as the status transition — the company now owes the employee, mirroring exactly how a Purchase Invoice creates a payable. */
export async function approveExpenseClaim(companyDb: Kysely<CompanyDatabase>, claimId: string, approvalDate: string, financialYear: string, actorUserId: string | null): Promise<string> {
  const claim = await companyDb.selectFrom('expense_claim').selectAll().where('id', '=', claimId).executeTakeFirst();
  if (!claim) {
    throw new Error('Expense claim not found');
  }
  if (claim.status !== 'SUBMITTED') {
    throw new Error(`Cannot approve a ${claim.status} claim`);
  }

  const employee = await companyDb.selectFrom('employee').selectAll().where('id', '=', claim.employee_id).executeTakeFirstOrThrow();
  const lines = await companyDb.selectFrom('expense_claim_line').selectAll().where('expense_claim_id', '=', claimId).execute();
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  const voucherLines: VoucherLineInput[] = [
    ...lines.map((line) => ({ ledgerId: line.expense_ledger_id, debitAmount: line.amount, creditAmount: 0, lineNarration: line.line_narration ?? undefined })),
    { ledgerId: employee.ledger_account_id, debitAmount: 0, creditAmount: total },
  ];

  return companyDb.transaction().execute(async (trx) => {
    const { voucherId } = await createVoucherInTransaction(
      trx,
      { voucherType: 'EXPENSE_CLAIM', financialYear, voucherDate: approvalDate, narration: claim.purpose ?? undefined, lines: voucherLines },
      actorUserId,
    );

    await trx.updateTable('expense_claim').set({ status: 'APPROVED' satisfies ExpenseClaimStatus, voucher_id: voucherId }).where('id', '=', claimId).execute();
    await writeAuditLog(trx, {
      actorUserId,
      action: 'UPDATE',
      entityType: 'ExpenseClaim',
      entityId: claimId,
      beforeData: { status: 'SUBMITTED' },
      afterData: { status: 'APPROVED', voucherId },
    });

    return voucherId;
  });
}

/**
 * Guards against cancelling a claim that's already had any reimbursement
 * recorded against it — new logic, no existing precedent in this codebase
 * to mirror, but consistent with the "guard, don't half-build reversal"
 * philosophy Phase 3 used for stock-linked invoice cancellation.
 */
export async function cancelExpenseClaim(companyDb: Kysely<CompanyDatabase>, claimId: string, reversalFinancialYear: string, reversalDate: string, actorUserId: string | null): Promise<void> {
  const claim = await companyDb.selectFrom('expense_claim').selectAll().where('id', '=', claimId).executeTakeFirst();
  if (!claim) {
    throw new Error('Expense claim not found');
  }
  if (claim.status !== 'APPROVED') {
    throw new Error(`Cannot cancel a ${claim.status} claim`);
  }
  if (!claim.voucher_id) {
    throw new Error('Approved claim is missing its posted voucher');
  }

  const existingSettlement = await companyDb.selectFrom('expense_claim_settlement').select('id').where('expense_claim_id', '=', claimId).executeTakeFirst();
  if (existingSettlement) {
    throw new Error('This claim already has a reimbursement recorded against it and can no longer be cancelled');
  }

  await companyDb.transaction().execute(async (trx) => {
    await cancelVoucherInTransaction(trx, claim.voucher_id!, reversalFinancialYear, reversalDate, actorUserId);
    await trx.updateTable('expense_claim').set({ status: 'CANCELLED' satisfies ExpenseClaimStatus }).where('id', '=', claimId).execute();
    await writeAuditLog(trx, {
      actorUserId,
      action: 'UPDATE',
      entityType: 'ExpenseClaim',
      entityId: claimId,
      beforeData: { status: 'APPROVED' },
      afterData: { status: 'CANCELLED' },
    });
  });
}
