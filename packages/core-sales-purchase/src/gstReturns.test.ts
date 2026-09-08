import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempCompanyDb, createTempSystemDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { CompanyDatabase, SystemDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { seedChartOfAccounts, listAccountGroups, createLedgerAccount } from '@mhts/core-accounting';
import { seedGstLedgers, createOrUpdateGstRate } from '@mhts/core-gst-engine';
import { createParty } from './parties';
import { createPurchaseInvoice } from './purchaseInvoices';
import { computeGstr3bData } from './gstReturns';

/**
 * Regression test for the adversarial CA review's Finding F1: RCM-origin
 * input tax must NOT be folded into the same-period eligible-ITC set-off,
 * even though a reverse-charge purchase line's itc_eligible flag defaults
 * to true exactly like a normal purchase line's does.
 */
describe('core-sales-purchase: computeGstr3bData excludes RCM-origin credit from the same-period ITC set-off', () => {
  let companyHandle: TempDbHandle<CompanyDatabase>;
  let systemHandle: TempDbHandle<SystemDatabase>;
  let companyDb: Kysely<CompanyDatabase>;
  let systemDb: Kysely<SystemDatabase>;
  let purchaseLedgerId: string;

  beforeEach(async () => {
    companyHandle = await createTempCompanyDb();
    systemHandle = await createTempSystemDb();
    companyDb = companyHandle.db;
    systemDb = systemHandle.db;

    await seedChartOfAccounts(companyDb);
    await seedGstLedgers(companyDb);
    await createOrUpdateGstRate(systemDb, { hsnSacCode: '9983', ratePercent: 18, effectiveFrom: '2025-09-22' }, null);

    const groups = await listAccountGroups(companyDb);
    const purchaseAccountsGroupId = groups.find((g) => g.name === 'Purchase Accounts')!.id;
    purchaseLedgerId = await createLedgerAccount(companyDb, { name: 'Consulting Purchases', groupId: purchaseAccountsGroupId, openingBalance: 0, openingBalanceSide: 'DEBIT' });
  });

  afterEach(async () => {
    await companyHandle.close();
    await systemHandle.close();
  });

  it('a normal (non-RCM) eligible purchase contributes to eligible ITC and the set-off', async () => {
    const partyId = await createParty(companyDb, { partyType: 'SUPPLIER', name: 'Normal Supplier', stateCode: '27', isMsmeUdyamRegistered: false }, null);
    await createPurchaseInvoice(
      companyDb,
      systemDb,
      {
        partyId,
        financialYear: '2025-26',
        invoiceDate: '2026-01-10',
        companyStateCode: '27',
        lines: [{ description: 'Consulting services', ledgerId: purchaseLedgerId, amount: 1_000_00, hsnSacCode: '9983' }],
      },
      null,
    );

    const result = await computeGstr3bData(companyDb, { fromDate: '2026-01-01', toDate: '2026-01-31' });
    // Rs 1,000 taxable @ 18% intra-state = Rs 90 CGST + Rs 90 SGST.
    expect(result.itcEligibleCgst).toBe(90_00);
    expect(result.itcEligibleSgst).toBe(90_00);
    expect(result.netPayable.carryForwardCgst).toBe(90_00); // no output liability to net against, so it carries forward as credit
  });

  it('an RCM (reverse-charge) eligible purchase is reported informationally but excluded from eligible ITC and the set-off', async () => {
    const partyId = await createParty(companyDb, { partyType: 'SUPPLIER', name: 'RCM Supplier', stateCode: '27', isMsmeUdyamRegistered: false }, null);
    await createPurchaseInvoice(
      companyDb,
      systemDb,
      {
        partyId,
        financialYear: '2025-26',
        invoiceDate: '2026-01-15',
        companyStateCode: '27',
        lines: [{ description: 'Reverse-charge service', ledgerId: purchaseLedgerId, amount: 1_000_00, hsnSacCode: '9983', isReverseCharge: true }],
      },
      null,
    );

    const result = await computeGstr3bData(companyDb, { fromDate: '2026-01-01', toDate: '2026-01-31' });
    // The RCM figures are still reported (Table 3.1(d)) ...
    expect(result.rcmInwardCgst).toBe(90_00);
    expect(result.rcmInwardSgst).toBe(90_00);
    // ... but NOT folded into Table 4 eligible ITC or the Table 6.1 set-off — this is the fix.
    expect(result.itcEligibleCgst).toBe(0);
    expect(result.itcEligibleSgst).toBe(0);
    expect(result.netPayable.netCgstPayable).toBe(0);
    expect(result.netPayable.carryForwardCgst).toBe(0);
  });

  it('a normal purchase and an RCM purchase in the same period: only the normal one enters the set-off', async () => {
    const partyId = await createParty(companyDb, { partyType: 'SUPPLIER', name: 'Mixed Supplier', stateCode: '27', isMsmeUdyamRegistered: false }, null);
    await createPurchaseInvoice(
      companyDb,
      systemDb,
      {
        partyId,
        financialYear: '2025-26',
        invoiceDate: '2026-02-05',
        companyStateCode: '27',
        lines: [
          { description: 'Normal service', ledgerId: purchaseLedgerId, amount: 1_000_00, hsnSacCode: '9983' },
          { description: 'Reverse-charge service', ledgerId: purchaseLedgerId, amount: 500_00, hsnSacCode: '9983', isReverseCharge: true },
        ],
      },
      null,
    );

    const result = await computeGstr3bData(companyDb, { fromDate: '2026-02-01', toDate: '2026-02-28' });
    // Only the Rs 1,000 normal line's tax (Rs 90+90) counts as eligible ITC — the Rs 500 RCM line's
    // Rs 45+45 is excluded, even though both lines' itc_eligible flag defaults to true.
    expect(result.itcEligibleCgst).toBe(90_00);
    expect(result.itcEligibleSgst).toBe(90_00);
    expect(result.rcmInwardCgst).toBe(45_00);
    expect(result.rcmInwardSgst).toBe(45_00);
  });
});
