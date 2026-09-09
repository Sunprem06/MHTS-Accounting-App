import { useEffect, useState } from 'react';
import { ArrowLeft, GitBranch } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <GitBranch size={18} style={{ color: 'var(--accent)' }} /> Branches
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {branches === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Address</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} style={{ opacity: branch.isActive ? 1 : 0.6 }}>
                  <td>{branch.name}</td>
                  <td>{branch.code ?? '—'}</td>
                  <td>{branch.address ?? '—'}</td>
                  <td>
                    <span className={`badge ${branch.isActive ? 'badge-success' : 'badge-muted'}`}>{branch.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td>{canManage && <button onClick={() => toggleActive(branch)}>{branch.isActive ? 'Deactivate' : 'Activate'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New branch</h2>
          <div className="field-row">
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Code (optional)
              <input value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 120 }} />
            </label>
            <label className="field" style={{ flex: 2 }}>
              Address (optional)
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add branch'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
