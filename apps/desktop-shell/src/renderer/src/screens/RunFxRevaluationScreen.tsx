import { useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <RefreshCw size={18} style={{ color: 'var(--accent)' }} /> Run foreign currency revaluation
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}
      {postedVoucherId !== undefined && (
        <p className="badge badge-success" style={{ display: 'inline-block', marginBottom: 16 }}>
          {postedVoucherId ? `Posted revaluation voucher for ${asOfDate}.` : `No adjustment needed as of ${asOfDate} — nothing posted.`}
        </p>
      )}

      <div className="card">
        <form onSubmit={handlePreview} className="field-row" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            As of date
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} required />
          </label>
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginBottom: 12 }}>
            {loading ? 'Computing…' : 'Preview'}
          </button>
        </form>
      </div>

      {lines && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ledger</th>
                <th>Currency</th>
                <th className="num">Foreign balance</th>
                <th className="num">Base before (₹)</th>
                <th className="num">Base after (₹)</th>
                <th className="num">Adjustment (₹)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td>{line.ledgerName}</td>
                  <td>{line.currency}</td>
                  <td className="num">{line.foreignBalanceUnits.toFixed(2)}</td>
                  <td className="num">{line.baseBalanceBeforeRupees.toFixed(2)}</td>
                  <td className="num">{line.baseBalanceAfterRupees.toFixed(2)}</td>
                  <td className="num">{line.adjustmentAmountRupees.toFixed(2)}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No foreign-currency exposures found as of this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 12, marginBottom: 0 }}>
            Posting will create one FX_REVALUATION voucher for the {nonZeroLines.length} exposure(s) with a non-zero adjustment (Dr/Cr the ledger, offset to
            Unrealized Forex Gain/Loss). Exposures already at the current rate are skipped.
          </p>
          {canRun && nonZeroLines.length > 0 && (
            <div className="form-actions">
              <button type="button" className="btn-primary" onClick={handlePost} disabled={posting}>
                {posting ? 'Posting…' : 'Post revaluation'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
