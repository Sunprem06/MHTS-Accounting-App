import { useEffect, useState } from 'react';
import { Archive, ArrowLeft } from 'lucide-react';
import type { AssetClassSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

/** Each asset class gets its own dedicated gross-block and accumulated-depreciation ledgers, created atomically — matching the rate categories configured on the Manage Fixed Asset Rates screen. */
export function FixedAssetClassesScreen({ session, onBack }: Props) {
  const [classes, setClasses] = useState<AssetClassSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [schedule2RateCategory, setSchedule2RateCategory] = useState('');
  const [itWdvBlockCategory, setItWdvBlockCategory] = useState('');

  const canManage = session.permissions.includes('FIXED_ASSETS.MANAGE_ASSET_CLASSES');

  async function refresh() {
    const result = await window.mhts.listAssetClasses();
    if (result.ok && result.data) {
      setClasses(result.data);
    } else {
      setError(result.error ?? 'Failed to load asset classes');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createAssetClass({ name, schedule2RateCategory, itWdvBlockCategory });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setSchedule2RateCategory('');
      setItWdvBlockCategory('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create asset class');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Archive size={18} style={{ color: 'var(--accent)' }} /> Fixed asset classes
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {classes === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Schedule II category</th>
                <th>IT WDV block category</th>
                <th>Gross block ledger</th>
                <th>Accum. depreciation ledger</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.6 }}>
                  <td>{c.name}</td>
                  <td>{c.schedule2RateCategory}</td>
                  <td>{c.itWdvBlockCategory}</td>
                  <td>{c.grossBlockLedgerName}</td>
                  <td>{c.accumulatedDepreciationLedgerName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New asset class</h2>
          <div className="field-row">
            <label className="field">
              Name (e.g. "Computers &amp; Laptops")
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Schedule II rate category
              <input value={schedule2RateCategory} onChange={(e) => setSchedule2RateCategory(e.target.value)} required />
            </label>
            <label className="field">
              IT WDV block category
              <input value={itWdvBlockCategory} onChange={(e) => setItWdvBlockCategory(e.target.value)} required />
            </label>
          </div>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: -6 }}>
            These category names must have a matching rate configured on Manage Fixed Asset Rates before this class can be depreciated.
          </p>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add asset class'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
