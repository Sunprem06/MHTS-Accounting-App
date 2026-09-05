import { useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Chart of Accounts</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {ledgers === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Ledger</th>
              <th style={{ textAlign: 'left' }}>Group</th>
              <th style={{ textAlign: 'right' }}>Opening balance</th>
            </tr>
          </thead>
          <tbody>
            {ledgers.map((ledger) => (
              <tr key={ledger.id}>
                <td>{ledger.name}</td>
                <td>{ledger.groupName}</td>
                <td style={{ textAlign: 'right' }}>
                  ₹{ledger.openingBalance.toFixed(2)} {ledger.openingBalanceSide}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <h2>New ledger</h2>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <br />
          <label>
            Group
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.nature})
                </option>
              ))}
            </select>
          </label>
          <br />
          <label>
            Opening balance (₹)
            <input type="number" step="0.01" min="0" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </label>{' '}
          <select value={openingSide} onChange={(e) => setOpeningSide(e.target.value as 'DEBIT' | 'CREDIT')}>
            <option value="DEBIT">Debit</option>
            <option value="CREDIT">Credit</option>
          </select>
          <br />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add ledger'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
