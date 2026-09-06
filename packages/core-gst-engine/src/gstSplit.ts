import type { GstSplitInput, GstSplitResult } from './types';

/**
 * Place-of-supply split: intra-state (company and party in the same state)
 * splits the rate 50/50 into CGST+SGST; inter-state charges the full rate as
 * IGST. Cess (if any) always applies as its own line regardless of the
 * split. CGST is rounded first and SGST takes whatever remains
 * (totalGstAmount - cgstAmount) rather than being independently rounded —
 * the same "absorb the rounding on the last split" discipline used for FIFO
 * layer consumption in core-inventory — so the two halves always sum back to
 * the exact total tax, never drifting a paisa apart.
 */
export function computeGstSplit(input: GstSplitInput): GstSplitResult {
  const cessPercent = input.cessPercent ?? 0;
  const totalGstAmount = Math.round((input.taxableAmountPaise * input.ratePercent) / 100);
  const cessAmount = Math.round((input.taxableAmountPaise * cessPercent) / 100);

  const isIntraState = input.companyStateCode === null || input.partyStateCode === null || input.companyStateCode === input.partyStateCode;

  if (isIntraState) {
    const cgstAmount = Math.round(totalGstAmount / 2);
    const sgstAmount = totalGstAmount - cgstAmount;
    return { isIntraState: true, cgstAmount, sgstAmount, igstAmount: 0, cessAmount, totalTaxAmount: totalGstAmount + cessAmount };
  }

  return { isIntraState: false, cgstAmount: 0, sgstAmount: 0, igstAmount: totalGstAmount, cessAmount, totalTaxAmount: totalGstAmount + cessAmount };
}
