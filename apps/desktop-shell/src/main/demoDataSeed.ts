import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { createLedger, listAccountGroups, listLedgers, createVoucher } from './accountingHandlers';
import { createParty, listParties, createSalesInvoice, createPurchaseInvoice } from './salesPurchaseHandlers';
import { createUnitOfMeasure, createWarehouse, createItem } from './inventoryHandlers';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Populates the just-created (and just-logged-into) demo company with a
 * realistic small-business snapshot — real customers/suppliers, a mixed
 * service+stockable item catalog with real HSN/SAC codes drawn from the
 * already-seeded GST rate catalog, a month of purchase/sales invoices, and a
 * couple of payment/receipt vouchers — so Trial Balance/P&L/Stock Summary
 * show real numbers instead of empty screens. Calls the exact same IPC-layer
 * functions any real user's click would call (session-based, reading the
 * demo company/session `createDemoCompanyAndLogin` already established) —
 * this is real, independently-already-tested business logic exercising
 * itself, not a parallel mock data path.
 *
 * Unlike the Setup Wizard (which deliberately never guesses real business
 * specifics for an actual company — see SetupWizardScreen.tsx), fabricating
 * a unit/warehouse/ledgers/realistic catalog here is the explicit point of a
 * demo: this data only exists to be looked at, never to be someone's real
 * books.
 */
