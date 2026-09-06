import { useEffect, useState } from 'react';
import type { EmployeePayrollProfileSummary, GratuityRecordSummary, LedgerAccountSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Monthly provisioning (a formula-based accrual estimate, NOT an actuarial
 * AS-15/Ind AS-19 valuation) plus a per-employee separation calculator and
 * settlement — see @mhts/core-payroll-engine's gratuityRecords.ts for the
 * full design (eligibility, the true-up adjustment booked at separation, and
 * why settlement pays directly out of the Gratuity Provision ledger rather
 * than through the employee's salary-payable ledger).
 */
export function GratuityScreen({ session, onBack }: Props) {
  const [employees, setEmployees] = useState<EmployeePayrollProfileSummary[]>([]);
  const [records, setRecords] = useState<GratuityRecordSummary[] | null>(null);
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [provisionYear, setProvisionYear] = useState(new Date().getUTCFullYear());
  const [provisionMonth, setProvisionMonth] = useState(new Date().getUTCMonth() + 1);

  const [separationEmployeeId, setSeparationEmployeeId] = useState('');
  const [separationDate, setSeparationDate] = useState(todayIso());

  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [paymentLedgerId, setPaymentLedgerId] = useState('');

  const canManage = session.permissions.includes('PAYROLL.MANAGE_GRATUITY');

  async function refreshRecords() {
    const result = await window.mhts.listGratuityRecords();
    if (result.ok && result.data) setRecords(result.data);
    else setError(result.error ?? 'Failed to load gratuity records');
  }

  useEffect(() => {
    (async () => {
      const [empResult, ledgerResult] = await Promise.all([window.mhts.listEmployeePayrollProfiles(), window.mhts.listLedgers()]);
      if (empResult.ok && empResult.data) setEmployees(empResult.data.filter((e) => e.isActive));
      if (ledgerResult.ok && ledgerResult.data) setLedgers(ledgerResult.data);
    })();
    refreshRecords();
  }, []);

  async function handleRunProvisioning(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await window.mhts.runGratuityProvisioning({ periodMonth: provisionMonth, periodYear: provisionYear });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Failed to run gratuity provisioning');
    }
  }

  async function handleRecordSeparation(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await window.mhts.recordSeparation({ employeeId: separationEmployeeId, separationDate });
    setBusy(false);
    if (result.ok) {
      setSeparationEmployeeId('');
      await refreshRecords();
    } else {
      setError(result.error ?? 'Failed to record separation');
    }
  }

  async function handleSettle(recordId: string) {
    if (!paymentLedgerId) {
      setError('Select a payment ledger first');
      return;
    }
    setError(null);
    const result = await window.mhts.settleGratuity({ gratuityRecordId: recordId, paymentLedgerId, paymentDate: todayIso() });
    setSettlingId(null);
    if (result.ok) {
      await refreshRecords();
    } else {
      setError(result.error ?? 'Failed to settle gratuity');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Gratuity</h1>
      <p style={{ fontSize: 12, color: '#666' }}>
        Monthly provisioning is a formula-based estimate (15/26 × last-drawn wage base × years of service), not an actuarial AS-15/Ind AS-19 valuation —
        get a CA/actuary sign-off before relying on this for statutory books.
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {canManage && (
        <form onSubmit={handleRunProvisioning} style={{ marginBottom: 16 }}>
          <h2>Run monthly provisioning</h2>
          <label>
            Month
            <input type="number" min={1} max={12} value={provisionMonth} onChange={(e) => setProvisionMonth(Number(e.target.value))} style={{ width: 50 }} />
          </label>{' '}
          <label>
            Year
            <input type="number" value={provisionYear} onChange={(e) => setProvisionYear(Number(e.target.value))} style={{ width: 70 }} />
          </label>{' '}
          <button type="submit" disabled={busy}>
            {busy ? 'Running…' : 'Run'}
          </button>
        </form>
      )}

      {canManage && (
        <form onSubmit={handleRecordSeparation} style={{ marginBottom: 24, border: '1px solid #ccc', padding: 12 }}>
          <h2>Record a separation</h2>
          <label>
            Employee
            <select value={separationEmployeeId} onChange={(e) => setSeparationEmployeeId(e.target.value)} required>
              <option value="">— select —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeCode} — {emp.name}
                </option>
              ))}
            </select>
          </label>{' '}
          <label>
            Separation date
            <input type="date" value={separationDate} onChange={(e) => setSeparationDate(e.target.value)} required />
          </label>{' '}
          <button type="submit" disabled={busy}>
            {busy ? 'Recording…' : 'Record separation'}
          </button>
        </form>
      )}

      <h2>Gratuity records</h2>
      {records === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Employee</th>
              <th style={{ textAlign: 'left' }}>Separation date</th>
              <th style={{ textAlign: 'center' }}>Eligible</th>
              <th style={{ textAlign: 'left' }}>Reason</th>
              <th style={{ textAlign: 'right' }}>Amount (₹)</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.employeeName}</td>
                <td>{r.separationDate}</td>
                <td style={{ textAlign: 'center' }}>{r.isEligible ? 'Yes' : 'No'}</td>
                <td style={{ fontSize: 11 }}>{r.eligibilityReason}</td>
                <td style={{ textAlign: 'right' }}>{r.formulaAmount.toFixed(2)}</td>
                <td>{r.status}</td>
                <td>
                  {canManage && r.status === 'DRAFT' && r.isEligible && r.formulaAmount > 0 && (
                    <>
                      {settlingId === r.id ? (
                        <>
                          <select value={paymentLedgerId} onChange={(e) => setPaymentLedgerId(e.target.value)}>
                            <option value="">— ledger —</option>
                            {ledgers.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>{' '}
                          <button type="button" onClick={() => handleSettle(r.id)}>
                            Confirm pay
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setSettlingId(r.id)}>
                          Settle
                        </button>
                      )}
                    </>
                  )}
                </td>
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
