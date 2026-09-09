import { useEffect, useState } from 'react';
import { ArrowLeft, Percent } from 'lucide-react';
import type { FixedAssetRateVersionSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EXAMPLES: Record<'SCHEDULE2' | 'IT_WDV', string> = {
  SCHEDULE2: '{ "method": "WDV", "ratePercent": 18.1 }',
  IT_WDV: '{ "ratePercent": 15 }',
};

/** Same generic RuleSet mirror as ManagePayrollRulesScreen/ManageGstRatesScreen — depreciation rates are never hardcoded (CLAUDE.md Rule #2). Unlike payroll's fixed six rule types, a fixed-asset rate's "category" is whatever the user chose when creating an asset class (assetClasses.schedule2RateCategory / itWdvBlockCategory), so this screen takes it as free text rather than a closed dropdown. */
export function ManageFixedAssetRatesScreen({ session, onBack }: Props) {
  const [active, setActive] = useState<FixedAssetRateVersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [book, setBook] = useState<'SCHEDULE2' | 'IT_WDV'>('SCHEDULE2');
  const [category, setCategory] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [payloadText, setPayloadText] = useState(EXAMPLES.SCHEDULE2);
  const [sourceReference, setSourceReference] = useState('');

  const canManage = session.permissions.includes('FIXED_ASSETS.MANAGE_ASSET_CLASSES');

  async function refreshActive() {
    const result = await window.mhts.listActiveFixedAssetRates();
    if (result.ok && result.data) {
      setActive(result.data);
    } else {
      setError(result.error ?? 'Failed to load fixed asset rates');
    }
  }

  useEffect(() => {
    refreshActive();
  }, []);

  useEffect(() => {
    setPayloadText(EXAMPLES[book]);
  }, [book]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let payload: unknown;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setError('Payload must be valid JSON');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.createOrUpdateFixedAssetRate({ book, category, effectiveFrom, payload, sourceReference: sourceReference || undefined });
    setSubmitting(false);
    if (result.ok) {
      setSourceReference('');
      await refreshActive();
    } else {
      setError(result.error ?? 'Failed to save fixed asset rate');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Percent size={18} style={{ color: 'var(--accent)' }} /> Manage fixed asset depreciation rates
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        Companies Act Schedule II (book depreciation) and Income Tax Act WDV block (tax depreciation) rates are each independently versioned, date-effective
        data — never hardcoded. Simplified starter defaults were seeded at installation; verify current rates with a CA before relying on these for a real
        filing.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Currently active rates</h2>
        {active === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule type</th>
                <th>Effective from</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {active.map((rate) => (
                <tr key={rate.id}>
                  <td>{rate.ruleType}</td>
                  <td>{rate.effectiveFrom}</td>
                  <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{JSON.stringify(rate.payload)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleSubmit} className="card">
          <h2>Add a new dated version</h2>
          <div className="field-row">
            <label className="field">
              Book
              <select value={book} onChange={(e) => setBook(e.target.value as 'SCHEDULE2' | 'IT_WDV')}>
                <option value="SCHEDULE2">Companies Act Schedule II</option>
                <option value="IT_WDV">Income Tax Act WDV block</option>
              </select>
            </label>
            <label className="field">
              Category (must match an asset class's rate category)
              <input value={category} onChange={(e) => setCategory(e.target.value)} required />
            </label>
            <label className="field">
              Effective from
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
            </label>
          </div>
          <label className="field">
            Payload (JSON)
            <textarea value={payloadText} onChange={(e) => setPayloadText(e.target.value)} rows={3} style={{ fontFamily: 'monospace' }} />
          </label>
          <label className="field">
            Note (optional)
            <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save new version'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
