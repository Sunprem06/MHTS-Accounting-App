import { useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Manage fixed asset depreciation rates</h1>
      <p style={{ fontSize: 12, color: '#666' }}>
        Companies Act Schedule II (book depreciation) and Income Tax Act WDV block (tax depreciation) rates are each independently versioned, date-effective
        data — never hardcoded. Simplified starter defaults were seeded at installation; verify current rates with a CA before relying on these for a real
        filing.
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <h2>Currently active rates</h2>
      {active === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Rule type</th>
              <th style={{ textAlign: 'left' }}>Effective from</th>
              <th style={{ textAlign: 'left' }}>Payload</th>
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

      {canManage && (
        <form onSubmit={handleSubmit}>
          <h2>Add a new dated version</h2>
          <label>
            Book
            <select value={book} onChange={(e) => setBook(e.target.value as 'SCHEDULE2' | 'IT_WDV')}>
              <option value="SCHEDULE2">Companies Act Schedule II</option>
              <option value="IT_WDV">Income Tax Act WDV block</option>
            </select>
          </label>{' '}
          <label>
            Category (must match an asset class's rate category)
            <input value={category} onChange={(e) => setCategory(e.target.value)} required style={{ width: 220 }} />
          </label>{' '}
          <label>
            Effective from
            <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
          </label>
          <br />
          <label style={{ display: 'block' }}>
            Payload (JSON)
            <textarea value={payloadText} onChange={(e) => setPayloadText(e.target.value)} rows={3} style={{ width: '100%', fontFamily: 'monospace' }} />
          </label>
          <label>
            Note (optional)
            <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} style={{ width: '100%' }} />
          </label>
          <br />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save new version'}
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
