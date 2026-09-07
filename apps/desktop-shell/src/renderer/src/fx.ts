/**
 * Mirrors core-accounting's convertForeignToBase exactly (BigInt, half-up
 * rounding) so a voucher-entry screen's client-side base-amount computation
 * never drifts from what the server validates — used by any screen that
 * lets a line carry a foreign currency (Journal/Payment/Receipt vouchers).
 */
export function foreignUnitsToBaseRupees(foreignAmountUnits: number, exchangeRate: number): number {
  const foreignMinor = BigInt(Math.round(foreignAmountUnits * 100));
  const rateMicros = BigInt(Math.round(exchangeRate * 1_000_000));
  const numerator = foreignMinor * rateMicros;
  const denominator = 1_000_000n;
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const roundedBasePaise = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return Number(roundedBasePaise) / 100;
}
