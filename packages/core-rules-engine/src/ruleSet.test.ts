import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempSystemDb } from '@mhts/test-support';
import type { TempDbHandle } from '@mhts/test-support';
import type { SystemDatabase } from '@mhts/db-schema';
import type { Kysely } from 'kysely';
import { createRuleSetVersion, listRuleSetVersions, resolveEffectiveRule } from './ruleSet';

/**
 * core-rules-engine is the shared date-effective versioned-rate resolver
 * every other rate-driven module (GST, vendor TDS, payroll statutory rates,
 * fixed-asset depreciation, FX) depends on — a bug here silently corrupts
 * every downstream computation, so this is the single highest-priority test
 * file in the whole suite.
 */
describe('core-rules-engine: createRuleSetVersion / resolveEffectiveRule', () => {
  let handle: TempDbHandle<SystemDatabase>;
  let systemDb: Kysely<SystemDatabase>;

  beforeEach(async () => {
    handle = await createTempSystemDb();
    systemDb = handle.db;
  });

  afterEach(async () => {
    await handle.close();
  });

  it('resolves null for a rule type that was never seeded', async () => {
    const resolved = await resolveEffectiveRule(systemDb, 'NEVER.SEEDED', null, '2026-01-01');
    expect(resolved).toBeNull();
  });

  it('resolves the exact payload just written, versioned at 1', async () => {
    await createRuleSetVersion(systemDb, {
      ruleType: 'TEST.RATE',
      jurisdiction: null,
      effectiveFrom: '2025-01-01',
      payload: { percent: 18 },
      sourceReference: 'unit test',
      createdBy: null,
    });

    const resolved = await resolveEffectiveRule<{ percent: number }>(systemDb, 'TEST.RATE', null, '2025-06-01');
    expect(resolved).not.toBeNull();
    expect(resolved!.payload).toEqual({ percent: 18 });
    expect(resolved!.version).toBe(1);
    expect(resolved!.effectiveTo).toBeNull();
  });

  it('returns null when queried before the rule\'s effective-from date', async () => {
    await createRuleSetVersion(systemDb, {
      ruleType: 'TEST.RATE',
      jurisdiction: null,
      effectiveFrom: '2025-06-01',
      payload: { percent: 18 },
      sourceReference: null,
      createdBy: null,
    });

    const resolved = await resolveEffectiveRule(systemDb, 'TEST.RATE', null, '2025-01-01');
    expect(resolved).toBeNull();
  });

  it('rate-change simulation: superseding a rule closes the old version and an old-dated lookup still returns the old rate, unchanged (the literal Blueprint exit criterion — zero code changes needed to pick up a new rate)', async () => {
    await createRuleSetVersion(systemDb, {
      ruleType: 'TEST.GST_RATE',
      jurisdiction: null,
      effectiveFrom: '2025-01-01',
      payload: { percent: 18 },
      sourceReference: 'v1',
      createdBy: null,
    });
    await createRuleSetVersion(systemDb, {
      ruleType: 'TEST.GST_RATE',
      jurisdiction: null,
      effectiveFrom: '2025-09-22',
      payload: { percent: 40 },
      sourceReference: 'v2 — GST 2.0 reform',
      createdBy: null,
    });

    const oldInvoiceRate = await resolveEffectiveRule<{ percent: number }>(systemDb, 'TEST.GST_RATE', null, '2025-03-15');
    expect(oldInvoiceRate!.payload.percent).toBe(18);
    expect(oldInvoiceRate!.version).toBe(1);
    expect(oldInvoiceRate!.effectiveTo).toBe('2025-09-21'); // closed the day before the new version starts

    const newInvoiceRate = await resolveEffectiveRule<{ percent: number }>(systemDb, 'TEST.GST_RATE', null, '2025-10-01');
    expect(newInvoiceRate!.payload.percent).toBe(40);
    expect(newInvoiceRate!.version).toBe(2);
    expect(newInvoiceRate!.effectiveTo).toBeNull();

    const versions = await listRuleSetVersions(systemDb, 'TEST.GST_RATE');
    expect(versions).toHaveLength(2);
  });

  it('prefers an exact jurisdiction match over the national/default (null) row on the same date', async () => {
    await createRuleSetVersion(systemDb, {
      ruleType: 'TEST.PT',
      jurisdiction: null,
      effectiveFrom: '2025-01-01',
      payload: { amount: 0 },
      sourceReference: 'no national default',
      createdBy: null,
    });
    await createRuleSetVersion(systemDb, {
      ruleType: 'TEST.PT',
      jurisdiction: 'IN-TN',
      effectiveFrom: '2025-01-01',
      payload: { amount: 20800 },
      sourceReference: 'Tamil Nadu PT slab',
      createdBy: null,
    });

    const tnResolved = await resolveEffectiveRule<{ amount: number }>(systemDb, 'TEST.PT', 'IN-TN', '2025-06-01');
    expect(tnResolved!.payload.amount).toBe(20800);

    const otherStateResolved = await resolveEffectiveRule<{ amount: number }>(systemDb, 'TEST.PT', 'IN-KA', '2025-06-01');
    expect(otherStateResolved!.payload.amount).toBe(0); // falls back to the national/default row
  });

  it('a SUPERSEDED row still correctly resolves for its own historical date range (an old invoice keeps its original rate forever, not just until the next lookup)', async () => {
    await createRuleSetVersion(systemDb, { ruleType: 'TEST.HIST', jurisdiction: null, effectiveFrom: '2020-01-01', payload: { v: 1 }, sourceReference: null, createdBy: null });
    await createRuleSetVersion(systemDb, { ruleType: 'TEST.HIST', jurisdiction: null, effectiveFrom: '2021-01-01', payload: { v: 2 }, sourceReference: null, createdBy: null });
    await createRuleSetVersion(systemDb, { ruleType: 'TEST.HIST', jurisdiction: null, effectiveFrom: '2022-01-01', payload: { v: 3 }, sourceReference: null, createdBy: null });

    const in2020 = await resolveEffectiveRule<{ v: number }>(systemDb, 'TEST.HIST', null, '2020-06-01');
    const in2021 = await resolveEffectiveRule<{ v: number }>(systemDb, 'TEST.HIST', null, '2021-06-01');
    const today = await resolveEffectiveRule<{ v: number }>(systemDb, 'TEST.HIST', null, '2026-01-01');

    expect(in2020!.payload.v).toBe(1);
    expect(in2021!.payload.v).toBe(2);
    expect(today!.payload.v).toBe(3);
  });
});
