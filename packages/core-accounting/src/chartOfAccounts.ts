import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { AccountGroupSummary, AccountNature, LedgerAccountSummary } from './types';

export const ACCOUNTING_PERMISSIONS = [
  { code: 'ACCOUNTING.MANAGE_CHART_OF_ACCOUNTS', description: 'Create and edit ledger accounts and groups' },
  { code: 'ACCOUNTING.CREATE_VOUCHER', description: 'Create journal, payment, receipt and contra vouchers' },
  { code: 'ACCOUNTING.VIEW_REPORTS', description: 'View Trial Balance and other financial reports' },
  { code: 'ACCOUNTING.MANAGE_COST_CENTRES', description: 'Create and edit cost centres' },
  { code: 'ACCOUNTING.MANAGE_BUDGETS', description: 'Create budgets and view budget vs actual reports' },
  { code: 'ACCOUNTING.MANAGE_BRANCHES', description: 'Create branches and record inter-branch transfers' },
] as const;

/** Grants this module's own permissions to a role — called alongside @mhts/core-identity's seedAdminRole at company creation, same pattern each business module follows as it's added. */
export async function grantAccountingPermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of ACCOUNTING_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb
      .insertInto('permission')
      .values({ id: permissionId, code: permission.code, description: permission.description })
      .execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}

interface GroupSeed {
  name: string;
  nature: AccountNature;
  children?: GroupSeed[];
}

/** Standard Indian default groups — Tally-familiar, not exhaustive. Businesses add their own alongside these. */
const DEFAULT_GROUPS: GroupSeed[] = [
  { name: 'Capital Account', nature: 'EQUITY' },
  { name: 'Loans (Liability)', nature: 'LIABILITY' },
  {
    name: 'Current Liabilities',
    nature: 'LIABILITY',
    children: [
      { name: 'Sundry Creditors', nature: 'LIABILITY' },
      { name: 'Duties & Taxes', nature: 'LIABILITY' },
    ],
  },
  {
    name: 'Fixed Assets',
    nature: 'ASSET',
    // Phase 8: asset classes get their own gross-block ledger here, and their
    // own accumulated-depreciation (contra-asset) ledger below — both under
    // Fixed Assets so Gross Block - Accumulated Depreciation = Net Block
    // reads correctly on the Balance Sheet without any change to
    // computeLedgerBalances (a credit-natural ledger under an ASSET group
    // simply nets negative, which is exactly the contra-asset behavior).
    children: [{ name: 'Accumulated Depreciation', nature: 'ASSET' }],
  },
  {
    name: 'Current Assets',
    nature: 'ASSET',
    children: [
      { name: 'Cash-in-Hand', nature: 'ASSET' },
      { name: 'Bank Accounts', nature: 'ASSET' },
      { name: 'Sundry Debtors', nature: 'ASSET' },
    ],
  },
  { name: 'Direct Income', nature: 'INCOME', children: [{ name: 'Sales Accounts', nature: 'INCOME' }] },
  { name: 'Indirect Income', nature: 'INCOME' },
  { name: 'Direct Expenses', nature: 'EXPENSE', children: [{ name: 'Purchase Accounts', nature: 'EXPENSE' }] },
  { name: 'Indirect Expenses', nature: 'EXPENSE' },
  // Phase 8 Increment 2: each branch gets its own dedicated ledger here (see
  // branches.ts's createBranch) — a real branch-accounting current-account
  // mechanism (see interBranchTransfer.ts), allowed to swing debit/credit
  // like Accumulated Depreciation above.
  { name: 'Inter-Branch Accounts', nature: 'ASSET' },
];

/** Seeds the default Chart of Accounts (groups + a Cash ledger every business needs) at company creation. */
export async function seedChartOfAccounts(companyDb: Kysely<CompanyDatabase>): Promise<void> {
  const groupIdByName = new Map<string, string>();

  async function insertGroup(seed: GroupSeed, parentGroupId: string | null): Promise<void> {
    const id = randomUUID();
    await companyDb
      .insertInto('account_group')
      .values({ id, name: seed.name, parent_group_id: parentGroupId, nature: seed.nature, is_system_group: 1 })
      .execute();
    groupIdByName.set(seed.name, id);
    for (const child of seed.children ?? []) {
      await insertGroup(child, id);
    }
  }

  for (const seed of DEFAULT_GROUPS) {
    await insertGroup(seed, null);
  }

  const cashInHandGroupId = groupIdByName.get('Cash-in-Hand');
  if (cashInHandGroupId) {
    await companyDb
      .insertInto('ledger_account')
      .values({
        id: randomUUID(),
        name: 'Cash',
        group_id: cashInHandGroupId,
        opening_balance: 0,
        opening_balance_side: 'DEBIT',
        is_system_ledger: 1,
      })
      .execute();
  }
}

export async function listAccountGroups(companyDb: Kysely<CompanyDatabase>): Promise<AccountGroupSummary[]> {
  const rows = await companyDb.selectFrom('account_group').selectAll().orderBy('name').execute();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    parentGroupId: row.parent_group_id,
    nature: row.nature as AccountNature,
    isSystemGroup: Boolean(row.is_system_group),
  }));
}

export async function listLedgerAccounts(companyDb: Kysely<CompanyDatabase>): Promise<LedgerAccountSummary[]> {
  const rows = await companyDb
    .selectFrom('ledger_account')
    .innerJoin('account_group', 'account_group.id', 'ledger_account.group_id')
    .select([
      'ledger_account.id as id',
      'ledger_account.name as name',
      'ledger_account.group_id as groupId',
      'account_group.name as groupName',
      'account_group.nature as nature',
      'ledger_account.opening_balance as openingBalance',
      'ledger_account.opening_balance_side as openingBalanceSide',
      'ledger_account.is_system_ledger as isSystemLedger',
    ])
    .orderBy('ledger_account.name')
    .execute();
  return rows.map((row) => ({
    ...row,
    nature: row.nature as AccountNature,
    openingBalanceSide: row.openingBalanceSide as LedgerAccountSummary['openingBalanceSide'],
    isSystemLedger: Boolean(row.isSystemLedger),
  }));
}

export interface CreateLedgerAccountInput {
  name: string;
  groupId: string;
  openingBalance: number;
  openingBalanceSide: 'DEBIT' | 'CREDIT';
}

export async function createLedgerAccount(companyDb: Kysely<CompanyDatabase>, input: CreateLedgerAccountInput): Promise<string> {
  const group = await companyDb.selectFrom('account_group').select('id').where('id', '=', input.groupId).executeTakeFirst();
  if (!group) {
    throw new Error('Account group not found');
  }
  if (!input.name.trim()) {
    throw new Error('Ledger name is required');
  }
  if (input.openingBalance < 0) {
    throw new Error('Opening balance cannot be negative — use the opposite side instead');
  }

  const id = randomUUID();
  await companyDb
    .insertInto('ledger_account')
    .values({
      id,
      name: input.name.trim(),
      group_id: input.groupId,
      opening_balance: input.openingBalance,
      opening_balance_side: input.openingBalanceSide,
      is_system_ledger: 0,
    })
    .execute();
  return id;
}
