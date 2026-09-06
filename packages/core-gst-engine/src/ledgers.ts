import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

const CGST_PAYABLE_LEDGER = 'CGST Payable';
const SGST_PAYABLE_LEDGER = 'SGST Payable';
const IGST_PAYABLE_LEDGER = 'IGST Payable';
const CESS_PAYABLE_LEDGER = 'Cess Payable';
const CGST_INPUT_LEDGER = 'CGST Input';
const SGST_INPUT_LEDGER = 'SGST Input';
const IGST_INPUT_LEDGER = 'IGST Input';
const CESS_INPUT_LEDGER = 'Cess Input';
const CGST_RCM_PAYABLE_LEDGER = 'CGST RCM Payable';
const SGST_RCM_PAYABLE_LEDGER = 'SGST RCM Payable';
const IGST_RCM_PAYABLE_LEDGER = 'IGST RCM Payable';
const CESS_RCM_PAYABLE_LEDGER = 'Cess RCM Payable';

const INPUT_TAX_CREDIT_GROUP = 'Input Tax Credit';

/**
 * Output tax (collected on sales, owed to the government) is a real
 * liability — it seeds into the existing "Duties & Taxes" group (Current
 * Liabilities), same as Phase 2's TDS Payable. Input tax (paid on purchases,
 * recoverable as credit) is the opposite economic direction — an asset, not
 * a liability — so it needs its own new "Input Tax Credit" group under
 * Current Assets rather than being lumped into Duties & Taxes, which would
 * misclassify recoverable GST as a liability on the Balance Sheet. No
 * existing Current Assets sub-group (Cash-in-Hand, Bank Accounts, Sundry
 * Debtors) fits, so this is a genuinely new group, not a reuse of one Phase
 * 1/2/3 already seeded.
 */
export async function seedGstLedgers(companyDb: Kysely<CompanyDatabase>): Promise<void> {
  const dutiesAndTaxesGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Duties & Taxes').executeTakeFirst();
  if (!dutiesAndTaxesGroup) {
    throw new Error('Duties & Taxes group not found — seedChartOfAccounts must run before seedGstLedgers');
  }
  const currentAssetsGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Current Assets').executeTakeFirst();
  if (!currentAssetsGroup) {
    throw new Error('Current Assets group not found — seedChartOfAccounts must run before seedGstLedgers');
  }

  const inputTaxCreditGroupId = randomUUID();
  await companyDb
    .insertInto('account_group')
    .values({ id: inputTaxCreditGroupId, name: INPUT_TAX_CREDIT_GROUP, parent_group_id: currentAssetsGroup.id, nature: 'ASSET', is_system_group: 1 })
    .execute();

  await companyDb
    .insertInto('ledger_account')
    .values([
      { id: randomUUID(), name: CGST_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: SGST_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: IGST_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: CESS_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: CGST_INPUT_LEDGER, group_id: inputTaxCreditGroupId, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
      { id: randomUUID(), name: SGST_INPUT_LEDGER, group_id: inputTaxCreditGroupId, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
      { id: randomUUID(), name: IGST_INPUT_LEDGER, group_id: inputTaxCreditGroupId, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
      { id: randomUUID(), name: CESS_INPUT_LEDGER, group_id: inputTaxCreditGroupId, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
      // Reverse charge liability is kept separate from the normal output Payable ledgers above —
      // it's tax WE self-assess on a purchase (never collected from a customer), and GSTR-3B
      // reports it in a different table row, so conflating the two would misreport both.
      { id: randomUUID(), name: CGST_RCM_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: SGST_RCM_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: IGST_RCM_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
      { id: randomUUID(), name: CESS_RCM_PAYABLE_LEDGER, group_id: dutiesAndTaxesGroup.id, opening_balance: 0, opening_balance_side: 'CREDIT', is_system_ledger: 1 },
    ])
    .execute();
}

export interface GstLedgerIds {
  cgstPayableLedgerId: string;
  sgstPayableLedgerId: string;
  igstPayableLedgerId: string;
  cessPayableLedgerId: string;
  cgstInputLedgerId: string;
  sgstInputLedgerId: string;
  igstInputLedgerId: string;
  cessInputLedgerId: string;
  cgstRcmPayableLedgerId: string;
  sgstRcmPayableLedgerId: string;
  igstRcmPayableLedgerId: string;
  cessRcmPayableLedgerId: string;
}

async function ledgerIdByName(companyDb: Kysely<CompanyDatabase>, name: string): Promise<string> {
  const row = await companyDb.selectFrom('ledger_account').select('id').where('name', '=', name).executeTakeFirst();
  if (!row) {
    throw new Error(`"${name}" ledger not found — seedGstLedgers must run at company creation`);
  }
  return row.id;
}

/** Looks up the eight well-known system ledgers by name — usable either standalone or inside an open transaction (Kysely's Transaction is structurally a Kysely instance), same pattern as core-inventory's getInventoryLedgerIds. */
export async function getGstLedgerIds(companyDb: Kysely<CompanyDatabase>): Promise<GstLedgerIds> {
  return {
    cgstPayableLedgerId: await ledgerIdByName(companyDb, CGST_PAYABLE_LEDGER),
    sgstPayableLedgerId: await ledgerIdByName(companyDb, SGST_PAYABLE_LEDGER),
    igstPayableLedgerId: await ledgerIdByName(companyDb, IGST_PAYABLE_LEDGER),
    cessPayableLedgerId: await ledgerIdByName(companyDb, CESS_PAYABLE_LEDGER),
    cgstInputLedgerId: await ledgerIdByName(companyDb, CGST_INPUT_LEDGER),
    sgstInputLedgerId: await ledgerIdByName(companyDb, SGST_INPUT_LEDGER),
    igstInputLedgerId: await ledgerIdByName(companyDb, IGST_INPUT_LEDGER),
    cessInputLedgerId: await ledgerIdByName(companyDb, CESS_INPUT_LEDGER),
    cgstRcmPayableLedgerId: await ledgerIdByName(companyDb, CGST_RCM_PAYABLE_LEDGER),
    sgstRcmPayableLedgerId: await ledgerIdByName(companyDb, SGST_RCM_PAYABLE_LEDGER),
    igstRcmPayableLedgerId: await ledgerIdByName(companyDb, IGST_RCM_PAYABLE_LEDGER),
    cessRcmPayableLedgerId: await ledgerIdByName(companyDb, CESS_RCM_PAYABLE_LEDGER),
  };
}
