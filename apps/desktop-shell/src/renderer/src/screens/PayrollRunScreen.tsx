import { useEffect, useState } from 'react';
import type { LedgerAccountSummary, PayrollRunSummary, PayslipSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Create -> Process -> review payslips (with a TDS override where needed) -> Post -> disburse — one screen for the whole payroll-run lifecycle, mirroring how ExpenseClaimRegisterScreen combines a register with its own lifecycle actions rather than splitting each transition into its own screen. */
export function PayrollRunScreen({ session, onBack }: Props) {
  const [runs, setRuns] = useState<PayrollRunSummary[] | null>(null);
  const [selectedRun, setSelectedRun] = useState<PayrollRunSummary | null>(null);
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [periodMonth, setPeriodMonth] = useState(new Date().getUTCMonth() + 1);
  const [periodYear, setPeriodYear] = useState(new Date().getUTCFullYear());

  const [paymentLedgerId, setPaymentLedgerId] = useState('');
  const [disbursing, setDisbursing] = useState<string | null>(null);

  const canRun = session.permissions.includes('PAYROLL.RUN_PAYROLL');
  const canDisburse = session.permissions.includes('PAYROLL.DISBURSE_SALARY');

  async function refreshRuns() {
    const result = await window.mhts.listPayrollRuns();
    if (result.ok && result.data) setRuns(result.data);
    else setError(result.error ?? 'Failed to load payroll runs');
  }

  async function refreshSelected(id: string) {
    const result = await window.mhts.getPayrollRun(id);
    if (result.ok && result.data) setSelectedRun(result.data);
  }

  useEffect(() => {
    refreshRuns();
    (async () => {
      const result = await window.mhts.listLedgers();
      if (result.ok && result.data) setLedgers(result.data);
    })();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await window.mhts.createPayrollRun({ periodMonth, periodYear });
    setBusy(false);
    if (result.ok && result.data) {
      await refreshRuns();
      await refreshSelected(result.data);
    } else {
      setError(result.error ?? 'Failed to create payroll run');
    }
  }

  async function handleProcess() {
    if (!selectedRun) return;
    setError(null);
    setBusy(true);
    const result = await window.mhts.processPayrollRun(selectedRun.id);
    setBusy(false);
    if (result.ok) {
      await refreshSelected(selectedRun.id);
      await refreshRuns();
    } else {
      setError(result.error ?? 'Failed to process payroll run');
    }
  }

  async function handlePost() {
    if (!selectedRun) return;
    setError(null);
    setBusy(true);
    const result = await window.mhts.postPayrollRun(selectedRun.id);
    setBusy(false);
    if (result.ok) {
      await refreshSelected(selectedRun.id);
      await refreshRuns();
    } else {
      setError(result.error ?? 'Failed to post payroll run');
    }
  }

  async function handleOverrideTds(payslip: PayslipSummary) {
    const current = payslip.lines.find((l) => l.label.startsWith('Salary TDS'))?.amount ?? 0;
    const input = window.prompt(`New TDS amount for ${payslip.employeeName} (₹)`, current.toFixed(2));
    if (input === null) return;
    const amountRupees = Number(input);
    if (!Number.isFinite(amountRupees) || amountRupees < 0) return;
    setError(null);
    const result = await window.mhts.overridePayslipTds({ payslipId: payslip.id, amountRupees });
    if (result.ok && selectedRun) {
      await refreshSelected(selectedRun.id);
    } else {
      setError(result.error ?? 'Failed to override TDS');
    }
  }

  async function handleDisburse(payslip: PayslipSummary) {
    if (!paymentLedgerId) {
      setError('Select a payment ledger first');
      return;
    }
    setError(null);
    setDisbursing(payslip.id);
    const result = await window.mhts.disbursePayslip({ payslipId: payslip.id, paymentLedgerId, paymentDate: todayIso(), amountRupees: payslip.outstandingAmount });
    setDisbursing(null);
    if (result.ok && selectedRun) {
      await refreshSelected(selectedRun.id);
    } else {
      setError(result.error ?? 'Failed to disburse');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000 }}>
      <h1>Payroll runs</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {canRun && (
        <form onSubmit={handleCreate} style={{ marginBottom: 16 }}>
          <label>
            Month
            <input type="number" min={1} max={12} value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))} style={{ width: 50 }} />
          </label>{' '}
          <label>
            Year
            <input type="number" value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))} style={{ width: 70 }} />
          </label>{' '}
          <button type="submit" disabled={busy}>
            New run
          </button>
        </form>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Period</th>
            <th style={{ textAlign: 'left' }}>Status</th>
            <th style={{ textAlign: 'right' }}>Payslips</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(runs ?? []).map((run) => (
            <tr key={run.id}>
              <td>
                {run.periodMonth}/{run.periodYear}
              </td>
              <td>{run.status}</td>
              <td style={{ textAlign: 'right' }}>{run.payslips.length}</td>
              <td>
                <button type="button" onClick={() => refreshSelected(run.id)}>
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedRun && (
        <div style={{ border: '1px solid #ccc', padding: 12 }}>
          <h2>
            Run {selectedRun.periodMonth}/{selectedRun.periodYear} — {selectedRun.status}
          </h2>

          {canRun && selectedRun.status === 'DRAFT' && (
            <button type="button" onClick={handleProcess} disabled={busy}>
              {busy ? 'Processing…' : 'Process (compute payslips)'}
            </button>
          )}
          {canRun && selectedRun.status === 'PROCESSED' && (
            <button type="button" onClick={handlePost} disabled={busy}>
              {busy ? 'Posting…' : 'Post to ledger'}
            </button>
          )}

          {selectedRun.payslips.length > 0 && (
            <>
              {canDisburse && (
                <p>
                  Payment ledger for disbursement:{' '}
                  <select value={paymentLedgerId} onChange={(e) => setPaymentLedgerId(e.target.value)}>
                    <option value="">— select —</option>
                    {ledgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </p>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Employee</th>
                    <th style={{ textAlign: 'right' }}>Gross (₹)</th>
                    <th style={{ textAlign: 'right' }}>Deductions (₹)</th>
                    <th style={{ textAlign: 'right' }}>Net pay (₹)</th>
                    <th style={{ textAlign: 'right' }}>Outstanding (₹)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selectedRun.payslips.map((payslip) => (
                    <tr key={payslip.id}>
                      <td>{payslip.employeeName}</td>
                      <td style={{ textAlign: 'right' }}>{payslip.grossEarnings.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{payslip.totalDeductions.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{payslip.netPay.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{payslip.outstandingAmount.toFixed(2)}</td>
                      <td>
                        {canRun && selectedRun.status === 'PROCESSED' && (
                          <button type="button" onClick={() => handleOverrideTds(payslip)} style={{ fontSize: 11 }}>
                            Edit TDS
                          </button>
                        )}
                        {canDisburse && selectedRun.status === 'POSTED' && payslip.outstandingAmount > 0 && (
                          <button type="button" onClick={() => handleDisburse(payslip)} disabled={disbursing === payslip.id} style={{ fontSize: 11 }}>
                            {disbursing === payslip.id ? 'Paying…' : 'Disburse'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedRun.payslips.map(
                (payslip) =>
                  selectedRun.status !== 'DRAFT' && (
                    <details key={`${payslip.id}-lines`} style={{ fontSize: 12, marginTop: 4 }}>
                      <summary>{payslip.employeeName}'s payslip lines</summary>
                      <ul>
                        {payslip.lines.map((line, i) => (
                          <li key={i}>
                            [{line.lineType}] {line.label}: ₹{line.amount.toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ),
              )}
            </>
          )}
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
