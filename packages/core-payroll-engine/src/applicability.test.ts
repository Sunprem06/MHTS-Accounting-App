import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb, createTempSystemDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { seedChartOfAccounts, listAccountGroups, createLedgerAccount } from '@mhts/core-accounting';
import { resolveApplicability } from './applicability';
import { seedDefaultPayrollRules } from './rules';
import { seedDefaultCompanyPayrollSettings, updateCompanyPayrollSettings } from './companySettings';

// employee.ledger_account_id is UNIQUE — each employee gets its own dedicated
// ledger (same "own dedicated ledger" pattern as parties/bank accounts), so a
// fixture inserting N employees needs N distinct ledger accounts, not one shared one.
async function insertEmployees(companyDb: Kysely<CompanyDatabase>, count: number, groupId: string): Promise<void> {
  for (let i = 0; i < count; i++) {
    const ledgerAccountId = await createLedgerAccount(companyDb, {
      name: `Employee ${randomUUID()} Reimbursements Payable`,
      groupId,
      openingBalance: 0,
      openingBalanceSide: 'CREDIT',
    });
    await companyDb
      .insertInto('employee')
      .values({
        id: randomUUID(),
        employee_code: `EMP-${i}`,
        name: `Employee ${i}`,
        department: null,
        ledger_account_id: ledgerAccountId,
        is_active: 1 as unknown as boolean,
        date_of_birth: null,
        date_of_joining: '2020-01-01',
        date_of_leaving: null,
        employment_type: 'PERMANENT',
        pan: null,
        bank_account_number: null,
        bank_ifsc: null,
        uan: null,
        esi_number: null,
        salary_payable_ledger_id: null,
        designation: null,
      })
      .execute();
  }
}

/**
 * Headcount-driven applicability is the highest-complexity, least-obvious
 * piece of the payroll module: PF needs 20+, ESI/Gratuity need 10+, each
 * independently AUTO/ALWAYS/NEVER-configurable, and gratuity's AUTO mode is
 * sticky (once crossed, stays applicable even if headcount later drops) —
 * exactly the scenario the Phase 7 session's own throwaway script verified
 * manually. This persists that same scenario for real.
 */
describe('core-payroll-engine: resolveApplicability (headcount thresholds + sticky gratuity)', () => {
  let companyHandle: TempDbHandle<CompanyDatabase>;
  let systemHandle: TempDbHandle<SystemDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let systemDb: Kysely<SystemDatabase>;
  let groupId: string;

  beforeEach(async () => {
    companyHandle = await createTempCompanyDb();
    systemHandle = await createTempSystemDb();
    companyDb = companyHandle.db;
    systemDb = systemHandle.db;

    await seedChartOfAccounts(companyDb);
    await seedDefaultCompanyPayrollSettings(companyDb);
    await seedDefaultPayrollRules(systemDb);

    const groups = await listAccountGroups(companyDb);
    groupId = groups.find((g) => g.nature === 'LIABILITY')!.id;
  });

  afterEach(async () => {
    await companyHandle.close();
    await systemHandle.close();
  });

  it('below every threshold (1 employee): PF/ESI/Gratuity all inapplicable under AUTO', async () => {
    await insertEmployees(companyDb, 1, groupId);
    const result = await resolveApplicability(companyDb, systemDb, '2026-01-01');
    expect(result.activeEmployeeCount).toBe(1);
    expect(result.pfApplies).toBe(false);
    expect(result.esiApplies).toBe(false);
    expect(result.gratuityApplies).toBe(false);
  });

  it('at exactly 10 employees: ESI/Gratuity become applicable, PF still is not (needs 20)', async () => {
    await insertEmployees(companyDb, 10, groupId);
    const result = await resolveApplicability(companyDb, systemDb, '2026-01-01');
    expect(result.pfApplies).toBe(false);
    expect(result.esiApplies).toBe(true);
    expect(result.gratuityApplies).toBe(true);
  });

  it('at exactly 20 employees: all three become applicable', async () => {
    await insertEmployees(companyDb, 20, groupId);
    const result = await resolveApplicability(companyDb, systemDb, '2026-01-01');
    expect(result.pfApplies).toBe(true);
    expect(result.esiApplies).toBe(true);
    expect(result.gratuityApplies).toBe(true);
  });

  it('sticky gratuity: once crossed at 10+ employees, stays applicable even after headcount later drops back below 10', async () => {
    await insertEmployees(companyDb, 10, groupId);
    const crossed = await resolveApplicability(companyDb, systemDb, '2026-01-01');
    expect(crossed.gratuityApplies).toBe(true);

    // Headcount drops: deactivate 5 employees, leaving 5 active.
    const someEmployees = await companyDb.selectFrom('employee').select('id').limit(5).execute();
    for (const emp of someEmployees) {
      await companyDb.updateTable('employee').set({ is_active: 0 as unknown as boolean }).where('id', '=', emp.id).execute();
    }

    const afterDrop = await resolveApplicability(companyDb, systemDb, '2026-01-01');
    expect(afterDrop.activeEmployeeCount).toBe(5); // genuinely below the 10-employee AUTO threshold now
    expect(afterDrop.gratuityApplies).toBe(true); // but still applicable — the sticky rule survived the drop
    expect(afterDrop.esiApplies).toBe(false); // ESI has no sticky rule — correctly turns back off
  });

  it('an explicit ALWAYS setting applies regardless of headcount', async () => {
    await updateCompanyPayrollSettings(companyDb, { pfApplicability: 'ALWAYS' });
    await insertEmployees(companyDb, 1, groupId);
    const result = await resolveApplicability(companyDb, systemDb, '2026-01-01');
    expect(result.pfApplies).toBe(true);
  });

  it('an explicit NEVER setting overrides even a headcount that would otherwise trigger AUTO', async () => {
    await updateCompanyPayrollSettings(companyDb, { esiApplicability: 'NEVER' });
    await insertEmployees(companyDb, 20, groupId);
    const result = await resolveApplicability(companyDb, systemDb, '2026-01-01');
    expect(result.esiApplies).toBe(false);
  });
});
