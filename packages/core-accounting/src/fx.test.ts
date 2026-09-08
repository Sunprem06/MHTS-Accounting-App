import { describe, expect, it } from 'vitest';
import { convertForeignToBase, foreignAmountForBase } from './fx';

describe('core-accounting: convertForeignToBase / foreignAmountForBase (multi-currency BigInt precision)', () => {
  it('converts a simple whole-number rate correctly', () => {
    // 100.00 USD at rate 83.500000 (83_500_000 micros) -> 8350.00 INR (835000 paise)
    expect(convertForeignToBase(100_00, 83_500_000)).toBe(835_000);
  });

  it('half-up rounds a remainder of exactly half the denominator up', () => {
    // 3 minor-units * 1_500_000 micros = 4_500_000 -> quotient 4, remainder 500_000 (exactly half of 1_000_000) -> rounds up to 5.
    expect(convertForeignToBase(3, 1_500_000)).toBe(5);
    // One below the exact-half remainder rounds down instead.
    expect(convertForeignToBase(3, 1_499_999)).toBe(4);
  });

  it('rejects a non-integer or negative foreign amount', () => {
    expect(() => convertForeignToBase(1.5, 1_000_000)).toThrow();
    expect(() => convertForeignToBase(-100, 1_000_000)).toThrow();
  });

  it('rejects a non-positive exchange rate', () => {
    expect(() => convertForeignToBase(100, 0)).toThrow();
    expect(() => convertForeignToBase(100, -1)).toThrow();
  });

  it('a large amount that would overflow plain Number multiplication (paise-scale * micros-scale) still converts exactly via BigInt', () => {
    const largeForeignMinor = 999_999_999_99; // ~10 billion minor units
    const rate = 83_123_456; // 83.123456
    const result = convertForeignToBase(largeForeignMinor, rate);
    // Cross-check against the exact BigInt computation done independently here.
    const expected = (BigInt(largeForeignMinor) * BigInt(rate)) / 1_000_000n;
    expect(BigInt(result)).toBeGreaterThanOrEqual(expected - 1n);
    expect(BigInt(result)).toBeLessThanOrEqual(expected + 1n);
  });

  it('foreignAmountForBase is the exact inverse of convertForeignToBase (round-trips)', () => {
    const foreignAmount = 12_345_67; // an arbitrary foreign minor-unit amount
    const rate = 83_456_789;
    const baseAmount = convertForeignToBase(foreignAmount, rate);
    const recoveredForeignAmount = foreignAmountForBase(baseAmount, rate);
    expect(convertForeignToBase(recoveredForeignAmount, rate)).toBe(baseAmount);
  });

  it('foreignAmountForBase of zero is zero', () => {
    expect(foreignAmountForBase(0, 83_000_000)).toBe(0);
  });
});
