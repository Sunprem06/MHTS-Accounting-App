import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { DOCUMENT_LAYOUTS } from './types';
import type { CompanyLetterheadProfileSummary, DocumentLayout, UpdateCompanyLetterheadProfileInput } from './types';

/** Singleton row, fixed id — every company gets exactly one, same pattern as core-payroll-engine's company_payroll_settings. Seeded at company creation. */
const PROFILE_ROW_ID = 'company_letterhead_profile';

export async function seedDefaultCompanyLetterheadProfile(companyDb: Kysely<CompanyDatabase>): Promise<void> {
  await companyDb
    .insertInto('company_letterhead_profile')
    .values({
      id: PROFILE_ROW_ID,
      address: null,
      phone: null,
      email: null,
      website: null,
      bank_account_name: null,
      bank_account_number: null,
      bank_ifsc: null,
      bank_name: null,
      bank_branch: null,
      footer_note: null,
      logo_data: null,
      logo_mime_type: null,
      invoice_layout: 'CLASSIC',
      payslip_layout: 'CLASSIC',
      accent_color_hex: null,
      updated_by: null,
    })
    .execute();
}

function toSummary(row: {
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  footer_note: string | null;
  logo_data: Buffer | null;
  invoice_layout: string;
  payslip_layout: string;
  accent_color_hex: string | null;
  updated_at: string;
}): CompanyLetterheadProfileSummary {
  return {
    address: row.address,
    phone: row.phone,
    email: row.email,
    website: row.website,
    bankAccountName: row.bank_account_name,
    bankAccountNumber: row.bank_account_number,
    bankIfsc: row.bank_ifsc,
    bankName: row.bank_name,
    bankBranch: row.bank_branch,
    footerNote: row.footer_note,
    hasLogo: row.logo_data !== null,
    invoiceLayout: row.invoice_layout as DocumentLayout,
    payslipLayout: row.payslip_layout as DocumentLayout,
    accentColorHex: row.accent_color_hex,
    updatedAt: row.updated_at,
  };
}

export async function getCompanyLetterheadProfile(companyDb: Kysely<CompanyDatabase>): Promise<CompanyLetterheadProfileSummary> {
  const row = await companyDb.selectFrom('company_letterhead_profile').selectAll().where('id', '=', PROFILE_ROW_ID).executeTakeFirst();
  if (!row) {
    throw new Error('Company letterhead profile not found — seedDefaultCompanyLetterheadProfile must run at company creation');
  }
  return toSummary(row);
}

/** For the print pipeline only — the logo bytes never cross into the display summary above (kept a separate lookup so a print job is the only caller that pays for loading a potentially large blob). */
export async function getCompanyLogo(companyDb: Kysely<CompanyDatabase>): Promise<{ data: Buffer; mimeType: string } | null> {
  const row = await companyDb.selectFrom('company_letterhead_profile').select(['logo_data', 'logo_mime_type']).where('id', '=', PROFILE_ROW_ID).executeTakeFirst();
  if (!row || !row.logo_data || !row.logo_mime_type) {
    return null;
  }
  return { data: row.logo_data, mimeType: row.logo_mime_type };
}

export async function updateCompanyLetterheadProfile(companyDb: Kysely<CompanyDatabase>, input: UpdateCompanyLetterheadProfileInput, actorUserId: string | null): Promise<void> {
  if (input.invoiceLayout && !DOCUMENT_LAYOUTS.includes(input.invoiceLayout)) {
    throw new Error(`Unknown invoice layout: ${input.invoiceLayout}`);
  }
  if (input.payslipLayout && !DOCUMENT_LAYOUTS.includes(input.payslipLayout)) {
    throw new Error(`Unknown payslip layout: ${input.payslipLayout}`);
  }

  await companyDb
    .updateTable('company_letterhead_profile')
    .set({
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.bankAccountName !== undefined ? { bank_account_name: input.bankAccountName } : {}),
      ...(input.bankAccountNumber !== undefined ? { bank_account_number: input.bankAccountNumber } : {}),
      ...(input.bankIfsc !== undefined ? { bank_ifsc: input.bankIfsc } : {}),
      ...(input.bankName !== undefined ? { bank_name: input.bankName } : {}),
      ...(input.bankBranch !== undefined ? { bank_branch: input.bankBranch } : {}),
      ...(input.footerNote !== undefined ? { footer_note: input.footerNote } : {}),
      ...(input.invoiceLayout !== undefined ? { invoice_layout: input.invoiceLayout } : {}),
      ...(input.payslipLayout !== undefined ? { payslip_layout: input.payslipLayout } : {}),
      ...(input.accentColorHex !== undefined ? { accent_color_hex: input.accentColorHex } : {}),
      updated_by: actorUserId,
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', PROFILE_ROW_ID)
    .execute();

  await writeAuditLog(companyDb, { actorUserId, action: 'UPDATE', entityType: 'CompanyLetterheadProfile', entityId: PROFILE_ROW_ID, afterData: input as Record<string, unknown> });
}

export async function setCompanyLogo(companyDb: Kysely<CompanyDatabase>, logoData: Buffer, mimeType: string, actorUserId: string | null): Promise<void> {
  await companyDb
    .updateTable('company_letterhead_profile')
    .set({ logo_data: logoData, logo_mime_type: mimeType, updated_by: actorUserId, updated_at: new Date().toISOString() })
    .where('id', '=', PROFILE_ROW_ID)
    .execute();
  await writeAuditLog(companyDb, { actorUserId, action: 'UPDATE', entityType: 'CompanyLetterheadProfile', entityId: PROFILE_ROW_ID, afterData: { logo: 'replaced', mimeType } });
}

export async function clearCompanyLogo(companyDb: Kysely<CompanyDatabase>, actorUserId: string | null): Promise<void> {
  await companyDb
    .updateTable('company_letterhead_profile')
    .set({ logo_data: null, logo_mime_type: null, updated_by: actorUserId, updated_at: new Date().toISOString() })
    .where('id', '=', PROFILE_ROW_ID)
    .execute();
  await writeAuditLog(companyDb, { actorUserId, action: 'UPDATE', entityType: 'CompanyLetterheadProfile', entityId: PROFILE_ROW_ID, afterData: { logo: 'cleared' } });
}
