import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

export const SALARIES_PAYABLE_GROUP = 'Salaries Payable';
export const EMPLOYEE_BENEFIT_OBLIGATIONS_GROUP = 'Employee Benefit Obligations';

export const SALARIES_WAGES_LEDGER = 'Salaries & Wages';
export const EMPLOYER_PF_CONTRIBUTION_LEDGER = 'Employer PF Contribution';
export const EMPLOYER_ESI_CONTRIBUTION_LEDGER = 'Employer ESI Contribution';
export const GRATUITY_EXPENSE_LEDGER = 'Gratuity Expense';
export const PF_PAYABLE_LEDGER = 'PF Payable';
export const ESI_PAYABLE_LEDGER = 'ESI Payable';
export const PT_PAYABLE_LEDGER = 'Professional Tax Payable';
/** Distinct name from core-sales-purchase's existing "TDS Payable" (vendor TDS, sections 194x) — salary TDS (192) needs its own reporting line, same "separate ledger for a separate return line" reasoning GST used for RCM payable. */
export const SALARY_TDS_PAYABLE_LEDGER = 'Salary TDS Payable (192)';
export const GRATUITY_PROVISION_LEDGER = 'Gratuity Provision';

/**
 * Salaries Payable gets its OWN new liability group — a per-employee ledger
 * under it is created lazily by assignSalaryStructure (see salaryStructure.ts),
 * mirroring core-expense's employee-ledger pattern but kept structurally
 * separate from "Employee Reimbursements Payable" (different economic
 * obligation, same reasoning as core-gst-engine's Input Tax Credit group
 * needing its own home rather than reusing Duties & Taxes).
 *
 * Gratuity Provision is a company-wide liability, not a per-employee one —
 * it gets its own new group too, since it's neither a statutory "duty/tax"
 * (Duties & Taxes) nor an expense-reimbursement obligation.
 *
 * The remaining ledgers reuse existing groups: PF/ESI/PT/Salary-TDS payable
 * sit under the existing "Duties & Taxes" liability group (same as vendor
 * TDS and GST output tax); the expense-side ledgers sit under the existing
 * "Indirect Expenses" group (no new expense-nature group needed).
 */
