import { useEffect, useState } from 'react';
import type { BankAccountSummary, BankReconciliationStatement, ReconcilableLineRow, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function startOfYearIso(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BankReconciliationScreen({ session, onBack }: Props) {
  const [accounts, setAccounts] = useState<BankAccountSummary[]>([]);
  const [bankLedgerId, setBankLedgerId] = useState('');
  const [fromDate, setFromDate] = useState(startOfYearIso());
  const [toDate, setToDate] = useState(todayIso());
  const [lines, setLines] = useState<ReconcilableLineRow[] | null>(null);
  const [statement, setStatement] = useState<BankReconciliationStatement | null>(null);
  const [statementBalanceInput, setStatementBalanceInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);

  const canReconcile = session.permissions.includes('BANKING.RECONCILE');

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listBankAccounts();
      if (result.ok && result.data) {
        setAccounts(result.data);
        setBankLedgerId(result.data[0]?.ledgerAccountId ?? '');
      }
    })();
  }, []);

  async function refresh() {
    if (!bankLedgerId) {
      return;
    }
    setLoading(true);
    setError(null);
    const [linesResult, statementResult] = await Promise.all([
      window.mhts.listReconcilableLines({ bankLedgerId, fromDate, toDate }),
      window.mhts.getReconciliationStatement({ bankLedgerId, asOfDate: toDate }),
    ]);
    setLoading(false);
    if (linesResult.ok && linesResult.data) {
      setLines(linesResult.data);
    } else {
      setError(linesResult.error ?? 'Failed to load reconcilable lines');
    }
    if (statementResult.ok && statementResult.data) {
      setStatement(statementResult.data);
    } else {
      setError(statementResult.error ?? 'Failed to compute reconciliation statement');
    }
  }

  async function handleToggle(line: ReconcilableLineRow) {
    setBusyLineId(line.voucherLineId);
    setError(null);
    const result = line.isReconciled
      ? await window.mhts.markLineUnreconciled(line.voucherLineId)
      : await window.mhts.markLineReconciled({ voucherLineId: line.voucherLineId, bankStatementDate: line.voucherDate });
    setBusyLineId(null);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to update reconciliation status');
    }
  }

  async function handleStatementDateChange(line: ReconcilableLineRow, bankStatementDate: string) {
    setBusyLineId(line.voucherLineId);
    setError(null);
    const result = await window.mhts.markLineReconciled({ voucherLineId: line.voucherLineId, bankStatementDate });
    setBusyLineId(null);
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to update reconciliation date');
    }
  }

  const tieOutDiff = statement && statementBalanceInput ? Number(statementBalanceInput) - statement.calculatedBankBalance : null;

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 960 }}>
      <h1>Bank reconciliation</h1>
      <p>
        <label>
          Bank account{' '}
          <select value={bankLedgerId} onChange={(e) => setBankLedgerId(e.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.ledgerAccountId}>
                {account.ledgerName} ({account.bankName})
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          From <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>{' '}
        <label>
          To <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>{' '}
        <button type="button" onClick={refresh} disabled={loading || !bankLedgerId}>
          {loading ? 'Loading…' : 'Run'}
        </button>
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {lines && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th>Reconciled</th>
              <th style={{ textAlign: 'left' }}>Voucher</th>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>Narration</th>
              <th style={{ textAlign: 'right' }}>Debit (₹)</th>
              <th style={{ textAlign: 'right' }}>Credit (₹)</th>
              <th style={{ textAlign: 'left' }}>Bank statement date</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.voucherLineId} style={{ opacity: busyLineId === line.voucherLineId ? 0.5 : 1 }}>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={line.isReconciled} disabled={!canReconcile || busyLineId === line.voucherLineId} onChange={() => handleToggle(line)} />
                </td>
                <td>
                  {line.voucherType} #{line.voucherNumber}
                </td>
                <td>{line.voucherDate}</td>
                <td>{line.narration ?? ''}</td>
                <td style={{ textAlign: 'right' }}>{line.debitAmount > 0 ? line.debitAmount.toFixed(2) : ''}</td>
                <td style={{ textAlign: 'right' }}>{line.creditAmount > 0 ? line.creditAmount.toFixed(2) : ''}</td>
                <td>
                  {line.isReconciled ? (
                    <input
                      type="date"
                      value={line.bankStatementDate ?? ''}
                      disabled={!canReconcile || busyLineId === line.voucherLineId}
                      onChange={(e) => handleStatementDateChange(line, e.target.value)}
                    />
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {statement && (
        <div style={{ border: '1px solid #ccc', padding: 16, maxWidth: 420 }}>
          <h2>Reconciliation statement (as of {statement.asOfDate})</h2>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td>Book balance</td>
                <td style={{ textAlign: 'right' }}>₹{statement.bookBalance.toFixed(2)}</td>
              </tr>
              <tr>
                <td>+ Uncleared payments</td>
                <td style={{ textAlign: 'right' }}>₹{statement.unclearedPayments.toFixed(2)}</td>
              </tr>
              <tr>
                <td>− Uncleared receipts</td>
                <td style={{ textAlign: 'right' }}>₹{statement.unclearedReceipts.toFixed(2)}</td>
              </tr>
              <tr style={{ fontWeight: 'bold', borderTop: '1px solid #333' }}>
                <td>= Calculated bank balance</td>
                <td style={{ textAlign: 'right' }}>₹{statement.calculatedBankBalance.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ marginTop: 12 }}>
            <label>
              Actual bank statement balance (₹){' '}
              <input type="number" step="0.01" value={statementBalanceInput} onChange={(e) => setStatementBalanceInput(e.target.value)} style={{ width: 120 }} />
            </label>
          </p>
          {tieOutDiff !== null && (
            <p style={{ color: Math.abs(tieOutDiff) < 0.005 ? 'green' : 'crimson' }}>
              {Math.abs(tieOutDiff) < 0.005 ? 'Ties out to the paisa.' : `Differs by ₹${tieOutDiff.toFixed(2)} — check for unreconciled items or a bank error.`}
            </p>
          )}
          <p>{statement.unclearedLineCount} unreconciled line(s) up to this date.</p>
        </div>
      )}

      <p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
