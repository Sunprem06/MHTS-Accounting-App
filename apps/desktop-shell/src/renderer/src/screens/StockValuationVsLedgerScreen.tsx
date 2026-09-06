import { useEffect, useState } from 'react';

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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Stock valuation vs. ledger</h1>
      <p>Compares the sum of every item&apos;s on-hand value against the Stock-in-Hand ledger&apos;s own balance — these two numbers should always agree.</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {!loaded ? (
        <p>Loading…</p>
      ) : (
        <>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ paddingRight: 24 }}>Sum of item-level stock value</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{stockValue.toFixed(2)}</td>
              </tr>
              <tr>
                <td style={{ paddingRight: 24 }}>Stock-in-Hand ledger balance</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{ledgerValue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ color: matches ? 'green' : 'crimson', fontWeight: 'bold', marginTop: 16 }}>{matches ? '✓ Reconciled — stock and ledger agree.' : '✗ Mismatch — stock and ledger disagree.'}</p>
          {!matches && (
            <p style={{ fontSize: 13 }}>
              A mismatch is expected if opening stock was recorded without a matching manual entry to the Stock-in-Hand ledger&apos;s own opening balance (this pass does not auto-reconcile those two —
              see Phase Tracker Open Questions), or if a stock-linked invoice was cancelled (blocked in this pass, but a manual GL correction elsewhere could still cause drift).
            </p>
          )}
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
