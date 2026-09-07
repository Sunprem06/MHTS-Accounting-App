import { useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Fixed asset classes</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {classes === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Schedule II category</th>
              <th style={{ textAlign: 'left' }}>IT WDV block category</th>
              <th style={{ textAlign: 'left' }}>Gross block ledger</th>
              <th style={{ textAlign: 'left' }}>Accum. depreciation ledger</th>
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

      {canManage && (
        <form onSubmit={handleCreate}>
          <h2>New asset class</h2>
          <label>
            Name (e.g. "Computers &amp; Laptops")
            <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: 220 }} />
          </label>
          <br />
          <label>
            Schedule II rate category
            <input value={schedule2RateCategory} onChange={(e) => setSchedule2RateCategory(e.target.value)} required style={{ width: 220 }} />
          </label>{' '}
          <label>
            IT WDV block category
            <input value={itWdvBlockCategory} onChange={(e) => setItWdvBlockCategory(e.target.value)} required style={{ width: 220 }} />
          </label>
          <p style={{ fontSize: 12, color: '#666' }}>These category names must have a matching rate configured on Manage Fixed Asset Rates before this class can be depreciated.</p>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add asset class'}
          </button>
        </form>
      )}

      <p />
      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
