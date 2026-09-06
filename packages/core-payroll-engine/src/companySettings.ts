import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { ApplicabilityMode, CompanyPayrollSettingsSummary, TdsRegime, UpdateCompanyPayrollSettingsInput } from './types';

/** Singleton row, fixed id — every company gets exactly one. Seeded at company creation (see index.ts's seedDefaultCompanyPayrollSettings, called from createCompany alongside seedPayrollLedgers). */
const SETTINGS_ROW_ID = 'company_payroll_settings';

export async function seedDefaultCompanyPayrollSettings(companyDb: Kysely<CompanyDatabase>): Promise<void> {
  await companyDb
    .insertInto('company_payroll_settings')
    .values({ id: SETTINGS_ROW_ID, pf_applicability: 'AUTO', esi_applicability: 'AUTO', gratuity_applicability: 'AUTO', pt_jurisdiction: null, tds_regime: 'NEW' })
    .execute();
}

export async function getCompanyPayrollSettings(companyDb: Kysely<CompanyDatabase>): Promise<CompanyPayrollSettingsSummary> {
  const row = await companyDb.selectFrom('company_payroll_settings').selectAll().where('id', '=', SETTINGS_ROW_ID).executeTakeFirst();
  if (!row) {
    throw new Error('Company payroll settings not found — seedDefaultCompanyPayrollSettings must run at company creation');
  }
  return {
    pfApplicability: row.pf_applicability as ApplicabilityMode,
    esiApplicability: row.esi_applicability as ApplicabilityMode,
    gratuityApplicability: row.gratuity_applicability as ApplicabilityMode,
    ptJurisdiction: row.pt_jurisdiction,
    tdsRegime: row.tds_regime as TdsRegime,
  };
}

export async function updateCompanyPayrollSettings(companyDb: Kysely<CompanyDatabase>, input: UpdateCompanyPayrollSettingsInput): Promise<void> {
  await companyDb
    .updateTable('company_payroll_settings')
    .set({
      ...(input.pfApplicability !== undefined ? { pf_applicability: input.pfApplicability } : {}),
      ...(input.esiApplicability !== undefined ? { esi_applicability: input.esiApplicability } : {}),
      ...(input.gratuityApplicability !== undefined ? { gratuity_applicability: input.gratuityApplicability } : {}),
      ...(input.ptJurisdiction !== undefined ? { pt_jurisdiction: input.ptJurisdiction } : {}),
      ...(input.tdsRegime !== undefined ? { tds_regime: input.tdsRegime } : {}),
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', SETTINGS_ROW_ID)
    .execute();
}

/** Flips gratuity_applicability from AUTO to the sticky ALWAYS once the company has genuinely crossed the Payment of Gratuity Act's headcount threshold — called by applicability.ts whenever it resolves gratuity applicability, so the "once applicable, always applicable" rule survives a later headcount drop without needing to be recomputed fresh every run. Never overwrites an explicit ALWAYS/NEVER a user already set. */
export async function stickGratuityApplicabilityIfCrossed(companyDb: Kysely<CompanyDatabase>): Promise<void> {
  const row = await companyDb.selectFrom('company_payroll_settings').select('gratuity_applicability').where('id', '=', SETTINGS_ROW_ID).executeTakeFirst();
  if (row?.gratuity_applicability === 'AUTO') {
    await companyDb.updateTable('company_payroll_settings').set({ gratuity_applicability: 'ALWAYS' }).where('id', '=', SETTINGS_ROW_ID).execute();
  }
}
