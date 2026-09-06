import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export const EMPLOYEE_REIMBURSEMENTS_GROUP = 'Employee Reimbursements Payable';

const DEFAULT_EXPENSE_LEDGERS = ['Travel & Conveyance', 'Staff Welfare', 'Office Supplies', 'Communication Expenses', 'Miscellaneous Expenses'];

/**
 * Employee reimbursements are a liability (the company owes the employee
 * until paid) — the opposite economic direction from an expense, so they
 * need their own new "Employee Reimbursements Payable" group under Current
 * Liabilities rather than being lumped into an EXPENSE-nature group. No
 * existing Current Liabilities sub-group (Sundry Creditors, Duties & Taxes)
 * fits, so this is a genuinely new group — directly mirrors core-gst-engine's
 * seedGstLedgers, which already established the precedent of a later-phase
 * package inserting a brand-new account_group row (its "Input Tax Credit"
 * group under Current Assets).
 *
 * chartOfAccounts.ts's DEFAULT_GROUPS seeds zero default ledgers under either
 * EXPENSE-nature group (Direct Expenses/Indirect Expenses), so a handful of
 * common expense-claim categories are seeded here too — required, not
 * optional, since without them there would be nothing to pick from an
 * expense claim line.
 */
export async function seedExpenseLedgers(companyDb: Kysely<CompanyDatabase>): Promise<void> {
  const currentLiabilitiesGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Current Liabilities').executeTakeFirst();
  if (!currentLiabilitiesGroup) {
    throw new Error('Current Liabilities group not found — seedChartOfAccounts must run before seedExpenseLedgers');
  }
  const indirectExpensesGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Indirect Expenses').executeTakeFirst();
  if (!indirectExpensesGroup) {
    throw new Error('Indirect Expenses group not found — seedChartOfAccounts must run before seedExpenseLedgers');
  }

  const employeeReimbursementsGroupId = randomUUID();
  await companyDb
    .insertInto('account_group')
    .values({ id: employeeReimbursementsGroupId, name: EMPLOYEE_REIMBURSEMENTS_GROUP, parent_group_id: currentLiabilitiesGroup.id, nature: 'LIABILITY', is_system_group: 1 })
    .execute();

  await companyDb
    .insertInto('ledger_account')
    .values(
      DEFAULT_EXPENSE_LEDGERS.map((name) => ({
        id: randomUUID(),
        name,
        group_id: indirectExpensesGroup.id,
        opening_balance: 0,
        opening_balance_side: 'DEBIT' as const,
        is_system_ledger: 1,
      })),
    )
    .execute();
}
