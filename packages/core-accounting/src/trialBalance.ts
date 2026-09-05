import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { computeLedgerBalances } from './ledgerBalances';
import type { TrialBalance, TrialBalanceRow } from './types';

/**
 * Every ledger's all-time signed balance, split back into a debit or credit
 * column the way a printed Trial Balance reads.
 *
 * Simplification worth calling out: this does not require opening balances
 * themselves to net to zero across ledgers (unlike vouchers, which
 * createVoucher already forces to balance). A business entering ad hoc
 * opening balances that don't net out will see a Trial Balance that doesn't
 * balance either — real accounting software absorbs that via an opening
 * "Suspense"/equity adjustment ledger, which is out of scope for this pass.
 */
export async function computeTrialBalance(companyDb: Kysely<CompanyDatabase>): Promise<TrialBalance> {
  const balances = await computeLedgerBalances(companyDb);

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const balance of balances) {
    const debitBalance = balance.netSigned > 0 ? balance.netSigned : 0;
    const creditBalance = balance.netSigned < 0 ? -balance.netSigned : 0;
    totalDebit += debitBalance;
    totalCredit += creditBalance;

    rows.push({
      ledgerId: balance.ledgerId,
      ledgerName: balance.ledgerName,
      groupName: balance.groupName,
      nature: balance.nature,
      debitBalance,
      creditBalance,
    });
  }

  return { rows, totalDebit, totalCredit };
}
