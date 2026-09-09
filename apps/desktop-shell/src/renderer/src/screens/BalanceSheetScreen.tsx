import { useState } from 'react';
import { ArrowLeft, Scale } from 'lucide-react';
import type { BalanceSheetResult } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BalanceSheetScreen({ onBack }: Props) {
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    const result = await window.mhts.getBalanceSheet(asOfDate);
    setLoading(false);
    if (result.ok && result.data) {
      setBalanceSheet(result.data);
    } else {
      setError(result.error ?? 'Failed to load Balance Sheet');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Scale size={18} style={{ color: 'var(--accent)' }} /> Balance sheet
        </h1>
      </div>

      <div className="card">
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ maxWidth: 200 }}>
            As of
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </label>
          <button type="button" className="btn-primary" onClick={refresh} disabled={loading} style={{ marginBottom: 12 }}>
            {loading ? 'Loading…' : 'Run'}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {balanceSheet && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: 1, minWidth: 300 }}>
            <h2>Assets</h2>
            <table className="data-table">
              <tbody>
                {balanceSheet.assetRows.map((row) => (
                  <tr key={row.ledgerId}>
                    <td>{row.ledgerName}</td>
                    <td className="num">₹{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total Assets</td>
                  <td className="num">₹{balanceSheet.totalAssets.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card" style={{ flex: 1, minWidth: 300 }}>
            <h2>Liabilities</h2>
            <table className="data-table" style={{ marginBottom: 20 }}>
              <tbody>
                {balanceSheet.liabilityRows.map((row) => (
                  <tr key={row.ledgerId}>
                    <td>{row.ledgerName}</td>
                    <td className="num">₹{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>Equity</h2>
            <table className="data-table">
              <tbody>
                {balanceSheet.equityRows.map((row) => (
                  <tr key={row.ledgerId}>
                    <td>{row.ledgerName}</td>
                    <td className="num">₹{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Current Earnings</td>
                  <td className="num">₹{balanceSheet.currentEarnings.toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Total Liabilities &amp; Equity</td>
                  <td className="num">₹{balanceSheet.totalLiabilitiesAndEquity.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {balanceSheet && Math.abs(balanceSheet.totalAssets - balanceSheet.totalLiabilitiesAndEquity) > 0.005 && (
        <p className="error-text">
          Assets do not equal Liabilities + Equity — this can happen if opening balances entered for different ledgers don't net to zero.
        </p>
      )}
    </div>
  );
}
