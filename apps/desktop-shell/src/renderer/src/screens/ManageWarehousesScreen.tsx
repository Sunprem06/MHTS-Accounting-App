import { useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 560 }}>
      <h1>Warehouses</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {warehouses === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Address</th>
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

      {canManage && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <h2>New warehouse</h2>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>{' '}
          <label>
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <br />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add warehouse'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
