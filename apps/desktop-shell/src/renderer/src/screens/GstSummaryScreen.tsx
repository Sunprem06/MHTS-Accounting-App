import { useState } from 'react';
import { ArrowLeft, Calculator } from 'lucide-react';
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
  const hasBlockedItc = summary ? summary.blockedItcCgst || summary.blockedItcSgst || summary.blockedItcIgst || summary.blockedItcCess : false;
  const hasRcmInward = summary ? summary.rcmInwardCgst || summary.rcmInwardSgst || summary.rcmInwardIgst || summary.rcmInwardCess : false;

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Calculator size={18} style={{ color: 'var(--accent)' }} /> GST summary
        </h1>
      </div>

      <div className="card">
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ maxWidth: 180 }}>
            From
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="field" style={{ maxWidth: 180 }}>
            To
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <button type="button" className="btn-primary" onClick={refresh} disabled={loading} style={{ marginBottom: 12 }}>
            {loading ? 'Loading…' : 'Run'}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {summary && (
        <>
          <div className="card">
            <h2>Output tax collected (sales)</h2>
            <table className="data-table">
              <tbody>
                <tr>
                  <td>CGST</td>
                  <td className="num">₹{summary.outputCgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>SGST</td>
                  <td className="num">₹{summary.outputSgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>IGST</td>
                  <td className="num">₹{summary.outputIgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Cess</td>
                  <td className="num">₹{summary.outputCess.toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Total output tax</td>
                  <td className="num">₹{totalOutput.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card">
            <h2>Input tax paid (purchases)</h2>
            <table className="data-table">
              <tbody>
                <tr>
                  <td>CGST</td>
                  <td className="num">₹{summary.inputCgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>SGST</td>
                  <td className="num">₹{summary.inputSgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>IGST</td>
                  <td className="num">₹{summary.inputIgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Cess</td>
                  <td className="num">₹{summary.inputCess.toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Total input tax</td>
                  <td className="num">₹{totalInput.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card">
            <h2>Net GST payable (after set-off)</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="num">Net payable (₹)</th>
                  <th className="num">Carried forward (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>CGST</td>
                  <td className="num">{summary.netCgstPayable.toFixed(2)}</td>
                  <td className="num">{summary.carryForwardCgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>SGST</td>
                  <td className="num">{summary.netSgstPayable.toFixed(2)}</td>
                  <td className="num">{summary.carryForwardSgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>IGST</td>
                  <td className="num">{summary.netIgstPayable.toFixed(2)}</td>
                  <td className="num">{summary.carryForwardIgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Cess</td>
                  <td className="num">{summary.netCessPayable.toFixed(2)}</td>
                  <td className="num">{summary.carryForwardCess.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ color: 'var(--fg-muted)', fontSize: 12, marginTop: 12, marginBottom: 0 }}>
              Standard set-off order (IGST credit first, then CGST, then SGST) — not a cash-minimizing optimizer. Excludes reverse-charge
              liability below, which must be paid in cash and isn't eligible for set-off this period.
            </p>
          </div>

          {(hasBlockedItc || hasRcmInward) && (
            <div className="card">
              {hasBlockedItc && (
                <>
                  <h2>Blocked ITC (added to cost, not claimed)</h2>
                  <p style={{ marginTop: 0 }}>
                    CGST ₹{summary.blockedItcCgst.toFixed(2)} · SGST ₹{summary.blockedItcSgst.toFixed(2)} · IGST ₹{summary.blockedItcIgst.toFixed(2)} · Cess ₹
                    {summary.blockedItcCess.toFixed(2)}
                  </p>
                </>
              )}
              {hasRcmInward && (
                <>
                  <h2>Reverse charge self-assessed (must pay in cash)</h2>
                  <p style={{ marginBottom: 0 }}>
                    CGST ₹{summary.rcmInwardCgst.toFixed(2)} · SGST ₹{summary.rcmInwardSgst.toFixed(2)} · IGST ₹{summary.rcmInwardIgst.toFixed(2)} · Cess ₹
                    {summary.rcmInwardCess.toFixed(2)}
                  </p>
                </>
              )}
            </div>
          )}

          <p style={{ color: 'var(--fg-muted)', fontSize: 12 }}>
            This is a ledger reconciliation view, not a GSTR-1/3B return itself — see the GST Returns screen for GSTR-1/3B/9/9C prep data.
          </p>
        </>
      )}
    </div>
  );
}
