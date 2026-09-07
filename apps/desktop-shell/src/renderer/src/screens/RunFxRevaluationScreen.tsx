import { useState } from 'react';
import type { FxRevaluationLineDetail, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

/** Revalues every open foreign-currency exposure (FX invoice AR/AP balances, FX bank ledgers) to the as-of date's rate and posts ONE balanced FX_REVALUATION voucher for the net adjustment — see core-multi-currency's revaluation.ts. Re-running the same date is a no-op if nothing has moved since the last run. */
export function RunFxRevaluationScreen({ session, onBack }: Props) {
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<FxRevaluationLineDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postedVoucherId, setPostedVoucherId] = useState<string | null | undefined>(undefined);

  const canRun = session.permissions.includes('MULTI_CURRENCY.RUN_REVALUATION');

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPostedVoucherId(undefined);
    setLoading(true);
    const result = await window.mhts.previewFxRevaluation({ asOfDate });
    setLoading(false);
    if (result.ok && result.data) {
      setLines(result.data.lines);
    } else {
      setError(result.error ?? 'Failed to compute revaluation preview');
    }
  }

  async function handlePost() {
    setError(null);
    setPosting(true);
    const result = await window.mhts.postFxRevaluation({ asOfDate });
    setPosting(false);
    if (result.ok && result.data) {
      setPostedVoucherId(result.data.voucherId);
      setLines(null);
    } else {
      setError(result.error ?? 'Failed to post revaluation run');
    }
  }

  const nonZeroLines = lines?.filter((l) => l.adjustmentAmountRupees !== 0) ?? [];

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Run foreign currency revaluation</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {postedVoucherId !== undefined &&
        (postedVoucherId ? <p style={{ color: 'green' }}>Posted revaluation voucher for {asOfDate}.</p> : <p style={{ color: 'green' }}>No adjustment needed as of {asOfDate} — nothing posted.</p>)}

      <form onSubmit={handlePreview} style={{ marginBottom: 16 }}>
        <label>
          As of date
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} required />
        </label>{' '}
        <button type="submit" disabled={loading}>
          {loading ? 'Computing…' : 'Preview'}
        </button>
      </form>

      {lines && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Ledger</th>
                <th style={{ textAlign: 'left' }}>Currency</th>
                <th style={{ textAlign: 'right' }}>Foreign balance</th>
                <th style={{ textAlign: 'right' }}>Base before (₹)</th>
                <th style={{ textAlign: 'right' }}>Base after (₹)</th>
                <th style={{ textAlign: 'right' }}>Adjustment (₹)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td>{line.ledgerName}</td>
                  <td>{line.currency}</td>
                  <td style={{ textAlign: 'right' }}>{line.foreignBalanceUnits.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{line.baseBalanceBeforeRupees.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{line.baseBalanceAfterRupees.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{line.adjustmentAmountRupees.toFixed(2)}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={6}>No foreign-currency exposures found as of this date.</td>
                </tr>
              )}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: '#666' }}>
            Posting will create one FX_REVALUATION voucher for the {nonZeroLines.length} exposure(s) with a non-zero adjustment (Dr/Cr the ledger, offset to
            Unrealized Forex Gain/Loss). Exposures already at the current rate are skipped.
          </p>
          {canRun && nonZeroLines.length > 0 && (
            <button type="button" onClick={handlePost} disabled={posting}>
              {posting ? 'Posting…' : 'Post revaluation'}
            </button>
          )}
        </>
      )}

      <p />
      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
