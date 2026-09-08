import { describe, expect, it } from 'vitest';
import { computeTdsAmount } from './tds';

describe('core-sales-purchase: computeTdsAmount (threshold-aware vendor TDS, 194C/194J/194Q/194I)', () => {
  const THRESHOLD = 10_000_000; // Rs 1,00,000
  const RATE = 2; // 194C's default 2%

  it('still under the threshold: zero TDS deducted', () => {
    const result = computeTdsAmount(3_000_000, 2_000_000, THRESHOLD, RATE); // prior 30k + this 20k = 50k, well under 1L
    expect(result).toBe(0);
  });

  it('the invoice that CROSSES the threshold: TDS applies only to the excess over the threshold, not the whole invoice', () => {
    // Prior 90,000 + this invoice 20,000 = 1,10,000 total; only 10,000 (the excess) is taxable for TDS.
    const result = computeTdsAmount(9_000_000, 2_000_000, THRESHOLD, RATE);
    const expectedExcess = 1_000_000; // Rs 10,000
    expect(result).toBe(Math.round((expectedExcess * RATE) / 100));
  });

  it('every invoice AFTER the threshold has already been crossed: TDS on the full invoice amount', () => {
    const result = computeTdsAmount(15_000_000, 5_000_000, THRESHOLD, RATE); // already well past threshold
    expect(result).toBe(Math.round((5_000_000 * RATE) / 100));
  });

  it('exactly at the threshold (total equals threshold, not yet exceeding it): zero TDS', () => {
    const result = computeTdsAmount(8_000_000, 2_000_000, THRESHOLD, RATE); // total = exactly 1,00,000
    expect(result).toBe(0);
  });

  it('one paisa over the threshold: TDS applies to that one paisa only', () => {
    const result = computeTdsAmount(8_000_000, 2_000_001, THRESHOLD, RATE);
    expect(result).toBe(Math.round((1 * RATE) / 100)); // rounds to 0, but computed on the correct excess
  });

  it("194Q's fractional 0.1% rate computes correctly, not truncated to zero", () => {
    // Rs 60,00,000 invoice against a Rs 50,00,000 threshold — Rs 10,00,000 excess taxed at 0.1%.
    const result = computeTdsAmount(0, 6_000_000_00, 500_000_000, 0.1);
    const expectedExcess = 6_000_000_00 - 500_000_000;
    expect(result).toBe(Math.round((expectedExcess * 0.1) / 100));
    expect(result).toBeGreaterThan(0);
  });

  it('a zero-rate or zero-invoice input never throws', () => {
    expect(computeTdsAmount(0, 0, THRESHOLD, RATE)).toBe(0);
  });
});
