import { useEffect, useState } from 'react';
import type { ExchangeRateVersionSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Same generic RuleSet mirror as ManagePayrollRulesScreen/ManageFixedAssetRatesScreen — exchange rates are never hardcoded (CLAUDE.md Rule #2), reusing @mhts/core-rules-engine's RuleSet mechanism as-is (rule_type 'FX_RATE.<CCY>'). */
export function ManageExchangeRatesScreen({ session, onBack }: Props) {
  const [active, setActive] = useState<ExchangeRateVersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [currency, setCurrency] = useState('USD');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [rate, setRate] = useState(0);
  const [sourceReference, setSourceReference] = useState('');

  const canManage = session.permissions.includes('MULTI_CURRENCY.MANAGE_EXCHANGE_RATES');

  async function refreshActive() {
    const result = await window.mhts.listActiveExchangeRates();
    if (result.ok && result.data) {
      setActive(result.data);
    } else {
      setError(result.error ?? 'Failed to load exchange rates');
    }
  }

  useEffect(() => {
    refreshActive();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.setExchangeRate({ currency: currency.toUpperCase(), effectiveFrom, rate, sourceReference: sourceReference || undefined });
    setSubmitting(false);
    if (result.ok) {
      setSourceReference('');
      await refreshActive();
    } else {
      setError(result.error ?? 'Failed to save exchange rate');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Manage exchange rates</h1>
      <p style={{ fontSize: 12, color: '#666' }}>
        Rates are versioned, date-effective data (per currency) — never hardcoded. A handful of illustrative starting rates were seeded at installation;
        verify against a live source before relying on these for a real invoice or settlement.
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <h2>Currently active rates</h2>
      {active === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Currency</th>
              <th style={{ textAlign: 'left' }}>Effective from</th>
              <th style={{ textAlign: 'right' }}>Rate (per 1 unit, in ₹)</th>
            </tr>
          </thead>
          <tbody>
            {active.map((r) => (
              <tr key={r.id}>
                <td>{r.currency}</td>
                <td>{r.effectiveFrom}</td>
                <td style={{ textAlign: 'right' }}>{r.rate.toFixed(4)}</td>
              </tr>
            ))}
            {active.length === 0 && (
              <tr>
                <td colSpan={3}>No exchange rates configured yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleSubmit}>
          <h2>Add a new dated version</h2>
          <label>
            Currency code (e.g. USD)
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} required style={{ width: 80 }} />
          </label>{' '}
          <label>
            Effective from
            <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
          </label>{' '}
          <label>
            Rate (₹ per 1 unit)
            <input type="number" step="0.0001" min="0.0001" value={rate || ''} onChange={(e) => setRate(Number(e.target.value) || 0)} required style={{ width: 120 }} />
          </label>
          <br />
          <label>
            Note (optional)
            <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} style={{ width: '100%' }} />
          </label>
          <br />
          <button type="submit" disabled={submitting || rate <= 0}>
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