export async function seedDemoData(systemDb: Kysely<SystemDatabase>): Promise<void> {
  const unitId = await createUnitOfMeasure({ name: 'Pieces', symbol: 'Pcs' });
  const warehouseId = await createWarehouse({ name: 'Main Warehouse' });

  const groups = await listAccountGroups();
  const salesGroup = groups.find((g) => g.name === 'Sales Accounts');
  if (!salesGroup) {
    throw new Error('Expected default Sales Accounts group to exist — seedChartOfAccounts must run first');
  }
  const salesLedgerId = await createLedger({ name: 'Sales', groupId: salesGroup.id, openingBalanceRupees: 0, openingBalanceSide: 'CREDIT' });
  const ledgers = await listLedgers();
  const cashLedger = ledgers.find((l) => l.name === 'Cash');
  // A stockable purchase line must post to Stock-in-Hand (an asset, not an
  // expense) — core-sales-purchase enforces this; COGS is recognized
  // separately, on sale, not on purchase. Every purchase line in this demo
  // catalog is stockable, so no separate "Purchases" expense ledger is
  // needed here at all.
  const stockInHandLedger = ledgers.find((l) => l.name === 'Stock-in-Hand');
  if (!cashLedger || !stockInHandLedger) {
    throw new Error('Expected default Cash / Stock-in-Hand ledgers to exist — seedChartOfAccounts/seedInventoryLedgers must run first');
  }

  // --- Parties ---
  await createParty({ partyType: 'CUSTOMER', name: 'Sunrise Retailers', stateCode: '27', isMsmeUdyamRegistered: false });
  await createParty({ partyType: 'CUSTOMER', name: 'Bluepeak Traders', stateCode: '29', isMsmeUdyamRegistered: false });
  await createParty({ partyType: 'CUSTOMER', name: 'Om Enterprises', stateCode: '27', isMsmeUdyamRegistered: true, udyamRegistrationNumber: 'UDYAM-MH-01-0012345' });
  await createParty({ partyType: 'SUPPLIER', name: 'Global Components Pvt Ltd', stateCode: '27', isMsmeUdyamRegistered: false });
  await createParty({ partyType: 'SUPPLIER', name: 'Prime Distributors', stateCode: '24', isMsmeUdyamRegistered: false });
  const parties = await listParties();
  const partyId = (name: string) => parties.find((p) => p.name === name)!.id;

  // --- Items (real HSN/SAC codes from the seeded GST rate catalog) ---
  const officeChair = await createItem({ itemCode: 'ITM-001', name: 'Office Chair', itemType: 'STOCKABLE', unitId, valuationMethod: 'FIFO', hsnSacCode: '9403' });
  const laptop = await createItem({ itemCode: 'ITM-002', name: 'Laptop - 14 inch', itemType: 'STOCKABLE', unitId, valuationMethod: 'FIFO', hsnSacCode: '8471' });
  const mouse = await createItem({ itemCode: 'ITM-003', name: 'Wireless Mouse', itemType: 'STOCKABLE', unitId, valuationMethod: 'FIFO', hsnSacCode: '8471' });
  const rice = await createItem({ itemCode: 'ITM-004', name: 'Basmati Rice 5kg', itemType: 'STOCKABLE', unitId, valuationMethod: 'FIFO', hsnSacCode: '1006' });
  const biscuits = await createItem({ itemCode: 'ITM-005', name: 'Assorted Biscuits Pack', itemType: 'STOCKABLE', unitId, valuationMethod: 'FIFO', hsnSacCode: '1905' });
  await createItem({ itemCode: 'ITM-006', name: 'IT Consulting - Monthly Retainer', itemType: 'SERVICE', hsnSacCode: '9983' });
  await createItem({ itemCode: 'ITM-007', name: 'Website Maintenance', itemType: 'SERVICE', hsnSacCode: '9983' });
  await createItem({ itemCode: 'ITM-008', name: 'Annual Support Contract', itemType: 'SERVICE', hsnSacCode: '9983' });

  // --- Purchases (establish stock for the stockable items) ---
  await createPurchaseInvoice(systemDb, {
    partyId: partyId('Global Components Pvt Ltd'),
    invoiceDate: daysAgo(28),
    narration: 'Opening stock purchase',
    lines: [
      { description: 'Office Chair', ledgerId: stockInHandLedger.id, amountRupees: 20 * 2800, hsnSacCode: '9403', itemId: officeChair, warehouseId, quantityUnits: 20, ratePerUnitRupees: 2800 },
      { description: 'Wireless Mouse', ledgerId: stockInHandLedger.id, amountRupees: 60 * 350, hsnSacCode: '8471', itemId: mouse, warehouseId, quantityUnits: 60, ratePerUnitRupees: 350 },
      { description: 'Basmati Rice 5kg', ledgerId: stockInHandLedger.id, amountRupees: 100 * 380, hsnSacCode: '1006', itemId: rice, warehouseId, quantityUnits: 100, ratePerUnitRupees: 380 },
      { description: 'Assorted Biscuits Pack', ledgerId: stockInHandLedger.id, amountRupees: 80 * 95, hsnSacCode: '1905', itemId: biscuits, warehouseId, quantityUnits: 80, ratePerUnitRupees: 95 },
    ],
  });
  await createPurchaseInvoice(systemDb, {
    partyId: partyId('Prime Distributors'),
    invoiceDate: daysAgo(20),
    narration: 'Laptop stock purchase',
    lines: [{ description: 'Laptop - 14 inch', ledgerId: stockInHandLedger.id, amountRupees: 10 * 48000, hsnSacCode: '8471', itemId: laptop, warehouseId, quantityUnits: 10, ratePerUnitRupees: 48000 }],
  });

  // --- Sales (mix of stockable + service lines, spread across the past month) ---
  await createSalesInvoice(systemDb, {
    partyId: partyId('Sunrise Retailers'),
    invoiceDate: daysAgo(18),
    lines: [
      { description: 'Office Chair', ledgerId: salesLedgerId, amountRupees: 5 * 3500, hsnSacCode: '9403', itemId: officeChair, warehouseId, quantityUnits: 5, ratePerUnitRupees: 3500 },
      { description: 'IT Consulting - Monthly Retainer', ledgerId: salesLedgerId, amountRupees: 15000, hsnSacCode: '9983' },
    ],
  });
  await createSalesInvoice(systemDb, {
    partyId: partyId('Bluepeak Traders'),
    invoiceDate: daysAgo(14),
    lines: [{ description: 'Laptop - 14 inch', ledgerId: salesLedgerId, amountRupees: 2 * 55000, hsnSacCode: '8471', itemId: laptop, warehouseId, quantityUnits: 2, ratePerUnitRupees: 55000 }],
  });
  await createSalesInvoice(systemDb, {
    partyId: partyId('Om Enterprises'),
    invoiceDate: daysAgo(8),
    lines: [
      { description: 'Basmati Rice 5kg', ledgerId: salesLedgerId, amountRupees: 20 * 450, hsnSacCode: '1006', itemId: rice, warehouseId, quantityUnits: 20, ratePerUnitRupees: 450 },
      { description: 'Assorted Biscuits Pack', ledgerId: salesLedgerId, amountRupees: 30 * 120, hsnSacCode: '1905', itemId: biscuits, warehouseId, quantityUnits: 30, ratePerUnitRupees: 120 },
      { description: 'Wireless Mouse', ledgerId: salesLedgerId, amountRupees: 10 * 550, hsnSacCode: '8471', itemId: mouse, warehouseId, quantityUnits: 10, ratePerUnitRupees: 550 },
    ],
  });
  await createSalesInvoice(systemDb, {
    partyId: partyId('Sunrise Retailers'),
    invoiceDate: daysAgo(2),
    lines: [{ description: 'Website Maintenance', ledgerId: salesLedgerId, amountRupees: 8000, hsnSacCode: '9983' }],
  });

  // --- A couple of payment/receipt vouchers ---
  const sunriseLedgerId = parties.find((p) => p.name === 'Sunrise Retailers')!.ledgerAccountId;
  const globalComponentsLedgerId = parties.find((p) => p.name === 'Global Components Pvt Ltd')!.ledgerAccountId;
  await createVoucher(systemDb, {
    voucherType: 'RECEIPT',
    voucherDate: daysAgo(5),
    narration: 'Payment received from Sunrise Retailers',
    lines: [
      { ledgerId: cashLedger.id, debitRupees: 20000, creditRupees: 0 },
      { ledgerId: sunriseLedgerId, debitRupees: 0, creditRupees: 20000 },
    ],
  });
  await createVoucher(systemDb, {
    voucherType: 'PAYMENT',
    voucherDate: daysAgo(3),
    narration: 'Payment made to Global Components Pvt Ltd',
    lines: [
      { ledgerId: globalComponentsLedgerId, debitRupees: 30000, creditRupees: 0 },
      { ledgerId: cashLedger.id, debitRupees: 0, creditRupees: 30000 },
    ],
  });
}
