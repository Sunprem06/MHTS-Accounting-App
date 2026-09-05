import { useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>MSME ageing (Section 43B(h))</h1>
      <p>Udyam-registered MSME suppliers whose invoices are past their due date — these payments risk being tax-disallowed if still unpaid.</p>
      <label>
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
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {rows === null ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p>No overdue MSME payables as of this date.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Supplier</th>
              <th style={{ textAlign: 'left' }}>Invoice No.</th>
              <th style={{ textAlign: 'left' }}>Invoice date</th>
              <th style={{ textAlign: 'left' }}>Due date</th>
              <th style={{ textAlign: 'right' }}>Days overdue</th>
              <th style={{ textAlign: 'right' }}>Est. outstanding (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.invoiceId}>
                <td>{row.partyName}</td>
                <td>{row.voucherNumber}</td>
                <td>{row.invoiceDate}</td>
                <td>{row.dueDate}</td>
                <td style={{ textAlign: 'right', color: 'crimson' }}>{row.daysOverdue}</td>
                <td style={{ textAlign: 'right' }}>{row.estimatedOutstanding.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
