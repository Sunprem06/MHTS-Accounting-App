/**
 * The one place a foreign-currency amount becomes a base-currency (paise)
 * amount. Used both by callers building a voucher_line's debit/credit
 * amount from a foreign amount, and by vouchers.ts's validateLines to check
 * what a caller submitted — both sides MUST use this exact function, or a
 * legitimate line could be rejected by a rounding mismatch between "how it
 * was built" and "how it's checked."
 *
 * Plain `Number` multiplication of two large integers (a paise-scale amount
 * times a micros-scale rate) can exceed Number.MAX_SAFE_INTEGER — e.g. a
 * ~1 crore rupee-equivalent foreign amount times an 8-digit micros rate is
 * already an 18-digit product. BigInt avoids the silent precision loss that
 * would otherwise be exactly the kind of float bug CLAUDE.md's "paise,
 * never REAL/float" rule exists to prevent.
 */
export function convertForeignToBase(foreignAmountMinor: number, exchangeRateMicros: number): number {
  if (!Number.isInteger(foreignAmountMinor) || foreignAmountMinor < 0) {
    throw new Error('Foreign amount must be a non-negative whole number of minor units');
  }
  if (!Number.isInteger(exchangeRateMicros) || exchangeRateMicros <= 0) {
    throw new Error('Exchange rate must be a positive whole number of micros');
  }

  const numerator = BigInt(foreignAmountMinor) * BigInt(exchangeRateMicros);
  const denominator = 1_000_000n;
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  // Half-up rounding: a remainder of half the denominator or more rounds up.
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;

  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Converted amount exceeds the safe integer range');
  }
  return Number(rounded);
}

/**
 * The inverse of convertForeignToBase, guaranteed to round-trip exactly —
 * i.e. convertForeignToBase(foreignAmountForBase(base, rate), rate) === base
 * always. Used where a base-currency total (e.g. an invoice's grand total,
 * already fixed by its own line items) needs a foreign-currency figure to
 * tag onto a single voucher_line (e.g. the party ledger's AR/AP line) for FX
 * exposure tracking — convertForeignToBase's rounding is many-to-one, so a
 * plain division can land 1 unit off; this nudges the candidate until the
 * forward conversion matches exactly.
 */
export function foreignAmountForBase(baseAmountPaise: number, exchangeRateMicros: number): number {
  if (!Number.isInteger(baseAmountPaise) || baseAmountPaise < 0) {
    throw new Error('Base amount must be a non-negative whole number of paise');
  }
  if (!Number.isInteger(exchangeRateMicros) || exchangeRateMicros <= 0) {
    throw new Error('Exchange rate must be a positive whole number of micros');
  }
  if (baseAmountPaise === 0) {
    return 0;
  }

  const numerator = BigInt(baseAmountPaise) * 1_000_000n;
  const denominator = BigInt(exchangeRateMicros);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  let candidate = Number(remainder * 2n >= denominator ? quotient + 1n : quotient);

  for (let attempts = 0; attempts < 4; attempts += 1) {
    if (convertForeignToBase(candidate, exchangeRateMicros) === baseAmountPaise) {
      return candidate;
    }
    candidate += convertForeignToBase(candidate, exchangeRateMicros) < baseAmountPaise ? 1 : -1;
  }
  throw new Error('Unable to find a foreign amount that round-trips to the given base amount at this exchange rate');
}
