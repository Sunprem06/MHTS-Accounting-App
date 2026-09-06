import { Fragment, useEffect, useMemo, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Manage GST rates</h1>
      <p style={{ fontSize: 12, color: '#666' }}>
        Rates are looked up by HSN/SAC code and effective date — never hardcoded. A broad general-purpose starter catalog was seeded at
        installation; edit or add your own any time a rate changes. Verify every rate with a CA before relying on it for a real filing.
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {rates === null ? (
        <p>Loading…</p>
      ) : rates.length === 0 ? (
        <p>No GST rates configured yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>HSN/SAC code</th>
              <th style={{ textAlign: 'left' }}>Description</th>
              <th style={{ textAlign: 'right' }}>Rate (%)</th>
              <th style={{ textAlign: 'right' }}>Cess (%)</th>
              <th style={{ textAlign: 'left' }}>Effective from</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ratesByCategory.map(([categoryName, categoryRates]) => (
              <Fragment key={categoryName}>
                <tr style={{ background: 'rgba(127,127,127,0.1)' }}>
                  <td colSpan={6} style={{ fontWeight: 'bold', padding: '4px 0' }}>
                    {categoryName}
                  </td>
                </tr>
                {categoryRates.map((rate) => (
                  <tr key={rate.hsnSacCode}>
                    <td>{rate.hsnSacCode}</td>
                    <td style={{ fontSize: 13 }}>{rate.description ?? ''}</td>
                    <td style={{ textAlign: 'right' }}>{rate.ratePercent}</td>
                    <td style={{ textAlign: 'right' }}>{rate.cessPercent}</td>
                    <td>{rate.effectiveFrom}</td>
                    <td>
                      {canManage && (
                        <button type="button" onClick={() => startEdit(rate)} style={{ fontSize: 11 }}>
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <h2>Add / update a rate</h2>
          <label>
            HSN/SAC code
            <input value={hsnSacCode} onChange={(e) => setHsnSacCode(e.target.value)} required />
          </label>{' '}
          <label>
            Category
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Electrical & Electronics" style={{ width: 200 }} />
          </label>{' '}
          <label>
            Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. LED lighting" style={{ width: 200 }} />
          </label>
          <br />
          <label>
            Rate (%)
            <input type="number" step="0.01" min="0" value={ratePercent} onChange={(e) => setRatePercent(Number(e.target.value) || 0)} required style={{ width: 80 }} />
          </label>{' '}
          <label>
            Cess (%)
            <input type="number" step="0.01" min="0" value={cessPercent} onChange={(e) => setCessPercent(Number(e.target.value) || 0)} style={{ width: 80 }} />
          </label>{' '}
          <label>
            Effective from
            <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
          </label>
          <br />
          <label>
            Note (optional)
            <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} style={{ width: '100%' }} placeholder="e.g. reason for this rate/change" />
          </label>
          <br />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save rate'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
