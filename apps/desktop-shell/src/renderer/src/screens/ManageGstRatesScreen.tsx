import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Percent } from 'lucide-react';
import type { GstRateSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Admin-facing entry point for the Blueprint's "editable by admin without a
 * code deploy" requirement: rates are versioned by effective date (see
 * core-gst-engine's createOrUpdateGstRate) — submitting here never edits a
 * past rate in place, it supersedes it with a new dated row, so an old
 * invoice keeps resolving to whatever rate actually applied on its own date.
 * "Edit" on an existing row just pre-fills the form with that row's current
 * values (including category/description) so a future tax change only
 * requires changing the rate/effective-date, not retyping everything.
 */
export function ManageGstRatesScreen({ session, onBack }: Props) {
  const [rates, setRates] = useState<GstRateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [hsnSacCode, setHsnSacCode] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [ratePercent, setRatePercent] = useState(18);
  const [cessPercent, setCessPercent] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [sourceReference, setSourceReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = session.permissions.includes('GST.MANAGE_RATES');

  async function refresh() {
    const result = await window.mhts.listActiveGstRates();
    if (result.ok && result.data) {
      setRates(result.data);
    } else {
      setError(result.error ?? 'Failed to load GST rates');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const ratesByCategory = useMemo(() => {
    const groups = new Map<string, GstRateSummary[]>();
    for (const rate of rates ?? []) {
      const key = rate.category ?? 'Uncategorized';
      groups.set(key, [...(groups.get(key) ?? []), rate]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rates]);

  function startEdit(rate: GstRateSummary) {
    setHsnSacCode(rate.hsnSacCode);
    setCategory(rate.category ?? '');
    setDescription(rate.description ?? '');
    setRatePercent(rate.ratePercent);
    setCessPercent(rate.cessPercent);
    setEffectiveFrom(todayIso());
    setSourceReference('');
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createOrUpdateGstRate({
      hsnSacCode,
      ratePercent,
      cessPercent: cessPercent || undefined,
      effectiveFrom,
      sourceReference: sourceReference || undefined,
      category: category || undefined,
      description: description || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      setHsnSacCode('');
      setCategory('');
      setDescription('');
      setSourceReference('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to save GST rate');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Percent size={18} style={{ color: 'var(--accent)' }} /> Manage GST rates
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        Rates are looked up by HSN/SAC code and effective date — never hardcoded. A broad general-purpose starter catalog was seeded at
        installation; edit or add your own any time a rate changes. Verify every rate with a CA before relying on it for a real filing.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {rates === null ? (
          <p className="empty-state">Loading…</p>
        ) : rates.length === 0 ? (
          <p className="empty-state">No GST rates configured yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>HSN/SAC code</th>
                <th>Description</th>
                <th className="num">Rate (%)</th>
                <th className="num">Cess (%)</th>
                <th>Effective from</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ratesByCategory.map(([categoryName, categoryRates]) => (
                <Fragment key={categoryName}>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    <td colSpan={6} style={{ fontWeight: 600 }}>
                      {categoryName}
                    </td>
                  </tr>
                  {categoryRates.map((rate) => (
                    <tr key={rate.hsnSacCode}>
                      <td>{rate.hsnSacCode}</td>
                      <td style={{ fontSize: 13 }}>{rate.description ?? ''}</td>
                      <td className="num">{rate.ratePercent}</td>
                      <td className="num">{rate.cessPercent}</td>
                      <td>{rate.effectiveFrom}</td>
                      <td>{canManage && <button type="button" onClick={() => startEdit(rate)}>Edit</button>}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleSubmit} className="card">
          <h2>Add / update a rate</h2>
          <div className="field-row">
            <label className="field">
              HSN/SAC code
              <input value={hsnSacCode} onChange={(e) => setHsnSacCode(e.target.value)} required />
            </label>
            <label className="field">
              Category
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Electrical & Electronics" />
            </label>
            <label className="field">
              Description
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. LED lighting" />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              Rate (%)
              <input type="number" step="0.01" min="0" value={ratePercent} onChange={(e) => setRatePercent(Number(e.target.value) || 0)} required style={{ width: 100 }} />
            </label>
            <label className="field">
              Cess (%)
              <input type="number" step="0.01" min="0" value={cessPercent} onChange={(e) => setCessPercent(Number(e.target.value) || 0)} style={{ width: 100 }} />
            </label>
            <label className="field">
              Effective from
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
            </label>
          </div>
          <label className="field">
            Note (optional)
            <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="e.g. reason for this rate/change" />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save rate'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
