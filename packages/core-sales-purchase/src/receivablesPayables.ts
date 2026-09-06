import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { computeLedgerBalances } from '@mhts/core-accounting';
import { listOutstandingPurchaseInvoices } from './settlements';
import type { MsmeAgeingRow, PartyOutstandingRow } from './types';

// better-sqlite3 only binds numbers/strings/bigints/buffers/null, not JS booleans — same convention as apps/desktop-shell's handlers.ts.
const IS_MSME = 1 as unknown as boolean;

/** Receivables: each customer's own ledger (Sundry Debtors) is debit-positive when they owe us money — the same sign computeLedgerBalances already uses, no flip needed. */
export async function listReceivables(companyDb: Kysely<CompanyDatabase>): Promise<PartyOutstandingRow[]> {
  const parties = await companyDb.selectFrom('business_party').selectAll().where('party_type', 'in', ['CUSTOMER', 'BOTH']).execute();
  const balances = await computeLedgerBalances(companyDb, { natures: ['ASSET'] });
  const balanceByLedger = new Map(balances.map((b) => [b.ledgerId, b.netSigned]));

  return parties
    .map((party) => ({
      partyId: party.id,
      partyName: party.name,
      ledgerId: party.ledger_account_id,
      isMsmeUdyamRegistered: Boolean(party.is_msme_udyam_registered),
      outstandingAmount: balanceByLedger.get(party.ledger_account_id) ?? 0,
    }))
    .filter((row) => row.outstandingAmount !== 0)
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount);
}

/** Payables: each supplier's ledger (Sundry Creditors) is credit-heavy when we owe them — computeLedgerBalances reports that debit-positive (i.e. negative here), so it's flipped to a positive "amount owed" for display. */
export async function listPayables(companyDb: Kysely<CompanyDatabase>): Promise<PartyOutstandingRow[]> {
  const parties = await companyDb.selectFrom('business_party').selectAll().where('party_type', 'in', ['SUPPLIER', 'BOTH']).execute();
  const balances = await computeLedgerBalances(companyDb, { natures: ['LIABILITY'] });
  const balanceByLedger = new Map(balances.map((b) => [b.ledgerId, -b.netSigned]));

  return parties
    .map((party) => ({
      partyId: party.id,
      partyName: party.name,
      ledgerId: party.ledger_account_id,
      isMsmeUdyamRegistered: Boolean(party.is_msme_udyam_registered),
      outstandingAmount: balanceByLedger.get(party.ledger_account_id) ?? 0,
    }))
    .filter((row) => row.outstandingAmount !== 0)
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Section 43B(h) ageing for MSME suppliers. Each invoice's OWN remaining
 * balance (netAmount - real settlements recorded against it via
 * recordPurchasePayment) is exact wherever bill-wise settlement rows exist.
 * But a business can still pay a supplier through the plain, non-invoice-
 * aware Payment voucher (no settlement row created) — so per-invoice numbers
 * alone can't be trusted to sum to the party's real ledger balance. To
 * reconcile: the party's ledger balance (computeLedgerBalances, always
 * exact) is the ground truth for the TOTAL owed; it's allocated across
 * invoices newest-first, capped at each invoice's own (settlement-reduced)
 * remaining balance — a FIFO assumption only for whatever isn't already
 * accounted for by real settlement rows, not the invoice's full original
 * amount as before. When every invoice has been paid through
 * recordPurchasePayment, this is exact, not estimated.
 */
export async function listMsmeAgeing(companyDb: Kysely<CompanyDatabase>, asOfDate: string): Promise<MsmeAgeingRow[]> {
  const msmeParties = await companyDb
    .selectFrom('business_party')
    .selectAll()
    .where('party_type', 'in', ['SUPPLIER', 'BOTH'])
    .where('is_msme_udyam_registered', '=', IS_MSME)
    .execute();

  const balances = await computeLedgerBalances(companyDb, { natures: ['LIABILITY'] });
  const outstandingByLedger = new Map(balances.map((b) => [b.ledgerId, -b.netSigned]));

  const allOutstandingInvoices = await listOutstandingPurchaseInvoices(companyDb);
  const invoicesByParty = new Map<string, typeof allOutstandingInvoices>();
  for (const invoice of allOutstandingInvoices) {
    const list = invoicesByParty.get(invoice.partyId) ?? [];
    list.push(invoice);
    invoicesByParty.set(invoice.partyId, list);
  }

  const rows: MsmeAgeingRow[] = [];
  const asOfMs = new Date(`${asOfDate}T00:00:00Z`).getTime();

  for (const party of msmeParties) {
    let remainingOutstanding = outstandingByLedger.get(party.ledger_account_id) ?? 0;
    if (remainingOutstanding <= 0) {
      continue;
    }

    // listOutstandingPurchaseInvoices already sorts oldest-first; walk from the newest backwards.
    const invoices = invoicesByParty.get(party.id) ?? [];
    for (let i = invoices.length - 1; i >= 0 && remainingOutstanding > 0; i--) {
      const invoice = invoices[i];
      const estimatedOutstanding = Math.min(invoice.outstandingAmount, remainingOutstanding);
      remainingOutstanding -= estimatedOutstanding;

      const dueMs = new Date(`${invoice.dueDate}T00:00:00Z`).getTime();
      const daysOverdue = Math.floor((asOfMs - dueMs) / MS_PER_DAY);
      if (daysOverdue > 0) {
        rows.push({
          partyId: party.id,
          partyName: party.name,
          invoiceId: invoice.invoiceId,
          voucherNumber: invoice.voucherNumber,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate!,
          daysOverdue,
          estimatedOutstanding,
        });
      }
    }
  }

  return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
}
