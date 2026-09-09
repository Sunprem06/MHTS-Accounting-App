import { useEffect, useState } from 'react';
import { ArrowLeft, ListChecks } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ListChecks size={18} style={{ color: 'var(--accent)' }} /> Trial balance
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {trialBalance === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ledger</th>
                  <th>Group</th>
                  <th className="num">Debit (₹)</th>
                  <th className="num">Credit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.rows.map((row) => (
                  <tr key={row.ledgerId}>
                    <td>{row.ledgerName}</td>
                    <td>{row.groupName}</td>
                    <td className="num">{row.debitBalance > 0 ? row.debitBalance.toFixed(2) : ''}</td>
                    <td className="num">{row.creditBalance > 0 ? row.creditBalance.toFixed(2) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="num">{trialBalance.totalDebit.toFixed(2)}</td>
                  <td className="num">{trialBalance.totalCredit.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            {trialBalance.totalDebit !== trialBalance.totalCredit && (
              <p className="error-text" style={{ marginTop: 16, marginBottom: 0 }}>
                Totals do not match — this can happen if opening balances entered for different ledgers don't net to zero.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
