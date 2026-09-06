import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import { computeGstSplit, resolveGstRate } from '@mhts/core-gst-engine';
import type { GstSplitResult } from '@mhts/core-gst-engine';
import type { DocumentLineInput } from './types';

export interface ResolvedLineGst extends GstSplitResult {
  ratePercent: number;
  cessPercent: number;
}

/**
 * Resolves GST for every line that carries an hsnSacCode — null for a line
 * with none (manual-tax or a genuinely tax-exempt line), same index order as
 * the input lines. Shared by sales and purchase invoice creation.
 *
 * Rate resolution reads the system DB's rule_set table directly, same
 * reasoning as core-sales-purchase's existing resolveTdsRate: it's a
 * separate encrypted file/connection from the company DB, so there's no
 * cross-file transaction to join — reading it mid-transaction on the company
 * DB side is safe.
 */
export async function resolveLineGstList(
  systemDb: Kysely<SystemDatabase>,
  companyStateCode: string | null,
  partyStateCode: string | null,
  asOfDate: string,
  lines: DocumentLineInput[],
): Promise<(ResolvedLineGst | null)[]> {
  const results: (ResolvedLineGst | null)[] = [];
  for (const line of lines) {
    if (!line.hsnSacCode || !line.hsnSacCode.trim()) {
      results.push(null);
      continue;
    }
    const rate = await resolveGstRate(systemDb, line.hsnSacCode.trim(), asOfDate);
    const split = computeGstSplit({
      companyStateCode,
      partyStateCode,
      taxableAmountPaise: line.amount,
      ratePercent: rate.ratePercent,
      cessPercent: rate.cessPercent,
    });
    results.push({ ...split, ratePercent: rate.ratePercent, cessPercent: rate.cessPercent });
  }
  return results;
}
