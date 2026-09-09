import { useEffect, useState } from 'react';
import { ArrowLeft, Ruler } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Ruler size={18} style={{ color: 'var(--accent)' }} /> Units of measure
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {units === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Symbol</th>
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
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New unit</h2>
          <div className="field-row">
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Symbol
              <input value={symbol} onChange={(e) => setSymbol(e.target.value)} required style={{ width: 100 }} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add unit'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
