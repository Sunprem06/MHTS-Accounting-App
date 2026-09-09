import { useState } from 'react';
import { ArrowLeft, TrendingUp } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <TrendingUp size={18} style={{ color: 'var(--accent)' }} /> Profit &amp; Loss
        </h1>
      </div>

      <div className="card">
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ maxWidth: 200 }}>
            From
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="field" style={{ maxWidth: 200 }}>
            To
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <button type="button" className="btn-primary" onClick={refresh} disabled={loading} style={{ marginBottom: 12 }}>
            {loading ? 'Loading…' : 'Run'}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {pnl && (
        <>
          <div className="card">
            <h2>Income</h2>
            <table className="data-table">
              <tbody>
                {pnl.incomeRows.map((row) => (
                  <tr key={row.ledgerId}>
                    <td>{row.ledgerName}</td>
                    <td>{row.groupName}</td>
                    <td className="num">₹{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total Income</td>
                  <td className="num">₹{pnl.totalIncome.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card">
            <h2>Expenses</h2>
            <table className="data-table">
              <tbody>
                {pnl.expenseRows.map((row) => (
                  <tr key={row.ledgerId}>
                    <td>{row.ledgerName}</td>
                    <td>{row.groupName}</td>
                    <td className="num">₹{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total Expenses</td>
                  <td className="num">₹{pnl.totalExpense.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card" style={{ textAlign: 'center' }}>
            <span
              className={`badge ${pnl.netProfit >= 0 ? 'badge-success' : 'badge-warning'}`}
              style={{ fontSize: 15, padding: '6px 16px' }}
            >
              {pnl.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}: ₹{Math.abs(pnl.netProfit).toFixed(2)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
