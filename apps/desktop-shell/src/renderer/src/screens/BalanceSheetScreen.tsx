import { useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Balance Sheet</h1>
      <p>
        <label>
          As of <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </label>{' '}
        <button type="button" onClick={refresh} disabled={loading}>
          {loading ? 'Loading…' : 'Run'}
        </button>
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {balanceSheet && (
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <h2>Assets</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {balanceSheet.assetRows.map((row) => (
                  <tr key={row.ledgerId}>
                    <td>{row.ledgerName}</td>
                    <td style={{ textAlign: 'right' }}>₹{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 'bold', borderTop: '1px solid #333' }}>
                  <td>Total Assets</td>
                  <td style={{ textAlign: 'right' }}>₹{balanceSheet.totalAssets.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ flex: 1 }}>
            <h2>Liabilities</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {balanceSheet.liabilityRows.map((row) => (
                  <tr key={row.ledgerId}>
                    <td>{row.ledgerName}</td>
                    <td style={{ textAlign: 'right' }}>₹{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>Equity</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {balanceSheet.equityRows.map((row) => (
                  <tr key={row.ledgerId}>
                    <td>{row.ledgerName}</td>
                    <td style={{ textAlign: 'right' }}>₹{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Current Earnings</td>
                  <td style={{ textAlign: 'right' }}>₹{balanceSheet.currentEarnings.toFixed(2)}</td>
                </tr>
                <tr style={{ fontWeight: 'bold', borderTop: '1px solid #333' }}>
                  <td>Total Liabilities &amp; Equity</td>
                  <td style={{ textAlign: 'right' }}>₹{balanceSheet.totalLiabilitiesAndEquity.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {balanceSheet && Math.abs(balanceSheet.totalAssets - balanceSheet.totalLiabilitiesAndEquity) > 0.005 && (
        <p style={{ color: 'crimson' }}>
          Assets do not equal Liabilities + Equity — this can happen if opening balances entered for different ledgers
          don't net to zero.
        </p>
      )}
      <p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
