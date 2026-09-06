import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { computeLedgerBalances } from '@mhts/core-accounting';
import { ACCOUNT_TYPES } from './types';
import type { AccountType, BankAccountSummary, CreateBankAccountInput } from './types';

const BANK_ACCOUNTS_GROUP_NAME = 'Bank Accounts';

/**
 * Creates a bank account and its own dedicated ledger atomically — same
 * pattern as core-sales-purchase's createParty: the bank account can't
 * exist without a ledger to post vouchers against, and vice versa. The
 * ledger's own balance IS this bank account's book balance, so
 * computeLedgerBalances needs zero changes for reconciliation.
 */
export async function createBankAccount(companyDb: Kysely<CompanyDatabase>, input: CreateBankAccountInput, actorUserId: string | null): Promise<string> {
  if (!ACCOUNT_TYPES.includes(input.accountType)) {
    throw new Error(`Unknown bank account type: ${input.accountType}`);
  }
  const name = input.name.trim();
  if (!name) {
    throw new Error('Bank account name is required');
  }
  if (!input.accountNumber.trim() || !input.ifscCode.trim() || !input.bankName.trim()) {
    throw new Error('Account number, IFSC code and bank name are required');
  }

  const group = await companyDb.selectFrom('account_group').select('id').where('name', '=', BANK_ACCOUNTS_GROUP_NAME).executeTakeFirstOrThrow();

  const bankAccountId = randomUUID();
  const ledgerId = randomUUID();
  const openingBalance = input.openingBalance ?? 0;
  const openingBalanceSide = input.openingBalanceSide ?? 'DEBIT';

  await companyDb.transaction().execute(async (trx) => {
    await trx
      .insertInto('ledger_account')
      .values({
        id: ledgerId,
        name,
        group_id: group.id,
        opening_balance: openingBalance,
        opening_balance_side: openingBalanceSide,
        is_system_ledger: 0,
      })
      .execute();

    await trx
      .insertInto('bank_account')
      .values({
        id: bankAccountId,
        ledger_account_id: ledgerId,
        account_number: input.accountNumber.trim(),
        ifsc_code: input.ifscCode.trim(),
        bank_name: input.bankName.trim(),
        branch_name: input.branchName?.trim() ?? null,
        account_type: input.accountType,
        is_active: 1,
      })
      .execute();

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'BankAccount',
      entityId: bankAccountId,
      afterData: { name, accountNumber: input.accountNumber.trim(), bankName: input.bankName.trim(), accountType: input.accountType },
    });
  });

  return bankAccountId;
}

export async function listBankAccounts(companyDb: Kysely<CompanyDatabase>): Promise<BankAccountSummary[]> {
  const rows = await companyDb
    .selectFrom('bank_account')
    .innerJoin('ledger_account', 'ledger_account.id', 'bank_account.ledger_account_id')
    .select([
      'bank_account.id as id',
      'bank_account.ledger_account_id as ledgerAccountId',
      'ledger_account.name as ledgerName',
      'bank_account.account_number as accountNumber',
      'bank_account.ifsc_code as ifscCode',
      'bank_account.bank_name as bankName',
      'bank_account.branch_name as branchName',
      'bank_account.account_type as accountType',
      'bank_account.is_active as isActive',
    ])
    .orderBy('ledger_account.name')
    .execute();

  if (rows.length === 0) {
    return [];
  }

  const balances = await computeLedgerBalances(companyDb, { natures: ['ASSET'] });
  const balanceByLedger = new Map(balances.map((row) => [row.ledgerId, row.netSigned]));

  return rows.map((row) => ({
    id: row.id,
    ledgerAccountId: row.ledgerAccountId,
    ledgerName: row.ledgerName,
    accountNumber: row.accountNumber,
    ifscCode: row.ifscCode,
    bankName: row.bankName,
    branchName: row.branchName,
    accountType: row.accountType as AccountType,
    isActive: Boolean(row.isActive),
    currentBalance: balanceByLedger.get(row.ledgerAccountId) ?? 0,
  }));
}

export async function getBankAccountByLedgerId(companyDb: Kysely<CompanyDatabase>, ledgerAccountId: string) {
  return companyDb.selectFrom('bank_account').selectAll().where('ledger_account_id', '=', ledgerAccountId).executeTakeFirst();
}
