import { verifyAuditChain } from '@mhts/core-audit';
import { requireSessionWithCompanyDb } from './session';
import type { AuditChainVerificationResult } from '../shared/ipc';

/**
 * Phase 11's tamper-DETECTION half of Rule #5 — the DB triggers
 * (company/migrations/001_init.ts) already block UPDATE/DELETE, but nothing
 * previously let a user actually check the chain itself for a break (e.g.
 * from a crafted direct-file-access INSERT the triggers don't cover).
 */
export async function verifyAuditTrail(): Promise<AuditChainVerificationResult> {
  const { companyDb } = requireSessionWithCompanyDb('SYSTEM.VIEW_AUDIT_LOG');
  return verifyAuditChain(companyDb);
}
