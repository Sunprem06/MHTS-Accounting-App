import { useState } from 'react';
import { ArrowLeft, TrendingDown } from 'lucide-react';
import type { DepreciationPreviewLine, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

/** SCHEDULE2 posts one DEPRECIATION voucher per asset class; IT_WDV is memo-only (tax books), never posted — the preview shows both so the difference between the two depreciation calculations is visible before committing. */
export function RunDepreciationScreen({ session, onBack }: Props) {
  const [financialYear, setFinancialYear] = useState('');
  const [preview, setPreview] = useState<DepreciationPreviewLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postedVoucherIds, setPostedVoucherIds] = useState<string[] | null>(null);

  const canRun = session.permissions.includes('FIXED_ASSETS.RUN_DEPRECIATION');

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPostedVoucherIds(null);
    setLoading(true);
    const result = await window.mhts.previewDepreciationRun({ financialYear });
    setLoading(false);
    if (result.ok && result.data) {
      setPreview(result.data);
    } else {
      setError(result.error ?? 'Failed to compute depreciation preview');
    }
  }

  async function handlePost() {
    setError(null);
    setPosting(true);
    const result = await window.mhts.postDepreciationRun({ financialYear });
    setPosting(false);
    if (result.ok && result.data) {
      setPostedVoucherIds(result.data.voucherIds);
      setPreview(null);
    } else {
      setError(result.error ?? 'Failed to post depreciation run');
    }
  }

  const schedule2Total = preview?.reduce((sum, l) => sum + l.schedule2Depreciation, 0) ?? 0;
  const itWdvTotal = preview?.reduce((sum, l) => sum + l.itWdvDepreciation, 0) ?? 0;

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <TrendingDown size={18} style={{ color: 'var(--accent)' }} /> Run depreciation
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}
      {postedVoucherIds && (
        <p className="badge badge-success" style={{ display: 'inline-block', marginBottom: 16 }}>
          Posted {postedVoucherIds.length} depreciation voucher(s) for {financialYear}.
        </p>
      )}

      <div className="card">
        <form onSubmit={handlePreview} className="field-row" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            Financial year (e.g. 2026-27)
            <input value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} required style={{ width: 140 }} />
          </label>
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginBottom: 12 }}>
            {loading ? 'Computing…' : 'Preview'}
          </button>
        </form>
      </div>

      {preview && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset code</th>
                <th>Name</th>
                <th className="num">Schedule II depreciation (₹)</th>
                <th className="num">IT WDV depreciation (₹)</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((line) => (
                <tr key={line.assetId}>
                  <td>{line.assetCode}</td>
                  <td>{line.assetName}</td>
                  <td className="num">{line.schedule2Depreciation.toFixed(2)}</td>
                  <td className="num">{line.itWdvDepreciation.toFixed(2)}</td>
                </tr>
              ))}
              {preview.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No assets pending depreciation for this financial year.
                  </td>
                </tr>
              )}
            </tbody>
            {preview.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="num">{schedule2Total.toFixed(2)}</td>
                  <td className="num">{itWdvTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 12, marginBottom: 0 }}>
            Posting will create one DEPRECIATION voucher per asset class for the Schedule II total above. The IT WDV total is memo-only (tax books) and is
            never posted to the general ledger.
          </p>
          {canRun && preview.length > 0 && (
            <div className="form-actions">
              <button type="button" className="btn-primary" onClick={handlePost} disabled={posting}>
                {posting ? 'Posting…' : 'Post depreciation run'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
