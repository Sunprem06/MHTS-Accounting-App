import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import type { MsmeAgeingRow } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

/** Section 43B(h): Udyam-registered MSME suppliers unpaid past their due date are tax-disallowed. Estimated via a FIFO settlement assumption — see core-sales-purchase's receivablesPayables.ts. */
export function MsmeAgeingScreen({ onBack }: Props) {
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<MsmeAgeingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(date: string) {
    const result = await window.mhts.listMsmeAgeing(date);
    if (result.ok && result.data) {
      setRows(result.data);
    } else {
      setError(result.error ?? 'Failed to load MSME ageing');
    }
  }

  useEffect(() => {
    refresh(asOfDate);
    // Deliberately runs once on mount only — the date input's own onChange handles refetching after that, so asOfDate isn't a dependency here.
  }, []);

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <AlertTriangle size={18} style={{ color: 'var(--warning)' }} /> MSME ageing (Section 43B(h))
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        Udyam-registered MSME suppliers whose invoices are past their due date — these payments risk being tax-disallowed if still unpaid.
      </p>

      <div className="card">
        <label className="field" style={{ maxWidth: 220 }}>
          As of
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => {
              setAsOfDate(e.target.value);
              refresh(e.target.value);
            }}
          />
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {rows === null ? (
          <p className="empty-state">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">No overdue MSME payables as of this date.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Invoice No.</th>
                <th>Invoice date</th>
                <th>Due date</th>
                <th className="num">Days overdue</th>
                <th className="num">Est. outstanding (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.invoiceId}>
                  <td>{row.partyName}</td>
                  <td>{row.voucherNumber}</td>
                  <td>{row.invoiceDate}</td>
                  <td>{row.dueDate}</td>
                  <td className="num" style={{ color: 'var(--danger)' }}>
                    {row.daysOverdue}
                  </td>
                  <td className="num">{row.estimatedOutstanding.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
