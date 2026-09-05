import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { AccountNature } from './types';

export interface LedgerBalanceRow {
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  nature: AccountNature;
  /** Debit-positive signed balance: (opening, if included) + debit movements - credit movements, within any given date bounds. */
  netSigned: number;
}

export interface LedgerBalanceOptions {
  natures?: readonly AccountNature[];
  /** Voucher date lower bound (inclusive). Omit for "since inception." */
  fromDate?: string;
  /** Voucher date upper bound (inclusive). Omit for "up to the latest voucher." */
  toDate?: string;
  /** Default true. Income/Expense reports (P&L) want this false — those ledgers aren't meant to carry an opening balance across periods. */
  includeOpening?: boolean;
}

/**
 * Shared by Trial Balance, Profit & Loss, and Balance Sheet — all three are
 * "sum this ledger's movements within some date bound, signed debit-positive"
 * with different nature filters and date bounds layered on top.
 */
export async function computeLedgerBalances(
  companyDb: Kysely<CompanyDatabase>,
  options: LedgerBalanceOptions = {},
): Promise<LedgerBalanceRow[]> {
  const includeOpening = options.includeOpening ?? true;

  let ledgerQuery = companyDb
    .selectFrom('ledger_account')
    .innerJoin('account_group', 'account_group.id', 'ledger_account.group_id')
    .select([
      'ledger_account.id as ledgerId',
      'ledger_account.name as ledgerName',
      'account_group.name as groupName',
      'account_group.nature as nature',
      'ledger_account.opening_balance as openingBalance',
      'ledger_account.opening_balance_side as openingBalanceSide',
    ]);
  if (options.natures) {
    ledgerQuery = ledgerQuery.where('account_group.nature', 'in', options.natures as AccountNature[]);
  }
  const ledgers = await ledgerQuery.orderBy('ledger_account.name').execute();

  let movementQuery = companyDb
    .selectFrom('voucher_line')
    .innerJoin('voucher', 'voucher.id', 'voucher_line.voucher_id')
    .select(({ fn }) => [
      'voucher_line.ledger_id as ledgerId',
      fn.sum<number>('voucher_line.debit_amount').as('totalDebit'),
      fn.sum<number>('voucher_line.credit_amount').as('totalCredit'),
    ])
    .groupBy('voucher_line.ledger_id');
  if (options.fromDate) {
    movementQuery = movementQuery.where('voucher.voucher_date', '>=', options.fromDate);
  }
  if (options.toDate) {
    movementQuery = movementQuery.where('voucher.voucher_date', '<=', options.toDate);
  }
  const movements = await movementQuery.execute();
  const movementByLedger = new Map(movements.map((m) => [m.ledgerId, m]));

  return ledgers.map((ledger) => {
    const openingSigned = includeOpening
      ? ledger.openingBalanceSide === 'CREDIT'
        ? -ledger.openingBalance
        : ledger.openingBalance
      : 0;
    const movement = movementByLedger.get(ledger.ledgerId);
    const netSigned = openingSigned + Number(movement?.totalDebit ?? 0) - Number(movement?.totalCredit ?? 0);

    return {
      ledgerId: ledger.ledgerId,
      ledgerName: ledger.ledgerName,
      groupName: ledger.groupName,
      nature: ledger.nature as AccountNature,
      netSigned,
    };
  });
}
