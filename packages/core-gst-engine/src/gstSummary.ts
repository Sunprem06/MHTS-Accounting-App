import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import { computeLedgerBalances } from '@mhts/core-accounting';
import type { GstSummaryRow } from './types';

export interface GstSummaryOptions {
  fromDate?: string;
  toDate?: string;
}

/**
 * Output tax collected (sales) vs. input tax paid (purchases) for a period,
 * split CGST/SGST/IGST/Cess — read-only, built directly on top of
 * core-accounting's existing computeLedgerBalances (no nature filter, so it
 * returns every ledger; this just picks out the eight GST ledgers by name)
 * rather than a new bespoke query, same "one correct shared helper" instinct
 * as Trial Balance/P&L/BS. A Payable ledger's balance is naturally credit-
 * signed (negative in computeLedgerBalances' debit-positive convention) —
 * flipped to a positive "amount collected" here for display. Not GSTR-1/3B
 * filing-format output (deferred, see Phase Tracker Open Questions) — a
 * plain reconciliation view proving the ledgers tie out.
 */
export async function computeGstSummary(companyDb: Kysely<CompanyDatabase>, options: GstSummaryOptions = {}): Promise<GstSummaryRow> {
  const balances = await computeLedgerBalances(companyDb, { fromDate: options.fromDate, toDate: options.toDate, includeOpening: false });
  const byName = new Map(balances.map((b) => [b.ledgerName, b.netSigned]));

  const payable = (name: string): number => -(byName.get(name) ?? 0);
  const receivable = (name: string): number => byName.get(name) ?? 0;

  return {
    outputCgst: payable('CGST Payable'),
    outputSgst: payable('SGST Payable'),
    outputIgst: payable('IGST Payable'),
    outputCess: payable('Cess Payable'),
    inputCgst: receivable('CGST Input'),
    inputSgst: receivable('SGST Input'),
    inputIgst: receivable('IGST Input'),
    inputCess: receivable('Cess Input'),
  };
}
