import { useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Run depreciation</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {postedVoucherIds && <p style={{ color: 'green' }}>Posted {postedVoucherIds.length} depreciation voucher(s) for {financialYear}.</p>}

      <form onSubmit={handlePreview} style={{ marginBottom: 16 }}>
        <label>
          Financial year (e.g. 2026-27)
          <input value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} required style={{ width: 100 }} />
        </label>{' '}
        <button type="submit" disabled={loading}>
          {loading ? 'Computing…' : 'Preview'}
        </button>
      </form>

      {preview && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Asset code</th>
                <th style={{ textAlign: 'left' }}>Name</th>
                <th style={{ textAlign: 'right' }}>Schedule II depreciation (₹)</th>
                <th style={{ textAlign: 'right' }}>IT WDV depreciation (₹)</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((line) => (
                <tr key={line.assetId}>
                  <td>{line.assetCode}</td>
                  <td>{line.assetName}</td>
                  <td style={{ textAlign: 'right' }}>{line.schedule2Depreciation.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{line.itWdvDepreciation.toFixed(2)}</td>
                </tr>
              ))}
              {preview.length === 0 && (
                <tr>
                  <td colSpan={4}>No assets pending depreciation for this financial year.</td>
                </tr>
              )}
            </tbody>
            {preview.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 'bold' }}>
                  <td colSpan={2}>Total</td>
                  <td style={{ textAlign: 'right' }}>{schedule2Total.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{itWdvTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          <p style={{ fontSize: 12, color: '#666' }}>
            Posting will create one DEPRECIATION voucher per asset class for the Schedule II total above. The IT WDV total is memo-only (tax books) and is
            never posted to the general ledger.
          </p>
          {canRun && preview.length > 0 && (
            <button type="button" onClick={handlePost} disabled={posting}>
              {posting ? 'Posting…' : 'Post depreciation run'}
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
