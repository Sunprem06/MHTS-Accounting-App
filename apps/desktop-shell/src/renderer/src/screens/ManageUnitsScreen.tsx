import { useEffect, useState } from 'react';
import type { SessionInfo, UnitOfMeasureSummary } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function ManageUnitsScreen({ session, onBack }: Props) {
  const [units, setUnits] = useState<UnitOfMeasureSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = session.permissions.includes('INVENTORY.MANAGE_UNITS');

  async function refresh() {
    const result = await window.mhts.listUnitsOfMeasure();
    if (result.ok && result.data) {
      setUnits(result.data);
    } else {
      setError(result.error ?? 'Failed to load units');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createUnitOfMeasure({ name, symbol });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setSymbol('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create unit');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 560 }}>
      <h1>Units of Measure</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {units === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Symbol</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id}>
                <td>{unit.name}</td>
                <td>{unit.symbol}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <h2>New unit</h2>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>{' '}
          <label>
            Symbol
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)} required style={{ width: 80 }} />
          </label>
          <br />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add unit'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
