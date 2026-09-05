import { useEffect, useState } from 'react';
import type { TrialBalanceResult } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

export function TrialBalanceScreen({ onBack }: Props) {
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.getTrialBalance();
      if (result.ok && result.data) {
        setTrialBalance(result.data);
      } else {
        setError(result.error ?? 'Failed to load Trial Balance');
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Trial Balance</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {trialBalance === null ? (
        <p>Loading…</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Ledger</th>
                <th style={{ textAlign: 'left' }}>Group</th>
                <th style={{ textAlign: 'right' }}>Debit (₹)</th>
                <th style={{ textAlign: 'right' }}>Credit (₹)</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.rows.map((row) => (
                <tr key={row.ledgerId}>
                  <td>{row.ledgerName}</td>
                  <td>{row.groupName}</td>
                  <td style={{ textAlign: 'right' }}>{row.debitBalance > 0 ? row.debitBalance.toFixed(2) : ''}</td>
                  <td style={{ textAlign: 'right' }}>{row.creditBalance > 0 ? row.creditBalance.toFixed(2) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                <td colSpan={2}>Total</td>
                <td style={{ textAlign: 'right' }}>{trialBalance.totalDebit.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{trialBalance.totalCredit.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          {trialBalance.totalDebit !== trialBalance.totalCredit && (
            <p style={{ color: 'crimson' }}>
              Totals do not match — this can happen if opening balances entered for different ledgers don't net to zero.
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