export async function seedPayrollLedgers(companyDb: Kysely<CompanyDatabase>): Promise<void> {
  const currentLiabilitiesGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Current Liabilities').executeTakeFirst();
  if (!currentLiabilitiesGroup) {
    throw new Error('Current Liabilities group not found — seedChartOfAccounts must run before seedPayrollLedgers');
  }
  const dutiesAndTaxesGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Duties & Taxes').executeTakeFirst();
  if (!dutiesAndTaxesGroup) {
    throw new Error('Duties & Taxes group not found — seedChartOfAccounts must run before seedPayrollLedgers');
  }
  const indirectExpensesGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Indirect Expenses').executeTakeFirst();
  if (!indirectExpensesGroup) {
    throw new Error('Indirect Expenses group not found — seedChartOfAccounts must run before seedPayrollLedgers');
  }

  const salariesPayableGroupId = randomUUID();
  await companyDb
    .insertInto('account_group')
    .values({ id: salariesPayableGroupId, name: SALARIES_PAYABLE_GROUP, parent_group_id: currentLiabilitiesGroup.id, nature: 'LIABILITY', is_system_group: 1 })
    .execute();

  const benefitObligationsGroupId = randomUUID();
  await companyDb
    .insertInto('account_group')
    .values({ id: benefitObligationsGroupId, name: EMPLOYEE_BENEFIT_OBLIGATIONS_GROUP, parent_group_id: currentLiabilitiesGroup.id, nature: 'LIABILITY', is_system_group: 1 })
    .execute();

  await companyDb
    .insertInto('ledger_account')
    .values([
      { id: randomUUID(), name: SALARIES_WAGES_LEDGER, group_id: indirectExpensesGroup.id, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
      { id: randomUUID(), name: EMPLOYER_PF_CONTRIBUTION_LEDGER, group_id: indirectExpensesGroup.id, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
      { id: randomUUID(), name: EMPLOYER_ESI_CONTRIBUTION_LEDGER, group_id: indirectExpensesGroup.id, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
      { id: randomUUID(), name: GRATUITY_EXPENSE_LEDGER, group_id: indirectExpensesGroup.id, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
      { id: randomUUID(), name: PF_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: ESI_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: PT_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: SALARY_TDS_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: GRATUITY_PROVISION_LEDGER, group_id: benefitObligationsGroupId, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
    ])
    .execute();
}

async function ledgerIdByName(companyDb: Kysely<CompanyDatabase>, name: string): Promise<string> {
  const row = await companyDb.selectFrom('ledger_account').select('id').where('name', '=', name).executeTakeFirst();
  if (!row) {
    throw new Error(`"${name}" ledger not found — seedPayrollLedgers must run at company creation`);
  }
  return row.id;
}

export interface PayrollLedgerIds {
  salariesWagesLedgerId: string;
  employerPfContributionLedgerId: string;
  employerEsiContributionLedgerId: string;
  gratuityExpenseLedgerId: string;
  pfPayableLedgerId: string;
  esiPayableLedgerId: string;
  ptPayableLedgerId: string;
  salaryTdsPayableLedgerId: string;
  gratuityProvisionLedgerId: string;
}

export async function getPayrollLedgerIds(companyDb: Kysely<CompanyDatabase>): Promise<PayrollLedgerIds> {
  return {
    salariesWagesLedgerId: await ledgerIdByName(companyDb, SALARIES_WAGES_LEDGER),
    employerPfContributionLedgerId: await ledgerIdByName(companyDb, EMPLOYER_PF_CONTRIBUTION_LEDGER),
    employerEsiContributionLedgerId: await ledgerIdByName(companyDb, EMPLOYER_ESI_CONTRIBUTION_LEDGER),
    gratuityExpenseLedgerId: await ledgerIdByName(companyDb, GRATUITY_EXPENSE_LEDGER),
    pfPayableLedgerId: await ledgerIdByName(companyDb, PF_PAYABLE_LEDGER),
    esiPayableLedgerId: await ledgerIdByName(companyDb, ESI_PAYABLE_LEDGER),
    ptPayableLedgerId: await ledgerIdByName(companyDb, PT_PAYABLE_LEDGER),
    salaryTdsPayableLedgerId: await ledgerIdByName(companyDb, SALARY_TDS_PAYABLE_LEDGER),
    gratuityProvisionLedgerId: await ledgerIdByName(companyDb, GRATUITY_PROVISION_LEDGER),
  };
}

/** Looks up (creating if needed) this employee's own dedicated "Salaries Payable"-group ledger — called lazily by assignSalaryStructure, mirroring core-expense's atomic employee+ledger pattern but deferred until payroll actually starts for this employee. */
export async function ensureEmployeeSalaryPayableLedger(companyDb: Kysely<CompanyDatabase>, employeeId: string): Promise<string> {
  const employee = await companyDb.selectFrom('employee').select(['id', 'name', 'salary_payable_ledger_id']).where('id', '=', employeeId).executeTakeFirst();
  if (!employee) {
    throw new Error('Employee not found');
  }
  if (employee.salary_payable_ledger_id) {
    return employee.salary_payable_ledger_id;
  }

  const group = await companyDb.selectFrom('account_group').select('id').where('name', '=', SALARIES_PAYABLE_GROUP).executeTakeFirstOrThrow();
  const ledgerId = randomUUID();
  await companyDb
    .insertInto('ledger_account')
    .values({ id: ledgerId, name: `${employee.name} — Salary Payable`, group_id: group.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 0 })
    .execute();
  await companyDb.updateTable('employee').set({ salary_payable_ledger_id: ledgerId }).where('id', '=', employeeId).execute();
  return ledgerId;
}
