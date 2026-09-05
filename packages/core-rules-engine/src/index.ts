// Shared RuleSet resolution service consumed by core-gst-engine and core-payroll-engine
// (Blueprint §3). The RuleSet table itself (packages/db-schema/src/system) is in place;
// the resolution logic (effective-date lookup, versioning, override precedence) is
// deliberately out of scope for this pass — schema only, per this session's request.
export {};
