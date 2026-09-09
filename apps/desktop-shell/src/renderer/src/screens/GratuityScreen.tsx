import { useEffect, useState } from 'react';
import { ArrowLeft, Award } from 'lucide-react';
import type { EmployeePayrollProfileSummary, GratuityRecordStatus, GratuityRecordSummary, LedgerAccountSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusBadgeClass(status: GratuityRecordStatus): string {
  return status === 'SETTLED' ? 'badge-success' : 'badge-warning';
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
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Award size={18} style={{ color: 'var(--accent)' }} /> Gratuity
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        Monthly provisioning is a formula-based estimate (15/26 × last-drawn wage base × years of service), not an actuarial AS-15/Ind AS-19 valuation —
        get a CA/actuary sign-off before relying on this for statutory books.
      </p>

      {error && <p className="error-text">{error}</p>}

      {canManage && (
        <form onSubmit={handleRunProvisioning} className="card">
          <h2>Run monthly provisioning</h2>
          <div className="field-row" style={{ alignItems: 'flex-end' }}>
            <label className="field">
              Month
              <input type="number" min={1} max={12} value={provisionMonth} onChange={(e) => setProvisionMonth(Number(e.target.value))} style={{ width: 70 }} />
            </label>
            <label className="field">
              Year
              <input type="number" value={provisionYear} onChange={(e) => setProvisionYear(Number(e.target.value))} style={{ width: 90 }} />
            </label>
            <button type="submit" className="btn-primary" disabled={busy} style={{ marginBottom: 12 }}>
              {busy ? 'Running…' : 'Run'}
            </button>
          </div>
        </form>
      )}

      {canManage && (
        <form onSubmit={handleRecordSeparation} className="card">
          <h2>Record a separation</h2>
          <div className="field-row">
            <label className="field">
              Employee
              <select value={separationEmployeeId} onChange={(e) => setSeparationEmployeeId(e.target.value)} required>
                <option value="">— select —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeCode} — {emp.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Separation date
              <input type="date" value={separationDate} onChange={(e) => setSeparationDate(e.target.value)} required />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Recording…' : 'Record separation'}
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Gratuity records</h2>
        {records === null ? (
          <p className="empty-state">Loading…</p>
        ) : records.length === 0 ? (
          <p className="empty-state">No gratuity records yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Separation date</th>
                <th>Eligible</th>
                <th>Reason</th>
                <th className="num">Amount (₹)</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.employeeName}</td>
                  <td>{r.separationDate}</td>
                  <td>
                    <span className={`badge ${r.isEligible ? 'badge-success' : 'badge-muted'}`}>{r.isEligible ? 'Yes' : 'No'}</span>
                  </td>
                  <td style={{ fontSize: 11 }}>{r.eligibilityReason}</td>
                  <td className="num">{r.formulaAmount.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>
                  </td>
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
      </div>
    </div>
  );
}
