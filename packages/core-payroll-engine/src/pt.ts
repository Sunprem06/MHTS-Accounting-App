import type { PtRulePayload } from './types';

/** Professional Tax has no headcount applicability threshold (unlike PF/ESI/Gratuity) — it's a flat monthly state-imposed tax gated only by gross salary slabs. A null rule (no jurisdiction configured, or the state genuinely has none) correctly resolves to zero rather than an invented amount. */
export function computePt(monthlyGrossEarnings: number, rule: PtRulePayload | null): number {
  if (!rule || rule.slabs.length === 0) {
    return 0;
  }
  const sortedSlabs = [...rule.slabs].sort((a, b) => a.aboveGrossThreshold - b.aboveGrossThreshold);
  let amount = 0;
  for (const slab of sortedSlabs) {
    if (monthlyGrossEarnings > slab.aboveGrossThreshold) {
      amount = slab.amount;
    }
  }
  return amount;
}
