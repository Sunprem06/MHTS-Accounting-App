import { useEffect, useState } from 'react';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import type { LedgerAccountSummary, PayrollRunStatus, PayrollRunSummary, PayslipSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusBadgeClass(status: PayrollRunStatus): string {
  switch (status) {
    case 'POSTED':
      return 'badge-success';
    case 'PROCESSED':
      return 'badge-warning';
    default:
      return 'badge-muted';
  }
}

// Same CSV-export pattern as GstReturnsScreen's toCsv/toCsvValue — this was
// the one CA-facing gap Phase 11's compliance review found (GST already had
// an exportable artifact; payroll had none).
function toCsvValue(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((row) => row.map(toCsvValue).join(',')).join('\n');
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

  const [printingId, setPrintingId] = useState<string | null>(null);

  const canRun = session.permissions.includes('PAYROLL.RUN_PAYROLL');
  const canDisburse = session.permissions.includes('PAYROLL.DISBURSE_SALARY');
  const canPrint = session.permissions.includes('PRINT.PRINT_DOCUMENTS');

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

  async function exportRunCsv() {
    if (!selectedRun) return;
    setError(null);
    const registerCsv = toCsv(
      ['Employee', 'Gross (₹)', 'Deductions (₹)', 'Net Pay (₹)', 'Outstanding (₹)'],
      selectedRun.payslips.map((p) => [p.employeeName, p.grossEarnings, p.totalDeductions, p.netPay, p.outstandingAmount]),
    );
    const linesCsv = toCsv(
      ['Employee', 'Line Type', 'Label', 'Amount (₹)'],
      selectedRun.payslips.flatMap((p) => p.lines.map((line) => [p.employeeName, line.lineType, line.label, line.amount])),
    );
    const csv = `${registerCsv}\n\n${linesCsv}`;
    const fileName = `Payroll_${selectedRun.periodMonth}_${selectedRun.periodYear}.csv`;
    const result = await window.mhts.exportCsv({ defaultFileName: fileName, csvContent: csv });
    if (!result.ok) setError(result.error ?? 'Failed to export CSV');
  }

  async function handlePrintPayslip(payslip: PayslipSummary) {
    setError(null);
    setPrintingId(payslip.id);
    const result = await window.mhts.printPayslip(payslip.id);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? 'Failed to print payslip');
    }
  }

  async function handleSavePayslipPdf(payslip: PayslipSummary) {
    setError(null);
    setPrintingId(payslip.id);
    const result = await window.mhts.savePayslipPdf(payslip.id);
    setPrintingId(null);
    if (!result.ok) {
      setError(result.error ?? 'Failed to save payslip as PDF');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <PlayCircle size={18} style={{ color: 'var(--accent)' }} /> Payroll runs
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      {canRun && (
        <form onSubmit={handleCreate} className="card">
          <div className="field-row" style={{ alignItems: 'flex-end' }}>
            <label className="field">
              Month
              <input type="number" min={1} max={12} value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))} style={{ width: 70 }} />
            </label>
            <label className="field">
              Year
              <input type="number" value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))} style={{ width: 90 }} />
            </label>
            <button type="submit" className="btn-primary" disabled={busy} style={{ marginBottom: 12 }}>
              New run
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Status</th>
              <th className="num">Payslips</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(runs ?? []).map((run) => (
              <tr key={run.id}>
                <td>
                  {run.periodMonth}/{run.periodYear}
                </td>
                <td>
                  <span className={`badge ${statusBadgeClass(run.status)}`}>{run.status}</span>
                </td>
                <td className="num">{run.payslips.length}</td>
                <td>
                  <button type="button" onClick={() => refreshSelected(run.id)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRun && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Run {selectedRun.periodMonth}/{selectedRun.periodYear}
            <span className={`badge ${statusBadgeClass(selectedRun.status)}`}>{selectedRun.status}</span>
          </h2>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {canRun && selectedRun.status === 'DRAFT' && (
              <button type="button" className="btn-primary" onClick={handleProcess} disabled={busy}>
                {busy ? 'Processing…' : 'Process (compute payslips)'}
              </button>
            )}
            {canRun && selectedRun.status === 'PROCESSED' && (
              <button type="button" className="btn-primary" onClick={handlePost} disabled={busy}>
                {busy ? 'Posting…' : 'Post to ledger'}
              </button>
            )}
            {selectedRun.payslips.length > 0 && (
              <button type="button" onClick={exportRunCsv}>
                Export CSV
              </button>
            )}
          </div>

          {selectedRun.payslips.length > 0 && (
            <>
              {canDisburse && (
                <label className="field" style={{ maxWidth: 320 }}>
                  Payment ledger for disbursement
                  <select value={paymentLedgerId} onChange={(e) => setPaymentLedgerId(e.target.value)}>
                    <option value="">— select —</option>
                    {ledgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th className="num">Gross (₹)</th>
                    <th className="num">Deductions (₹)</th>
                    <th className="num">Net pay (₹)</th>
                    <th className="num">Outstanding (₹)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selectedRun.payslips.map((payslip) => (
                    <tr key={payslip.id}>
                      <td>{payslip.employeeName}</td>
                      <td className="num">{payslip.grossEarnings.toFixed(2)}</td>
                      <td className="num">{payslip.totalDeductions.toFixed(2)}</td>
                      <td className="num">{payslip.netPay.toFixed(2)}</td>
                      <td className="num">{payslip.outstandingAmount.toFixed(2)}</td>
                      <td>
                        {canRun && selectedRun.status === 'PROCESSED' && (
                          <button type="button" onClick={() => handleOverrideTds(payslip)}>
                            Edit TDS
                          </button>
                        )}
                        {canDisburse && selectedRun.status === 'POSTED' && payslip.outstandingAmount > 0 && (
                          <button type="button" onClick={() => handleDisburse(payslip)} disabled={disbursing === payslip.id}>
                            {disbursing === payslip.id ? 'Paying…' : 'Disburse'}
                          </button>
                        )}
                        {canPrint && selectedRun.status !== 'DRAFT' && (
                          <>
                            {' '}
                            <button type="button" onClick={() => handlePrintPayslip(payslip)} disabled={printingId === payslip.id}>
                              Print
                            </button>{' '}
                            <button type="button" onClick={() => handleSavePayslipPdf(payslip)} disabled={printingId === payslip.id}>
                              Save PDF
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedRun.payslips.map(
                (payslip) =>
                  selectedRun.status !== 'DRAFT' && (
                    <details key={`${payslip.id}-lines`} style={{ fontSize: 12, marginTop: 8 }}>
                      <summary style={{ cursor: 'pointer' }}>{payslip.employeeName}'s payslip lines</summary>
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
    </div>
  );
}
