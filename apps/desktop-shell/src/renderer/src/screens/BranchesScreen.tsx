import { useEffect, useState } from 'react';
import type { BranchSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

/** Branches are a dimension tag any voucher line can optionally carry (see Journal/Payment/Receipt/Contra screens' branch selector), plus each branch gets its own dedicated Inter-Branch Current Account ledger (see InterBranchTransferScreen). */
export function BranchesScreen({ session, onBack }: Props) {
  const [branches, setBranches] = useState<BranchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = session.permissions.includes('ACCOUNTING.MANAGE_BRANCHES');

  async function refresh() {
    const result = await window.mhts.listBranches();
    if (result.ok && result.data) {
      setBranches(result.data);
    } else {
      setError(result.error ?? 'Failed to load branches');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createBranch({ name, code: code || undefined, address: address || undefined });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setCode('');
      setAddress('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create branch');
    }
  }

  async function toggleActive(branch: BranchSummary) {
    const result = await window.mhts.updateBranch({ branchId: branch.id, isActive: !branch.isActive });
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to update branch');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Branches</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {branches === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Code</th>
              <th style={{ textAlign: 'left' }}>Address</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id} style={{ opacity: branch.isActive ? 1 : 0.6 }}>
                <td>{branch.name}</td>
                <td>{branch.code ?? '—'}</td>
                <td>{branch.address ?? '—'}</td>
                <td>{branch.isActive ? 'Active' : 'Inactive'}</td>
                <td>{canManage && <button onClick={() => toggleActive(branch)}>{branch.isActive ? 'Deactivate' : 'Activate'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <h2>New branch</h2>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>{' '}
          <label>
            Code (optional)
            <input value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 100 }} />
          </label>{' '}
          <label>
            Address (optional)
            <input value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: 260 }} />
          </label>{' '}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add branch'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
