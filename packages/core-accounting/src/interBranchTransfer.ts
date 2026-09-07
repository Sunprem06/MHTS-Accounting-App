import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { createVoucher } from './vouchers';
import type { VoucherLineInput } from './types';

export interface RecordInterBranchTransferInput {
  fromBranchId: string;
  toBranchId: string;
  /** e.g. that branch's own Cash/Bank ledger. */
  fromLedgerId: string;
  toLedgerId: string;
  /** Paise. */
  amount: number;
  transferDate: string;
  financialYear: string;
  narration?: string;
}

/**
 * Records a cash/stock transfer between two branches as one balanced,
 * 4-line INTER_BRANCH_TRANSFER voucher — the standard "branch current
 * account" bookkeeping pattern, so each branch's own books stay
 * self-consistent:
 *
 *   Dr  fromBranch's Inter-Branch Current A/c   amount   (branch = fromBranch)
 *   Cr  fromLedgerId                            amount   (branch = fromBranch)
 *   Dr  toLedgerId                              amount   (branch = toBranch)
 *   Cr  toBranch's Inter-Branch Current A/c     amount   (branch = toBranch)
 *
 * Because every transfer voucher is balanced, the two branches' Inter-Branch
 * ledger balances always net to exactly zero in aggregate — no elimination
 * logic is needed anywhere for the whole-company Balance Sheet to already be
 * the correct consolidated report (see branchBalanceSheet.ts's doc comment
 * for the fuller reasoning).
 */
export async function recordInterBranchTransfer(companyDb: Kysely<CompanyDatabase>, input: RecordInterBranchTransferInput, actorUserId: string | null): Promise<string> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('Transfer amount must be a positive whole-paise amount');
  }
  if (input.fromBranchId === input.toBranchId) {
    throw new Error('Source and destination branch must be different');
  }

  const fromBranch = await companyDb.selectFrom('branch').selectAll().where('id', '=', input.fromBranchId).executeTakeFirst();
  if (!fromBranch) {
    throw new Error('Source branch not found');
  }
  const toBranch = await companyDb.selectFrom('branch').selectAll().where('id', '=', input.toBranchId).executeTakeFirst();
  if (!toBranch) {
    throw new Error('Destination branch not found');
  }

  const lines: VoucherLineInput[] = [
    { ledgerId: fromBranch.inter_branch_ledger_id, debitAmount: input.amount, creditAmount: 0, branchId: input.fromBranchId },
    { ledgerId: input.fromLedgerId, debitAmount: 0, creditAmount: input.amount, branchId: input.fromBranchId },
    { ledgerId: input.toLedgerId, debitAmount: input.amount, creditAmount: 0, branchId: input.toBranchId },
    { ledgerId: toBranch.inter_branch_ledger_id, debitAmount: 0, creditAmount: input.amount, branchId: input.toBranchId },
  ];

  return createVoucher(
    companyDb,
    {
      voucherType: 'INTER_BRANCH_TRANSFER',
      financialYear: input.financialYear,
      voucherDate: input.transferDate,
      narration: input.narration ?? `Inter-branch transfer: ${fromBranch.name} -> ${toBranch.name}`,
      lines,
    },
    actorUserId,
  );
}
