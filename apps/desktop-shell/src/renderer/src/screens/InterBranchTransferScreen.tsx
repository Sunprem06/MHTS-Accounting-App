import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowLeftRight } from 'lucide-react';
import type { BranchSummary, LedgerAccountSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onCreated: () => void;
  onBack: () => void;
}

/**
 * Posts one balanced 4-line INTER_BRANCH_TRANSFER voucher: Dr the source
 * branch's Inter-Branch Current A/c / Cr the source ledger (e.g. its Cash),
 * and Dr the destination ledger / Cr the destination branch's Inter-Branch
 * Current A/c — the standard branch-accounting current-account pattern (see
 * core-accounting's recordInterBranchTransfer).
 */
export function InterBranchTransferScreen({ session, onCreated, onBack }: Props) {
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [fromLedgerId, setFromLedgerId] = useState('');
  const [toLedgerId, setToLedgerId] = useState('');
  const [amountRupees, setAmountRupees] = useState(0);
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = session.permissions.includes('ACCOUNTING.MANAGE_BRANCHES');

  useEffect(() => {
    window.mhts.listBranches().then((r) => r.ok && r.data && setBranches(r.data));
    window.mhts.listLedgers().then((r) => r.ok && r.data && setLedgers(r.data));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.recordInterBranchTransfer({
      fromBranchId,
      toBranchId,
      fromLedgerId,
      toLedgerId,
      amountRupees,
      transferDate,
      narration: narration || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to record inter-branch transfer');
    }
  }

  if (!canManage) {
    return (
      <div className="page">
        <p className="empty-state">You do not have permission to record inter-branch transfers.</p>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack} disabled={submitting}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ArrowLeftRight size={18} style={{ color: 'var(--accent)' }} /> Inter-branch transfer
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field-row">
            <label className="field">
              Date
              <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} required />
            </label>
            <label className="field">
              Amount (₹)
              <input type="number" step="0.01" min="0.01" value={amountRupees || ''} onChange={(e) => setAmountRupees(Number(e.target.value) || 0)} required style={{ width: 160 }} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              From branch
              <select value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)} required>
                <option value="" disabled>
                  Select branch
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} disabled={b.id === toBranchId}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              From ledger (e.g. that branch's Cash/Bank)
              <select value={fromLedgerId} onChange={(e) => setFromLedgerId(e.target.value)} required>
                <option value="" disabled>
                  Select ledger
                </option>
                {ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              To branch
              <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)} required>
                <option value="" disabled>
                  Select branch
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} disabled={b.id === fromBranchId}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              To ledger (e.g. that branch's Cash/Bank)
              <select value={toLedgerId} onChange={(e) => setToLedgerId(e.target.value)} required>
                <option value="" disabled>
                  Select ledger
                </option>
                {ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Narration (optional)
            <input value={narration} onChange={(e) => setNarration(e.target.value)} />
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting || !fromBranchId || !toBranchId || !fromLedgerId || !toLedgerId || amountRupees <= 0}>
            {submitting ? 'Saving…' : 'Record transfer'}
          </button>
          <button type="button" onClick={onBack} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
