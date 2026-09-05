import { useState } from 'react';
import type { ProfitAndLossResult } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

function startOfYearIso(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ProfitAndLossScreen({ onBack }: Props) {
  const [fromDate, setFromDate] = useState(startOfYearIso());
  const [toDate, setToDate] = useState(todayIso());
  const [pnl, setPnl] = useState<ProfitAndLossResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    const result = await window.mhts.getProfitAndLoss({ fromDate, toDate });
    setLoading(false);
    if (result.ok && result.data) {
      setPnl(result.data);
    } else {
      setError(result.error ?? 'Failed to load Profit & Loss');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Profit &amp; Loss</h1>
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
      {pnl && (
        <>
          <h2>Income</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {pnl.incomeRows.map((row) => (
                <tr key={row.ledgerId}>
                  <td>{row.ledgerName}</td>
                  <td>{row.groupName}</td>
                  <td style={{ textAlign: 'right' }}>₹{row.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', borderTop: '1px solid #333' }}>
                <td colSpan={2}>Total Income</td>
                <td style={{ textAlign: 'right' }}>₹{pnl.totalIncome.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <h2>Expenses</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {pnl.expenseRows.map((row) => (
                <tr key={row.ledgerId}>
                  <td>{row.ledgerName}</td>
                  <td>{row.groupName}</td>
                  <td style={{ textAlign: 'right' }}>₹{row.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', borderTop: '1px solid #333' }}>
                <td colSpan={2}>Total Expenses</td>
                <td style={{ textAlign: 'right' }}>₹{pnl.totalExpense.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <h2 style={{ color: pnl.netProfit >= 0 ? 'green' : 'crimson' }}>
            {pnl.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}: ₹{Math.abs(pnl.netProfit).toFixed(2)}
          </h2>
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
