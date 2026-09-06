import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';

const STOCK_IN_HAND_LEDGER = 'Stock-in-Hand';
const COGS_LEDGER = 'Cost of Goods Sold';
const INVENTORY_ADJUSTMENTS_LEDGER = 'Inventory Adjustments';

/**
 * Seeds the three system ledgers this module needs — called once at company
 * creation, alongside seedChartOfAccounts/seedSalesPurchaseLedgers. No new
 * default account groups are needed: Current Assets, Direct Expenses and
 * Indirect Expenses already exist from Phase 1.
 */
export async function seedInventoryLedgers(companyDb: Kysely<CompanyDatabase>): Promise<void> {
  const currentAssetsGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Current Assets').executeTakeFirst();
  if (!currentAssetsGroup) {
    throw new Error('Current Assets group not found — seedChartOfAccounts must run before seedInventoryLedgers');
  }
  const directExpensesGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Direct Expenses').executeTakeFirst();
  if (!directExpensesGroup) {
    throw new Error('Direct Expenses group not found — seedChartOfAccounts must run before seedInventoryLedgers');
  }
  const indirectExpensesGroup = await companyDb.selectFrom('account_group').select('id').where('name', '=', 'Indirect Expenses').executeTakeFirst();
  if (!indirectExpensesGroup) {
    throw new Error('Indirect Expenses group not found — seedChartOfAccounts must run before seedInventoryLedgers');
  }

  await companyDb
    .insertInto('ledger_account')
    .values([
      { id: randomUUID(), name: STOCK_IN_HAND_LEDGER, group_id: currentAssetsGroup.id, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
      { id: randomUUID(), name: COGS_LEDGER, group_id: directExpensesGroup.id, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
      { id: randomUUID(), name: INVENTORY_ADJUSTMENTS_LEDGER, group_id: indirectExpensesGroup.id, opening_balance: 0, opening_balance_side: 'DEBIT', is_system_ledger: 1 },
    ])
    .execute();
}

export interface InventoryLedgerIds {
  stockInHandLedgerId: string;
  cogsLedgerId: string;
  adjustmentsLedgerId: string;
}

/** Looks up the three well-known system ledgers by name — usable either standalone or inside an open transaction (Kysely's Transaction is structurally a Kysely instance). */
export async function getInventoryLedgerIds(companyDb: Kysely<CompanyDatabase>): Promise<InventoryLedgerIds> {
  const stockInHand = await companyDb.selectFrom('ledger_account').select('id').where('name', '=', STOCK_IN_HAND_LEDGER).executeTakeFirst();
  if (!stockInHand) {
    throw new Error(`"${STOCK_IN_HAND_LEDGER}" ledger not found — seedInventoryLedgers must run at company creation`);
  }
  const cogs = await companyDb.selectFrom('ledger_account').select('id').where('name', '=', COGS_LEDGER).executeTakeFirst();
  if (!cogs) {
    throw new Error(`"${COGS_LEDGER}" ledger not found — seedInventoryLedgers must run at company creation`);
  }
  const adjustments = await companyDb.selectFrom('ledger_account').select('id').where('name', '=', INVENTORY_ADJUSTMENTS_LEDGER).executeTakeFirst();
  if (!adjustments) {
    throw new Error(`"${INVENTORY_ADJUSTMENTS_LEDGER}" ledger not found — seedInventoryLedgers must run at company creation`);
  }

  return { stockInHandLedgerId: stockInHand.id, cogsLedgerId: cogs.id, adjustmentsLedgerId: adjustments.id };
}
