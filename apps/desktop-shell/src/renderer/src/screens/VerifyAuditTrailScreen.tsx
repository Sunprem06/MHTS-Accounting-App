import { useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack} disabled={busy}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ShieldCheck size={18} style={{ color: 'var(--accent)' }} /> Verify audit trail
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        Re-walks this company's entire append-only audit log and recomputes each row's tamper-evidence hash from scratch — confirms the chain is intact, not
        just that the database's own UPDATE/DELETE triggers are in place.
      </p>

      {error && <p className="error-text">{error}</p>}
      {result && result.valid && (
        <p className="badge badge-success" style={{ display: 'inline-block', marginBottom: 16 }}>
          Verified: all {result.rowsChecked} audit log row(s) form an intact, unbroken chain.
        </p>
      )}
      {result && !result.valid && (
        <p className="error-text">
          Chain broken at row {result.brokenAtId}: {result.reason}
        </p>
      )}

      <div className="card">
        <button type="button" className="btn-primary" onClick={handleVerify} disabled={busy}>
          {busy ? 'Verifying…' : 'Verify audit trail'}
        </button>
      </div>
    </div>
  );
}
