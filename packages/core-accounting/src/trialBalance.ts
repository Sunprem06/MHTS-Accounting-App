import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { AccountNature, TrialBalance, TrialBalanceRow } from './types';

/**
 * Sums each ledger's opening balance plus every posted voucher line into a
 * single signed (debit-positive) balance, then splits it back into a debit
 * or credit column the way a printed Trial Balance reads.
 *
 * Simplification worth calling out: this does not require opening balances
 * themselves to net to zero across ledgers (unlike vouchers, which
 * createVoucher already forces to balance). A business entering ad hoc
 * opening balances that don't net out will see a Trial Balance that doesn't
 * balance either — real accounting software absorbs that via an opening
 * "Suspense"/equity adjustment ledger, which is out of scope for this pass.
 */
export async function computeTrialBalance(companyDb: Kysely<CompanyDatabase>): Promise<TrialBalance> {
  const ledgers = await companyDb
    .selectFrom('ledger_account')
    .innerJoin('account_group', 'account_group.id', 'ledger_account.group_id')
    .select([
      'ledger_account.id as ledgerId',
      'ledger_account.name as ledgerName',
      'account_group.name as groupName',
      'account_group.nature as nature',
      'ledger_account.opening_balance as openingBalance',
      'ledger_account.opening_balance_side as openingBalanceSide',
    ])
    .orderBy('ledger_account.name')
    .execute();

  const movements = await companyDb
    .selectFrom('voucher_line')
    .select(({ fn }) => [
      'ledger_id as ledgerId',
      fn.sum<number>('debit_amount').as('totalDebit'),
      fn.sum<number>('credit_amount').as('totalCredit'),
    ])
    .groupBy('ledger_id')
    .execute();
  const movementByLedger = new Map(movements.map((m) => [m.ledgerId, m]));

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const ledger of ledgers) {
    const openingSigned = ledger.openingBalanceSide === 'CREDIT' ? -ledger.openingBalance : ledger.openingBalance;
    const movement = movementByLedger.get(ledger.ledgerId);
    const netSigned = openingSigned + Number(movement?.totalDebit ?? 0) - Number(movement?.totalCredit ?? 0);

    const debitBalance = netSigned > 0 ? netSigned : 0;
    const creditBalance = netSigned < 0 ? -netSigned : 0;
    totalDebit += debitBalance;
    totalCredit += creditBalance;

    rows.push({
      ledgerId: ledger.ledgerId,
      ledgerName: ledger.ledgerName,
      groupName: ledger.groupName,
      nature: ledger.nature as AccountNature,
      debitBalance,
      creditBalance,
    });
  }

  return { rows, totalDebit, totalCredit };
}
