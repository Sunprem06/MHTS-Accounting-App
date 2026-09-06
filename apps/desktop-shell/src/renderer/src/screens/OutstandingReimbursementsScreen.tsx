import { useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720 }}>
      <h1>Outstanding reimbursements</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {rows === null ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p>No outstanding reimbursements.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Employee</th>
              <th style={{ textAlign: 'left' }}>Claim date</th>
              <th style={{ textAlign: 'right' }}>Claim total (₹)</th>
              <th style={{ textAlign: 'right' }}>Settled (₹)</th>
              <th style={{ textAlign: 'right' }}>Outstanding (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.expenseClaimId}>
                <td>{row.employeeName}</td>
                <td>{row.claimDate}</td>
                <td style={{ textAlign: 'right' }}>{row.netAmount.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{row.settledAmount.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{row.outstandingAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 'bold' }} colSpan={4}>
                Total
              </td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{total.toFixed(2)}</td>
            </tr>
          </tfoot>
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
