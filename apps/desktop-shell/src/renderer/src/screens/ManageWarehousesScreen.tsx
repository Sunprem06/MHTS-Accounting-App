import { useEffect, useState } from 'react';
import { ArrowLeft, Warehouse } from 'lucide-react';
import type { SessionInfo, WarehouseSummary } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function ManageWarehousesScreen({ session, onBack }: Props) {
  const [warehouses, setWarehouses] = useState<WarehouseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = session.permissions.includes('INVENTORY.MANAGE_WAREHOUSES');

  async function refresh() {
    const result = await window.mhts.listWarehouses();
    if (result.ok && result.data) {
      setWarehouses(result.data);
    } else {
      setError(result.error ?? 'Failed to load warehouses');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createWarehouse({ name, address: address || undefined });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setAddress('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create warehouse');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Warehouse size={18} style={{ color: 'var(--accent)' }} /> Warehouses
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {warehouses === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((warehouse) => (
                <tr key={warehouse.id}>
                  <td>{warehouse.name}</td>
                  <td>{warehouse.address ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New warehouse</h2>
          <div className="field-row">
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Address
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add warehouse'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
