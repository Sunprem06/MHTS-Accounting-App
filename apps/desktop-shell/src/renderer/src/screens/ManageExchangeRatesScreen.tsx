import { useEffect, useState } from 'react';
import { ArrowLeft, Coins } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Coins size={18} style={{ color: 'var(--accent)' }} /> Manage exchange rates
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        Rates are versioned, date-effective data (per currency) — never hardcoded. A handful of illustrative starting rates were seeded at installation;
        verify against a live source before relying on these for a real invoice or settlement.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Currently active rates</h2>
        {active === null ? (
          <p className="empty-state">Loading…</p>
        ) : active.length === 0 ? (
          <p className="empty-state">No exchange rates configured yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Currency</th>
                <th>Effective from</th>
                <th className="num">Rate (per 1 unit, in ₹)</th>
              </tr>
            </thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.id}>
                  <td>{r.currency}</td>
                  <td>{r.effectiveFrom}</td>
                  <td className="num">{r.rate.toFixed(4)}</td>
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
              Currency code (e.g. USD)
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} required style={{ width: 100 }} />
            </label>
            <label className="field">
              Effective from
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
            </label>
            <label className="field">
              Rate (₹ per 1 unit)
              <input type="number" step="0.0001" min="0.0001" value={rate || ''} onChange={(e) => setRate(Number(e.target.value) || 0)} required style={{ width: 140 }} />
            </label>
          </div>
          <label className="field">
            Note (optional)
            <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting || rate <= 0}>
              {submitting ? 'Saving…' : 'Save new version'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
