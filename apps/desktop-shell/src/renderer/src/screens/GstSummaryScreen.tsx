import { useState } from 'react';
import type { GstSummaryResult } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

function startOfYearIso(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Output tax collected (sales) vs. input tax paid (purchases) for a period —
 * a reconciliation view proving the GST ledgers tie out, not GSTR-1/3B
 * filing-format output (deferred, see Phase Tracker Open Questions).
 */
export function GstSummaryScreen({ onBack }: Props) {
  const [fromDate, setFromDate] = useState(startOfYearIso());
  const [toDate, setToDate] = useState(todayIso());
  const [summary, setSummary] = useState<GstSummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    const result = await window.mhts.getGstSummary({ fromDate, toDate });
    setLoading(false);
    if (result.ok && result.data) {
      setSummary(result.data);
    } else {
      setError(result.error ?? 'Failed to load GST summary');
    }
  }

  const totalOutput = summary ? summary.outputCgst + summary.outputSgst + summary.outputIgst + summary.outputCess : 0;
  const totalInput = summary ? summary.inputCgst + summary.inputSgst + summary.inputIgst + summary.inputCess : 0;

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>GST summary</h1>
      <p>
        <label>
          From <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>{' '}
        <label>
          To <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>{' '}
        <button type="button" onClick={refresh} disabled={loading}>
          {loading ? 'Loading…' : 'Run'}
        </button>
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {summary && (
        <>
          <h2>Output tax collected (sales)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td>CGST</td>
                <td style={{ textAlign: 'right' }}>₹{summary.outputCgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>SGST</td>
                <td style={{ textAlign: 'right' }}>₹{summary.outputSgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>IGST</td>
                <td style={{ textAlign: 'right' }}>₹{summary.outputIgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Cess</td>
                <td style={{ textAlign: 'right' }}>₹{summary.outputCess.toFixed(2)}</td>
              </tr>
              <tr style={{ fontWeight: 'bold', borderTop: '1px solid #333' }}>
                <td>Total output tax</td>
                <td style={{ textAlign: 'right' }}>₹{totalOutput.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <h2>Input tax paid (purchases)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td>CGST</td>
                <td style={{ textAlign: 'right' }}>₹{summary.inputCgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>SGST</td>
                <td style={{ textAlign: 'right' }}>₹{summary.inputSgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>IGST</td>
                <td style={{ textAlign: 'right' }}>₹{summary.inputIgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Cess</td>
                <td style={{ textAlign: 'right' }}>₹{summary.inputCess.toFixed(2)}</td>
              </tr>
              <tr style={{ fontWeight: 'bold', borderTop: '1px solid #333' }}>
                <td>Total input tax</td>
                <td style={{ textAlign: 'right' }}>₹{totalInput.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <p style={{ fontSize: 12, color: '#666' }}>
            This is a ledger reconciliation view, not a GSTR-1/3B return — ITC eligibility, reverse charge and filing-format prep are a follow-up pass.
          </p>
        </>
      )}
      <p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
