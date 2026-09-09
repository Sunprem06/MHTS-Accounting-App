import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import type { AccountGroupSummary, LedgerAccountSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function ChartOfAccountsScreen({ session, onBack }: Props) {
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[] | null>(null);
  const [groups, setGroups] = useState<AccountGroupSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingSide, setOpeningSide] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [submitting, setSubmitting] = useState(false);

  const canManage = session.permissions.includes('ACCOUNTING.MANAGE_CHART_OF_ACCOUNTS');

  async function refresh() {
    const [ledgersResult, groupsResult] = await Promise.all([window.mhts.listLedgers(), window.mhts.listAccountGroups()]);
    if (ledgersResult.ok && ledgersResult.data) {
      setLedgers(ledgersResult.data);
    } else {
      setError(ledgersResult.error ?? 'Failed to load ledgers');
    }
    if (groupsResult.ok && groupsResult.data) {
      setGroups(groupsResult.data);
      if (!groupId && groupsResult.data.length > 0) {
        setGroupId(groupsResult.data[0].id);
      }
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createLedger({
      name,
      groupId,
      openingBalanceRupees: Number(openingBalance) || 0,
      openingBalanceSide: openingSide,
    });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setOpeningBalance('0');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create ledger');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <BookOpen size={18} style={{ color: 'var(--accent)' }} /> Chart of accounts
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {ledgers === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ledger</th>
                <th>Group</th>
                <th className="num">Opening balance</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.map((ledger) => (
                <tr key={ledger.id}>
                  <td>{ledger.name}</td>
                  <td>{ledger.groupName}</td>
                  <td className="num">
                    ₹{ledger.openingBalance.toFixed(2)} {ledger.openingBalanceSide}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New ledger</h2>
          <div className="field-row">
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Group
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.nature})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Opening balance (₹)
              <input type="number" step="0.01" min="0" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} style={{ width: 140 }} />
            </label>
            <label className="field">
              Side
              <select value={openingSide} onChange={(e) => setOpeningSide(e.target.value as 'DEBIT' | 'CREDIT')}>
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add ledger'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
