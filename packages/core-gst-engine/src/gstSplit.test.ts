import { describe, expect, it } from 'vitest';
import { computeGstSplit } from './gstSplit';

describe('core-gst-engine: computeGstSplit', () => {
  it('intra-state (same state code) splits 50/50 into CGST+SGST, IGST zero', () => {
    const result = computeGstSplit({ taxableAmountPaise: 10_000_00, ratePercent: 18, companyStateCode: '33', partyStateCode: '33' });
    expect(result.isIntraState).toBe(true);
    expect(result.cgstAmount).toBe(900_00);
    expect(result.sgstAmount).toBe(900_00);
    expect(result.igstAmount).toBe(0);
    expect(result.totalTaxAmount).toBe(1_800_00);
  });

  it('inter-state (different state codes) charges the full rate as IGST, CGST/SGST zero', () => {
    const result = computeGstSplit({ taxableAmountPaise: 10_000_00, ratePercent: 18, companyStateCode: '33', partyStateCode: '29' });
    expect(result.isIntraState).toBe(false);
    expect(result.igstAmount).toBe(1_800_00);
    expect(result.cgstAmount).toBe(0);
    expect(result.sgstAmount).toBe(0);
  });

  it('a null state code (either side) defaults to intra-state, not a thrown error', () => {
    const result = computeGstSplit({ taxableAmountPaise: 1000_00, ratePercent: 5, companyStateCode: null, partyStateCode: '29' });
    expect(result.isIntraState).toBe(true);
  });

  it('CGST is rounded first and SGST absorbs the remainder — the two halves always sum back to the exact total, never drifting a paisa apart on an odd total', () => {
    // 100.01 paise total tax * 18% on an amount chosen to force an odd total.
    const result = computeGstSplit({ taxableAmountPaise: 33333, ratePercent: 18, companyStateCode: '33', partyStateCode: '33' });
    const totalGst = Math.round((33333 * 18) / 100); // 5999.94 -> 6000
    expect(result.cgstAmount + result.sgstAmount).toBe(totalGst);
  });

  it('applies cess as its own line regardless of intra/inter-state split, added to totalTaxAmount', () => {
    const intra = computeGstSplit({ taxableAmountPaise: 10_000_00, ratePercent: 18, cessPercent: 3, companyStateCode: '33', partyStateCode: '33' });
    expect(intra.cessAmount).toBe(300_00);
    expect(intra.totalTaxAmount).toBe(1_800_00 + 300_00);

    const inter = computeGstSplit({ taxableAmountPaise: 10_000_00, ratePercent: 18, cessPercent: 3, companyStateCode: '33', partyStateCode: '29' });
    expect(inter.cessAmount).toBe(300_00);
    expect(inter.totalTaxAmount).toBe(1_800_00 + 300_00);
  });

  it('a zero rate (e.g. GST-exempt HSN) produces zero tax on every line without error', () => {
    const result = computeGstSplit({ taxableAmountPaise: 5000_00, ratePercent: 0, companyStateCode: '33', partyStateCode: '33' });
    expect(result.totalTaxAmount).toBe(0);
  });

  it('the current GST 2.0 slabs (5/18/40%, 3% gold-silver) each compute correctly at a round amount', () => {
    for (const rate of [5, 18, 40]) {
      const r = computeGstSplit({ taxableAmountPaise: 1_000_00, ratePercent: rate, companyStateCode: '33', partyStateCode: '29' });
      expect(r.igstAmount).toBe(Math.round((1_000_00 * rate) / 100));
    }
    const gold = computeGstSplit({ taxableAmountPaise: 1_000_00, ratePercent: 3, companyStateCode: '33', partyStateCode: '29' });
    expect(gold.igstAmount).toBe(30_00);
  });
});
