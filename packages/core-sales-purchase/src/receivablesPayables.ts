import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { computeLedgerBalances } from '@mhts/core-accounting';
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
 * Section 43B(h) ageing for MSME suppliers. This pass has no bill-wise
 * (invoice-level) payment allocation — payments just credit whichever ledger
 * the user picks on a generic Payment voucher, with no link back to a
 * specific invoice. So "which invoices are still unpaid" is estimated with a
 * standard FIFO assumption: a supplier's current outstanding ledger balance
 * is assumed to cover their most RECENT invoices, oldest-first up to that
 * balance are assumed settled. This is a real, defensible approximation used
 * by simpler accounting tools without bill-wise tracking — but it is an
 * approximation, not a certainty; true bill-wise allocation is tracked as a
 * fast-follow (Phase Tracker Open Questions).
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

  const rows: MsmeAgeingRow[] = [];
  const asOfMs = new Date(`${asOfDate}T00:00:00Z`).getTime();

  for (const party of msmeParties) {
    let remainingOutstanding = outstandingByLedger.get(party.ledger_account_id) ?? 0;
    if (remainingOutstanding <= 0) {
      continue;
    }

    const invoices = await companyDb
      .selectFrom('purchase_invoice')
      .innerJoin('voucher', 'voucher.id', 'purchase_invoice.voucher_id')
      .leftJoin('purchase_invoice_line', 'purchase_invoice_line.purchase_invoice_id', 'purchase_invoice.id')
      .select(({ fn }) => [
        'purchase_invoice.id as id',
        'voucher.voucher_number as voucherNumber',
        'purchase_invoice.invoice_date as invoiceDate',
        'purchase_invoice.due_date as dueDate',
        'purchase_invoice.tds_amount as tdsAmount',
        fn.sum<number>('purchase_invoice_line.amount').as('taxableAmount'),
        fn.sum<number>('purchase_invoice_line.tax_amount').as('taxAmount'),
      ])
      .where('purchase_invoice.party_id', '=', party.id)
      .where('voucher.cancelled_at', 'is', null)
      .groupBy('purchase_invoice.id')
      .orderBy('purchase_invoice.invoice_date', 'asc')
      .orderBy('voucher.voucher_number', 'asc')
      .execute();

    // Oldest-first FIFO settlement assumption: the newest invoices, from the
    // end of this list backwards, are the ones still open up to
    // remainingOutstanding. Walk from the newest invoice back to the oldest,
    // consuming remainingOutstanding as we go.
    for (let i = invoices.length - 1; i >= 0 && remainingOutstanding > 0; i--) {
      const invoice = invoices[i];
      const netAmount = Number(invoice.taxableAmount ?? 0) + Number(invoice.taxAmount ?? 0) - invoice.tdsAmount;
      const estimatedOutstanding = Math.min(netAmount, remainingOutstanding);
      remainingOutstanding -= estimatedOutstanding;

      const dueMs = new Date(`${invoice.dueDate}T00:00:00Z`).getTime();
      const daysOverdue = Math.floor((asOfMs - dueMs) / MS_PER_DAY);
      if (daysOverdue > 0) {
        rows.push({
          partyId: party.id,
          partyName: party.name,
          invoiceId: invoice.id,
          voucherNumber: invoice.voucherNumber,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate,
          daysOverdue,
          estimatedOutstanding,
        });
      }
    }
  }

  return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
}
