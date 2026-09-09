import { useEffect, useState } from 'react';
import { ArrowLeft, Wallet } from 'lucide-react';
import type { OutstandingReimbursementRow } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

export function OutstandingReimbursementsScreen({ onBack }: Props) {
  const [rows, setRows] = useState<OutstandingReimbursementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listOutstandingReimbursements();
      if (result.ok && result.data) {
        setRows(result.data);
      } else {
        setError(result.error ?? 'Failed to load outstanding reimbursements');
      }
    })();
  }, []);

  const total = rows?.reduce((sum, row) => sum + row.outstandingAmount, 0) ?? 0;

  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Wallet size={18} style={{ color: 'var(--accent)' }} /> Outstanding reimbursements
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {rows === null ? (
          <p className="empty-state">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">No outstanding reimbursements.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Claim date</th>
                <th className="num">Claim total (₹)</th>
                <th className="num">Settled (₹)</th>
                <th className="num">Outstanding (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.expenseClaimId}>
                  <td>{row.employeeName}</td>
                  <td>{row.claimDate}</td>
                  <td className="num">{row.netAmount.toFixed(2)}</td>
                  <td className="num">{row.settledAmount.toFixed(2)}</td>
                  <td className="num">{row.outstandingAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ fontWeight: 600 }}>
                  Total
                </td>
                <td className="num" style={{ fontWeight: 600 }}>
                  {total.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
