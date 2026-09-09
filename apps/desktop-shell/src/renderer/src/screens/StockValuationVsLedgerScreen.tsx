import { useEffect, useState } from 'react';
import { ArrowLeft, Scale } from 'lucide-react';

interface Props {
  onBack: () => void;
}

/**
 * Directly demonstrates the Blueprint's Phase 3 exit criterion ("stock
 * reports reconcile to accounting COGS") by comparing the sum of every
 * item's on-hand value (computeStockPosition) against the Stock-in-Hand
 * ledger's own balance (computeLedgerBalances, via Trial Balance) — rather
 * than just asserting the two agree.
 */
export function StockValuationVsLedgerScreen({ onBack }: Props) {
  const [stockValue, setStockValue] = useState<number | null>(null);
  const [ledgerValue, setLedgerValue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [positionResult, trialBalanceResult] = await Promise.all([window.mhts.getStockPosition({}), window.mhts.getTrialBalance()]);
      if (positionResult.ok && positionResult.data) {
        setStockValue(positionResult.data.reduce((sum, row) => sum + row.valueRupees, 0));
      } else {
        setError(positionResult.error ?? 'Failed to load stock position');
      }
      if (trialBalanceResult.ok && trialBalanceResult.data) {
        const stockLedgerRow = trialBalanceResult.data.rows.find((row) => row.ledgerName === 'Stock-in-Hand');
        setLedgerValue(stockLedgerRow ? stockLedgerRow.debitBalance - stockLedgerRow.creditBalance : 0);
      } else {
        setError(trialBalanceResult.error ?? 'Failed to load Trial Balance');
      }
    })();
  }, []);

  const loaded = stockValue !== null && ledgerValue !== null;
  const matches = loaded && Math.abs(stockValue - ledgerValue) < 0.01;

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Scale size={18} style={{ color: 'var(--accent)' }} /> Stock valuation vs. ledger
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        Compares the sum of every item&apos;s on-hand value against the Stock-in-Hand ledger&apos;s own balance — these two numbers should always agree.
      </p>

      {error && <p className="error-text">{error}</p>}

      {!loaded ? (
        <div className="card">
          <p className="empty-state">Loading…</p>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <tbody>
              <tr>
                <td>Sum of item-level stock value</td>
                <td className="num" style={{ fontWeight: 600 }}>
                  ₹{stockValue.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td>Stock-in-Hand ledger balance</td>
                <td className="num" style={{ fontWeight: 600 }}>
                  ₹{ledgerValue.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <span className={`badge ${matches ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 14, padding: '6px 14px' }}>
              {matches ? '✓ Reconciled — stock and ledger agree.' : '✗ Mismatch — stock and ledger disagree.'}
            </span>
          </div>

          {!matches && (
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 12, marginBottom: 0 }}>
              A mismatch is expected if opening stock was recorded without a matching manual entry to the Stock-in-Hand ledger&apos;s own opening balance (this pass does not auto-reconcile those
              two — see Phase Tracker Open Questions), or if a stock-linked invoice was cancelled (blocked in this pass, but a manual GL correction elsewhere could still cause drift).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
