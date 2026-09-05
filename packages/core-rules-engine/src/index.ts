// Shared RuleSet resolution service consumed by core-sales-purchase (TDS section
// rates) and, in later phases, core-gst-engine and core-payroll-engine (Blueprint
// §3) — date-effective lookup + versioning (Blueprint §2), so a rate/threshold
// change is a new data row, never a code change (CLAUDE.md Rule #2).
export { createRuleSetVersion, resolveEffectiveRule, listRuleSetVersions } from './ruleSet';
export type { RuleSetVersionInput, ResolvedRule } from './ruleSet';
