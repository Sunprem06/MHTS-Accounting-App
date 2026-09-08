import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempSystemDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { SystemDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { resolveExchangeRate, setExchangeRate } from './exchangeRates';

describe('core-multi-currency: resolveExchangeRate / setExchangeRate', () => {
  let handle: TempDbHandle<SystemDatabase>;
  let systemDb: Kysely<SystemDatabase>;

  beforeEach(async () => {
    handle = await createTempSystemDb();
    systemDb = handle.db;
  });

  afterEach(async () => {
    await handle.close();
  });

  it('throws (not a silently invented default) when no rate is configured for a currency', async () => {
    await expect(resolveExchangeRate(systemDb, 'JPY', '2026-01-01')).rejects.toThrow(/No exchange rate configured/);
  });

  it('resolves the exact rate just set', async () => {
    await setExchangeRate(systemDb, { currency: 'USD', rateMicros: 83_250_000, effectiveFrom: '2025-04-01' }, null);
    expect(await resolveExchangeRate(systemDb, 'USD', '2025-06-01')).toBe(83_250_000);
  });

  it('rate-change simulation: a newer rate applies going forward, but an old-dated lookup (e.g. re-valuing a historical invoice) still gets the rate that was actually in force then', async () => {
    await setExchangeRate(systemDb, { currency: 'USD', rateMicros: 83_000_000, effectiveFrom: '2025-04-01' }, null);
    await setExchangeRate(systemDb, { currency: 'USD', rateMicros: 87_500_000, effectiveFrom: '2025-11-01' }, null);

    expect(await resolveExchangeRate(systemDb, 'USD', '2025-06-01')).toBe(83_000_000);
    expect(await resolveExchangeRate(systemDb, 'USD', '2026-01-01')).toBe(87_500_000);
  });

  it('currencies are independent — setting USD does not affect EUR', async () => {
    await setExchangeRate(systemDb, { currency: 'USD', rateMicros: 83_000_000, effectiveFrom: '2025-04-01' }, null);
    await setExchangeRate(systemDb, { currency: 'EUR', rateMicros: 90_000_000, effectiveFrom: '2025-04-01' }, null);
    expect(await resolveExchangeRate(systemDb, 'USD', '2025-06-01')).toBe(83_000_000);
    expect(await resolveExchangeRate(systemDb, 'EUR', '2025-06-01')).toBe(90_000_000);
  });

  it('rejects a non-positive or fractional rate', async () => {
    await expect(setExchangeRate(systemDb, { currency: 'USD', rateMicros: 0, effectiveFrom: '2025-04-01' }, null)).rejects.toThrow();
    await expect(setExchangeRate(systemDb, { currency: 'USD', rateMicros: -1, effectiveFrom: '2025-04-01' }, null)).rejects.toThrow();
  });
});
