import { useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Branch-wise reports</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <h2>Branch-wise P&amp;L (since inception)</h2>
      {pnl === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Branch</th>
              <th style={{ textAlign: 'right' }}>Income (₹)</th>
              <th style={{ textAlign: 'right' }}>Expense (₹)</th>
              <th style={{ textAlign: 'right' }}>Net (₹)</th>
            </tr>
          </thead>
          <tbody>
            {pnl.map((row) => (
              <tr key={row.branchId ?? '__unassigned__'}>
                <td>{row.branchName}</td>
                <td style={{ textAlign: 'right' }}>{row.totalIncome.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{row.totalExpense.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{row.net.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Branch-wise Balance Sheet</h2>
      <label>
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
        <p>Loading…</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Branch</th>
                <th style={{ textAlign: 'right' }}>Total assets (₹)</th>
                <th style={{ textAlign: 'right' }}>Total liabilities + equity (₹)</th>
                <th style={{ textAlign: 'right' }}>Current earnings (₹)</th>
              </tr>
            </thead>
            <tbody>
              {balanceSheet.branchSummaries.map((row) => (
                <tr key={row.branchId ?? '__unassigned__'}>
                  <td>{row.branchName}</td>
                  <td style={{ textAlign: 'right' }}>{row.totalAssets.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{row.totalLiabilitiesAndEquity.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{row.currentEarnings.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold' }}>
                <td>Consolidated (all branches + Head Office / Unassigned)</td>
                <td style={{ textAlign: 'right' }}>{balanceSheet.consolidatedTotalAssets.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{balanceSheet.consolidatedTotalLiabilitiesAndEquity.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>

          <details>
            <summary>Ledger-level detail per branch</summary>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Branch</th>
                  <th style={{ textAlign: 'left' }}>Ledger</th>
                  <th style={{ textAlign: 'left' }}>Nature</th>
                  <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {balanceSheet.rows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.branchName}</td>
                    <td>{row.ledgerName}</td>
                    <td>{row.nature}</td>
                    <td style={{ textAlign: 'right' }}>{row.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}

      <p />
      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
