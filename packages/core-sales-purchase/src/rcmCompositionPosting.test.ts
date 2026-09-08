import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb, createTempSystemDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { seedChartOfAccounts, listAccountGroups, createLedgerAccount, computeTrialBalance } from '@mhts/core-accounting';
import { seedGstLedgers, getGstLedgerIds, createOrUpdateGstRate } from '@mhts/core-gst-engine';
import { createParty } from './parties';
import { createSalesInvoice } from './salesInvoices';
import { createPurchaseInvoice } from './purchaseInvoices';

/**
 * DB-integration coverage for composition-scheme and reverse-charge GL
 * POSTING (not just the return-computation layer, already covered by
 * gstReturns.test.ts) — flagged as a gap in Phase 11's Open Questions
 * ("RCM/composition invoice posting" beyond the manually-verified-only
 * scenarios from the Phase 4 session).
 */
describe('core-sales-purchase: composition-scheme and reverse-charge GL posting', () => {
  let companyHandle: TempDbHandle<CompanyDatabase>;
  let systemHandle: TempDbHandle<SystemDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let systemDb: Kysely<SystemDatabase>;
  let purchaseLedgerId: string;
  let salesLedgerId: string;

  beforeEach(async () => {
    companyHandle = await createTempCompanyDb();
    systemHandle = await createTempSystemDb();
    companyDb = companyHandle.db;
    systemDb = systemHandle.db;

    await seedChartOfAccounts(companyDb);
    await seedGstLedgers(companyDb);
    await createOrUpdateGstRate(systemDb, { hsnSacCode: '9403', ratePercent: 18, effectiveFrom: '2025-09-22' }, null);

    const groups = await listAccountGroups(companyDb);
    purchaseLedgerId = await createLedgerAccount(companyDb, { name: 'Furniture Purchases', groupId: groups.find((g) => g.name === 'Purchase Accounts')!.id, openingBalance: 0, openingBalanceSide: 'DEBIT' });
    salesLedgerId = await createLedgerAccount(companyDb, { name: 'Furniture Sales', groupId: groups.find((g) => g.name === 'Sales Accounts')!.id, openingBalance: 0, openingBalanceSide: 'CREDIT' });
  });

  afterEach(async () => {
    await companyHandle.close();
    await systemHandle.close();
  });

  it('a composition-scheme sale collects ZERO GST from the customer, even though the HSN rate resolves normally', async () => {
    const partyId = await createParty(companyDb, { partyType: 'CUSTOMER', name: 'Retail Customer', stateCode: '27', isMsmeUdyamRegistered: false }, null);
    await createSalesInvoice(
      companyDb,
      systemDb,
      {
        partyId,
        financialYear: '2025-26',
        invoiceDate: '2026-01-10',
        companyStateCode: '27',
        companyGstRegistrationType: 'COMPOSITION',
        lines: [{ description: 'Chair', ledgerId: salesLedgerId, amount: 1_000_00, hsnSacCode: '9403' }],
      },
      null,
    );

    const gstLedgerIds = await getGstLedgerIds(companyDb);
    const trialBalance = await computeTrialBalance(companyDb);
    expect(trialBalance.totalDebit).toBe(trialBalance.totalCredit);

    // No GST payable ledger was touched at all — every one of them sits at exactly zero.
    for (const ledgerId of [gstLedgerIds.cgstPayableLedgerId, gstLedgerIds.sgstPayableLedgerId, gstLedgerIds.igstPayableLedgerId]) {
      const row = trialBalance.rows.find((r) => r.ledgerId === ledgerId)!;
      expect(row.debitBalance).toBe(0);
      expect(row.creditBalance).toBe(0);
    }
    // The customer owes exactly the taxable value — no tax added on top.
    const salesLine = await companyDb.selectFrom('sales_invoice_line').selectAll().executeTakeFirstOrThrow();
    expect(salesLine.cgst_amount + salesLine.sgst_amount + salesLine.igst_amount).toBe(0);
    expect(salesLine.hsn_sac_code).toBe('9403'); // still recorded for composition's own HSN-wise return
  });

  it('a composition-scheme purchase is forced ITC-ineligible: the GST folds into cost, never into an Input GST ledger', async () => {
    const partyId = await createParty(companyDb, { partyType: 'SUPPLIER', name: 'Furniture Supplier', stateCode: '27', isMsmeUdyamRegistered: false }, null);
    await createPurchaseInvoice(
      companyDb,
      systemDb,
      {
        partyId,
        financialYear: '2025-26',
        invoiceDate: '2026-01-10',
        companyStateCode: '27',
        companyGstRegistrationType: 'COMPOSITION',
        // itcEligible: true would normally claim credit — composition overrides this regardless.
        lines: [{ description: 'Office chairs', ledgerId: purchaseLedgerId, amount: 1_000_00, hsnSacCode: '9403', itcEligible: true }],
      },
      null,
    );

    const gstLedgerIds = await getGstLedgerIds(companyDb);
    const trialBalance = await computeTrialBalance(companyDb);
    // Rs 1,000 taxable + Rs 180 GST (18%) — all folded into the purchase (cost) ledger, nothing recoverable.
    const purchaseRow = trialBalance.rows.find((r) => r.ledgerId === purchaseLedgerId)!;
    expect(purchaseRow.debitBalance).toBe(1_180_00);
    for (const ledgerId of [gstLedgerIds.cgstInputLedgerId, gstLedgerIds.sgstInputLedgerId]) {
      const row = trialBalance.rows.find((r) => r.ledgerId === ledgerId)!;
      expect(row.debitBalance).toBe(0);
      expect(row.creditBalance).toBe(0);
    }

    const line = await companyDb.selectFrom('purchase_invoice_line').selectAll().executeTakeFirstOrThrow();
    expect(line.itc_eligible).toBe(0); // forced ineligible despite the input flag saying eligible
  });

  it('a reverse-charge purchase self-assesses GST (Dr Input / Cr RCM Payable) and excludes it from what is owed to the supplier', async () => {
    const partyId = await createParty(companyDb, { partyType: 'SUPPLIER', name: 'RCM Supplier', stateCode: '27', isMsmeUdyamRegistered: false }, null);
    await createPurchaseInvoice(
      companyDb,
      systemDb,
      {
        partyId,
        financialYear: '2025-26',
        invoiceDate: '2026-01-10',
        companyStateCode: '27',
        // Regular scheme — NOT composition — so the RCM line's own itcEligible flag governs.
        lines: [{ description: 'Office chairs', ledgerId: purchaseLedgerId, amount: 1_000_00, hsnSacCode: '9403', isReverseCharge: true }],
      },
      null,
    );

    const gstLedgerIds = await getGstLedgerIds(companyDb);
    const trialBalance = await computeTrialBalance(companyDb);
    expect(trialBalance.totalDebit).toBe(trialBalance.totalCredit);

    // Rs 90 CGST + Rs 90 SGST self-assessed: debited to Input (eligible by default), credited to RCM Payable.
    const cgstInputRow = trialBalance.rows.find((r) => r.ledgerId === gstLedgerIds.cgstInputLedgerId)!;
    expect(cgstInputRow.debitBalance).toBe(90_00);
    const cgstRcmPayableRow = trialBalance.rows.find((r) => r.ledgerId === gstLedgerIds.cgstRcmPayableLedgerId)!;
    expect(cgstRcmPayableRow.creditBalance).toBe(90_00);

    // The supplier is owed ONLY the taxable value — the self-assessed tax never touches their ledger.
    const party = await companyDb.selectFrom('business_party').selectAll().where('id', '=', partyId).executeTakeFirstOrThrow();
    const partyRow = trialBalance.rows.find((r) => r.ledgerId === party.ledger_account_id)!;
    expect(partyRow.creditBalance).toBe(1_000_00);

    const line = await companyDb.selectFrom('purchase_invoice_line').selectAll().executeTakeFirstOrThrow();
    expect(line.is_reverse_charge).toBe(1);
  });
});
