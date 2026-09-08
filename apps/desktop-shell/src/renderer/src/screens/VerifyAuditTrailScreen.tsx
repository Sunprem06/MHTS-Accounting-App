import { useState } from 'react';
import type { AuditChainVerificationResult } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

export function VerifyAuditTrailScreen({ onBack }: Props) {
  const [result, setResult] = useState<AuditChainVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleVerify() {
    setError(null);
    setResult(null);
    setBusy(true);
    const response = await window.mhts.verifyAuditTrail();
    setBusy(false);
    if (response.ok && response.data) {
      setResult(response.data);
    } else {
      setError(response.error ?? 'Failed to verify the audit trail');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Verify audit trail</h1>
      <p>
        Re-walks this company's entire append-only audit log and recomputes each row's tamper-evidence hash from
        scratch — confirms the chain is intact, not just that the database's own UPDATE/DELETE triggers are in place.
      </p>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {result && result.valid && <p style={{ color: 'var(--accent)' }}>Verified: all {result.rowsChecked} audit log row(s) form an intact, unbroken chain.</p>}
      {result && !result.valid && (
        <p style={{ color: 'var(--danger)' }}>
          Chain broken at row {result.brokenAtId}: {result.reason}
        </p>
      )}
      <p>
        <button type="button" onClick={handleVerify} disabled={busy}>
          {busy ? 'Verifying…' : 'Verify audit trail'}
        </button>
      </p>
      <p>
        <button type="button" onClick={onBack} disabled={busy}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
