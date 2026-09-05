import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { writeAuditLog } from '@mhts/core-audit';
import { PARTY_TYPES } from './types';
import type { BusinessPartySummary, CreatePartyInput, PartyType } from './types';

export const SALES_PURCHASE_PERMISSIONS = [
  { code: 'SALES.MANAGE_PARTIES', description: 'Create and edit customers and suppliers' },
  { code: 'SALES.CREATE_INVOICE', description: 'Create and cancel sales invoices' },
  { code: 'SALES.CREATE_ORDER', description: 'Create, confirm and convert sales orders' },
  { code: 'PURCHASE.CREATE_INVOICE', description: 'Create and cancel purchase invoices' },
  { code: 'PURCHASE.CREATE_ORDER', description: 'Create, confirm and convert purchase orders' },
  { code: 'SALES.VIEW_REPORTS', description: 'View receivables and sales registers' },
  { code: 'PURCHASE.VIEW_REPORTS', description: 'View payables, MSME ageing and purchase registers' },
] as const;

/** Same pattern as core-accounting's grantAccountingPermissions — each module owns and grants its own permission codes. */
export async function grantSalesPurchasePermissions(companyDb: Kysely<CompanyDatabase>, roleId: string): Promise<void> {
  for (const permission of SALES_PURCHASE_PERMISSIONS) {
    const permissionId = randomUUID();
    await companyDb
      .insertInto('permission')
      .values({ id: permissionId, code: permission.code, description: permission.description })
      .execute();
    await companyDb.insertInto('role_permission').values({ role_id: roleId, permission_id: permissionId }).execute();
  }
}

/**
 * Seeds a "TDS Payable" ledger under the Duties & Taxes group Phase 1
 * already creates by default — called once at company creation, alongside
 * seedChartOfAccounts. No new default account groups are needed for Phase 2:
 * Sundry Debtors/Sundry Creditors/Duties & Taxes/Sales Accounts/Purchase
 * Accounts already exist.
 */
export async function seedSalesPurchaseLedgers(companyDb: Kysely<CompanyDatabase>): Promise<void> {
  const dutiesAndTaxesGroup = await companyDb
    .selectFrom('account_group')
    .select('id')
    .where('name', '=', 'Duties & Taxes')
    .executeTakeFirst();
  if (!dutiesAndTaxesGroup) {
    throw new Error('Duties & Taxes group not found — seedChartOfAccounts must run before seedSalesPurchaseLedgers');
  }

  await companyDb
    .insertInto('ledger_account')
    .values({
      id: randomUUID(),
      name: 'TDS Payable',
      group_id: dutiesAndTaxesGroup.id,
      opening_balance: 0,
      opening_balance_side: 'CREDIT',
      is_system_ledger: 1,
    })
    .execute();
}

function partyGroupName(partyType: PartyType): 'Sundry Debtors' | 'Sundry Creditors' {
  // BOTH parties get a receivable-side ledger by default; nothing stops a business
  // from also tracking them as a supplier via the same outstanding-balance ledger —
  // splitting a BOTH party into two ledgers is a real feature (separate AR/AP legs)
  // but out of scope for this pass.
  return partyType === 'SUPPLIER' ? 'Sundry Creditors' : 'Sundry Debtors';
}

/** Creates a party and its own dedicated sub-ledger (under Sundry Debtors/Creditors) atomically — the party can't exist without a ledger to post invoices against, and vice versa. */
export async function createParty(companyDb: Kysely<CompanyDatabase>, input: CreatePartyInput, actorUserId: string | null): Promise<string> {
  if (!PARTY_TYPES.includes(input.partyType)) {
    throw new Error(`Unknown party type: ${input.partyType}`);
  }
  const name = input.name.trim();
  if (!name) {
    throw new Error('Party name is required');
  }

  const groupName = partyGroupName(input.partyType);
  const group = await companyDb.selectFrom('account_group').select('id').where('name', '=', groupName).executeTakeFirstOrThrow();

  const partyId = randomUUID();
  const ledgerId = randomUUID();

  await companyDb.transaction().execute(async (trx) => {
    await trx
      .insertInto('ledger_account')
      .values({
        id: ledgerId,
        name,
        group_id: group.id,
        opening_balance: 0,
        opening_balance_side: 'DEBIT',
        is_system_ledger: 0,
      })
      .execute();

    await trx
      .insertInto('business_party')
      .values({
        id: partyId,
        party_type: input.partyType,
        name,
        gstin: input.gstin ?? null,
        state_code: input.stateCode ?? null,
        is_msme_udyam_registered: input.isMsmeUdyamRegistered ? 1 : 0,
        udyam_registration_number: input.udyamRegistrationNumber ?? null,
        credit_period_days: input.creditPeriodDays ?? null,
        ledger_account_id: ledgerId,
        is_active: 1,
      })
      .execute();

    await writeAuditLog(trx, {
      actorUserId,
      action: 'CREATE',
      entityType: 'BusinessParty',
      entityId: partyId,
      afterData: { partyType: input.partyType, name, gstin: input.gstin ?? null, isMsmeUdyamRegistered: input.isMsmeUdyamRegistered },
    });
  });

  return partyId;
}

export async function listParties(companyDb: Kysely<CompanyDatabase>): Promise<BusinessPartySummary[]> {
  const rows = await companyDb.selectFrom('business_party').selectAll().orderBy('name').execute();
  return rows.map((row) => ({
    id: row.id,
    partyType: row.party_type as PartyType,
    name: row.name,
    gstin: row.gstin,
    stateCode: row.state_code,
    isMsmeUdyamRegistered: Boolean(row.is_msme_udyam_registered),
    udyamRegistrationNumber: row.udyam_registration_number,
    creditPeriodDays: row.credit_period_days,
    ledgerAccountId: row.ledger_account_id,
    isActive: Boolean(row.is_active),
  }));
}
