import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCheck } from 'lucide-react';
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
  const tiesOut = tieOutDiff !== null && Math.abs(tieOutDiff) < 0.005;

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <CheckCheck size={18} style={{ color: 'var(--accent)' }} /> Bank reconciliation
        </h1>
      </div>

      <div className="card">
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            Bank account
            <select value={bankLedgerId} onChange={(e) => setBankLedgerId(e.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.ledgerAccountId}>
                  {account.ledgerName} ({account.bankName})
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ maxWidth: 180 }}>
            From
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="field" style={{ maxWidth: 180 }}>
            To
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <button type="button" className="btn-primary" onClick={refresh} disabled={loading || !bankLedgerId} style={{ marginBottom: 12 }}>
            {loading ? 'Loading…' : 'Run'}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {lines && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Reconciled</th>
                <th>Voucher</th>
                <th>Date</th>
                <th>Narration</th>
                <th className="num">Debit (₹)</th>
                <th className="num">Credit (₹)</th>
                <th>Bank statement date</th>
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
                  <td className="num">{line.debitAmount > 0 ? line.debitAmount.toFixed(2) : ''}</td>
                  <td className="num">{line.creditAmount > 0 ? line.creditAmount.toFixed(2) : ''}</td>
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
        </div>
      )}

      {statement && (
        <div className="card" style={{ maxWidth: 460 }}>
          <h2>Reconciliation statement (as of {statement.asOfDate})</h2>
          <table className="data-table">
            <tbody>
              <tr>
                <td>Book balance</td>
                <td className="num">₹{statement.bookBalance.toFixed(2)}</td>
              </tr>
              <tr>
                <td>+ Uncleared payments</td>
                <td className="num">₹{statement.unclearedPayments.toFixed(2)}</td>
              </tr>
              <tr>
                <td>− Uncleared receipts</td>
                <td className="num">₹{statement.unclearedReceipts.toFixed(2)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>= Calculated bank balance</td>
                <td className="num">₹{statement.calculatedBankBalance.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          <label className="field" style={{ marginTop: 16, maxWidth: 220 }}>
            Actual bank statement balance (₹)
            <input type="number" step="0.01" value={statementBalanceInput} onChange={(e) => setStatementBalanceInput(e.target.value)} />
          </label>
          {tieOutDiff !== null && (
            <p style={{ marginTop: 4 }}>
              <span className={`badge ${tiesOut ? 'badge-success' : 'badge-warning'}`}>
                {tiesOut ? 'Ties out to the paisa.' : `Differs by ₹${tieOutDiff.toFixed(2)} — check for unreconciled items or a bank error.`}
              </span>
            </p>
          )}
          <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: 12, marginBottom: 0 }}>{statement.unclearedLineCount} unreconciled line(s) up to this date.</p>
        </div>
      )}
    </div>
  );
}
