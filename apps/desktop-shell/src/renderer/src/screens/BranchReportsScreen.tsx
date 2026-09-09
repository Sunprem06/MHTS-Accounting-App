import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import type { BranchBalanceSheetResult, BranchProfitAndLossRow, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

/**
 * Branch-wise P&L and Balance Sheet. The BS's "Head Office / Unassigned" row
 * carries every ledger's opening balance plus any untagged voucher line —
 * opening balances predate branch tagging entirely, so they can't be
 * attributed to any one branch (see core-accounting's
 * computeBranchBalanceSheet doc comment). Consolidated totals below tie out
 * exactly to the whole-company Balance Sheet — the literal Blueprint exit
 * criterion for Phase 8 ("consolidated multi-branch reports tie out").
 */
export function BranchReportsScreen({ session, onBack }: Props) {
  void session;
  const [pnl, setPnl] = useState<BranchProfitAndLossRow[] | null>(null);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [balanceSheet, setBalanceSheet] = useState<BranchBalanceSheetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshPnl() {
    const result = await window.mhts.getBranchProfitAndLoss({});
    if (result.ok && result.data) {
      setPnl(result.data);
    } else {
      setError(result.error ?? 'Failed to load branch P&L');
    }
  }

  async function refreshBalanceSheet(date: string) {
    const result = await window.mhts.getBranchBalanceSheet(date);
    if (result.ok && result.data) {
      setBalanceSheet(result.data);
    } else {
      setError(result.error ?? 'Failed to load branch balance sheet');
    }
  }

  useEffect(() => {
    refreshPnl();
    refreshBalanceSheet(asOfDate);
    // Deliberately runs once on mount only — the date input's own onChange handles subsequent refreshes.
    // (asOfDate is intentionally not a dependency here.)
  }, []);

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <BarChart3 size={18} style={{ color: 'var(--accent)' }} /> Branch-wise reports
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Branch-wise P&amp;L (since inception)</h2>
        {pnl === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Branch</th>
                <th className="num">Income (₹)</th>
                <th className="num">Expense (₹)</th>
                <th className="num">Net (₹)</th>
              </tr>
            </thead>
            <tbody>
              {pnl.map((row) => (
                <tr key={row.branchId ?? '__unassigned__'}>
                  <td>{row.branchName}</td>
                  <td className="num">{row.totalIncome.toFixed(2)}</td>
                  <td className="num">{row.totalExpense.toFixed(2)}</td>
                  <td className="num">{row.net.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Branch-wise Balance Sheet</h2>
        <label className="field" style={{ maxWidth: 200 }}>
          As of date
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => {
              setAsOfDate(e.target.value);
              refreshBalanceSheet(e.target.value);
            }}
          />
        </label>

        {balanceSheet === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th className="num">Total assets (₹)</th>
                  <th className="num">Total liabilities + equity (₹)</th>
                  <th className="num">Current earnings (₹)</th>
                </tr>
              </thead>
              <tbody>
                {balanceSheet.branchSummaries.map((row) => (
                  <tr key={row.branchId ?? '__unassigned__'}>
                    <td>{row.branchName}</td>
                    <td className="num">{row.totalAssets.toFixed(2)}</td>
                    <td className="num">{row.totalLiabilitiesAndEquity.toFixed(2)}</td>
                    <td className="num">{row.currentEarnings.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Consolidated (all branches + Head Office / Unassigned)</td>
                  <td className="num">{balanceSheet.consolidatedTotalAssets.toFixed(2)}</td>
                  <td className="num">{balanceSheet.consolidatedTotalLiabilitiesAndEquity.toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>

            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Ledger-level detail per branch</summary>
              <table className="data-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Ledger</th>
                    <th>Nature</th>
                    <th className="num">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceSheet.rows.map((row, i) => (
                    <tr key={i}>
                      <td>{row.branchName}</td>
                      <td>{row.ledgerName}</td>
                      <td>{row.nature}</td>
                      <td className="num">{row.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
