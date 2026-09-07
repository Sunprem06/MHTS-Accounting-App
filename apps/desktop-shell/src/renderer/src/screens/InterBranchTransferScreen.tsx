import { useEffect, useState } from 'react';
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
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <p>You do not have permission to record inter-branch transfers.</p>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 600 }}>
      <h1>Inter-branch transfer</h1>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Date
          <br />
          <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} required />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          From branch
          <br />
          <select value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)} required style={{ width: '100%' }}>
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
        <label style={{ display: 'block', marginBottom: 8 }}>
          From ledger (e.g. that branch's Cash/Bank)
          <br />
          <select value={fromLedgerId} onChange={(e) => setFromLedgerId(e.target.value)} required style={{ width: '100%' }}>
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
        <label style={{ display: 'block', marginBottom: 8 }}>
          To branch
          <br />
          <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)} required style={{ width: '100%' }}>
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
        <label style={{ display: 'block', marginBottom: 8 }}>
          To ledger (e.g. that branch's Cash/Bank)
          <br />
          <select value={toLedgerId} onChange={(e) => setToLedgerId(e.target.value)} required style={{ width: '100%' }}>
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
        <label style={{ display: 'block', marginBottom: 8 }}>
          Amount (₹)
          <br />
          <input type="number" step="0.01" min="0.01" value={amountRupees || ''} onChange={(e) => setAmountRupees(Number(e.target.value) || 0)} required />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Narration (optional)
          <br />
          <input value={narration} onChange={(e) => setNarration(e.target.value)} style={{ width: '100%' }} />
        </label>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={submitting || !fromBranchId || !toBranchId || !fromLedgerId || !toLedgerId || amountRupees <= 0}>
          {submitting ? 'Saving…' : 'Record transfer'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
