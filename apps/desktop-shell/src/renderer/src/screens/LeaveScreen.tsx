import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import type { EmployeePayrollProfileSummary, LeaveApplicationSummary, LeaveApplicationStatus, LeaveBalanceSummary, LeaveTypeSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusBadgeClass(status: LeaveApplicationStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'badge-success';
    case 'PENDING':
      return 'badge-warning';
    default:
      return 'badge-muted';
  }
}

/** Combines leave-type setup, applying, the approval register, and a balance lookup on one screen — each is a small enough piece of Phase 7's leave subsystem that four separate screens would just be more clicking for the same workflow. */
export function LeaveScreen({ session, onBack }: Props) {
  const [employees, setEmployees] = useState<EmployeePayrollProfileSummary[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeSummary[]>([]);
  const [applications, setApplications] = useState<LeaveApplicationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManageTypes = session.permissions.includes('PAYROLL.MANAGE_ATTENDANCE');
  const canApply = session.permissions.includes('PAYROLL.APPLY_LEAVE');
  const canApprove = session.permissions.includes('PAYROLL.APPROVE_LEAVE');

  const [typeName, setTypeName] = useState('');
  const [typeDays, setTypeDays] = useState(12);
  const [typeIsPaid, setTypeIsPaid] = useState(true);

  const [applyEmployeeId, setApplyEmployeeId] = useState('');
  const [applyLeaveTypeId, setApplyLeaveTypeId] = useState('');
  const [applyFrom, setApplyFrom] = useState(todayIso());
  const [applyTo, setApplyTo] = useState(todayIso());
  const [applyReason, setApplyReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [balanceEmployeeId, setBalanceEmployeeId] = useState('');
  const [balances, setBalances] = useState<LeaveBalanceSummary[] | null>(null);

  async function refreshTypes() {
    const result = await window.mhts.listLeaveTypes();
    if (result.ok && result.data) setLeaveTypes(result.data);
  }
  async function refreshApplications() {
    const result = await window.mhts.listLeaveApplications();
    if (result.ok && result.data) setApplications(result.data);
  }

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listEmployeePayrollProfiles();
      if (result.ok && result.data) setEmployees(result.data.filter((e) => e.isActive));
    })();
    refreshTypes();
    refreshApplications();
  }, []);

  async function handleCreateType(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await window.mhts.createLeaveType({ name: typeName, isPaid: typeIsPaid, annualEntitlementDays: typeDays });
    if (result.ok) {
      setTypeName('');
      await refreshTypes();
    } else {
      setError(result.error ?? 'Failed to create leave type');
    }
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.applyLeave({ employeeId: applyEmployeeId, leaveTypeId: applyLeaveTypeId, fromDate: applyFrom, toDate: applyTo, reason: applyReason || undefined });
    setSubmitting(false);
    if (result.ok) {
      setApplyReason('');
      await refreshApplications();
    } else {
      setError(result.error ?? 'Failed to apply for leave');
    }
  }

  async function handleApprove(id: string) {
    setError(null);
    const result = await window.mhts.approveLeave(id);
    if (result.ok) {
      await refreshApplications();
    } else {
      setError(result.error ?? 'Failed to approve leave');
    }
  }

  async function handleReject(id: string) {
    const reason = window.prompt('Reason for rejection?') ?? '';
    setError(null);
    const result = await window.mhts.rejectLeave({ leaveApplicationId: id, reason });
    if (result.ok) {
      await refreshApplications();
    } else {
      setError(result.error ?? 'Failed to reject leave');
    }
  }

  async function handleLoadBalances() {
    if (!balanceEmployeeId) return;
    const result = await window.mhts.listLeaveBalances(balanceEmployeeId);
    if (result.ok && result.data) setBalances(result.data);
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <CalendarDays size={18} style={{ color: 'var(--accent)' }} /> Leave
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      {canManageTypes && (
        <details className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Leave types</summary>
          <ul style={{ marginTop: 8 }}>
            {leaveTypes.map((t) => (
              <li key={t.id}>
                {t.name} — {t.annualEntitlementDays} days/year {t.isPaid ? '(paid)' : '(unpaid)'}
              </li>
            ))}
          </ul>
          <form onSubmit={handleCreateType} className="field-row" style={{ alignItems: 'flex-end' }}>
            <label className="field">
              Name
              <input placeholder="e.g. Casual Leave" value={typeName} onChange={(e) => setTypeName(e.target.value)} required />
            </label>
            <label className="field">
              Days/year
              <input type="number" min={0} value={typeDays} onChange={(e) => setTypeDays(Number(e.target.value) || 0)} style={{ width: 90 }} />
            </label>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={typeIsPaid} onChange={(e) => setTypeIsPaid(e.target.checked)} />
              Paid
            </label>
            <button type="submit" style={{ marginBottom: 12 }}>
              Add
            </button>
          </form>
        </details>
      )}

      {canApply && (
        <form onSubmit={handleApply} className="card">
          <h2>Apply for leave</h2>
          <div className="field-row">
            <label className="field">
              Employee
              <select value={applyEmployeeId} onChange={(e) => setApplyEmployeeId(e.target.value)} required>
                <option value="">— select —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeCode} — {emp.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Leave type
              <select value={applyLeaveTypeId} onChange={(e) => setApplyLeaveTypeId(e.target.value)} required>
                <option value="">— select —</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              From
              <input type="date" value={applyFrom} onChange={(e) => setApplyFrom(e.target.value)} required />
            </label>
            <label className="field">
              To
              <input type="date" value={applyTo} onChange={(e) => setApplyTo(e.target.value)} required />
            </label>
            <label className="field" style={{ flex: 2 }}>
              Reason
              <input value={applyReason} onChange={(e) => setApplyReason(e.target.value)} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Applications</h2>
        {applications === null ? (
          <p className="empty-state">Loading…</p>
        ) : applications.length === 0 ? (
          <p className="empty-state">No leave applications yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th className="num">Days</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>{app.employeeName}</td>
                  <td>{app.leaveTypeName}</td>
                  <td>{app.fromDate}</td>
                  <td>{app.toDate}</td>
                  <td className="num">{app.days}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(app.status)}`}>{app.status}</span>
                  </td>
                  <td>
                    {canApprove && app.status === 'PENDING' && (
                      <>
                        <button type="button" onClick={() => handleApprove(app.id)}>
                          Approve
                        </button>{' '}
                        <button type="button" onClick={() => handleReject(app.id)}>
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Leave balance</h2>
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            Employee
            <select value={balanceEmployeeId} onChange={(e) => setBalanceEmployeeId(e.target.value)}>
              <option value="">— select —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeCode} — {emp.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleLoadBalances} style={{ marginBottom: 12 }}>
            Load
          </button>
        </div>
        {balances && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th className="num">Opening</th>
                <th className="num">Accrued</th>
                <th className="num">Availed</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.leaveTypeId}>
                  <td>{b.leaveTypeName}</td>
                  <td className="num">{b.openingBalanceDays}</td>
                  <td className="num">{b.accruedDays}</td>
                  <td className="num">{b.availedDays}</td>
                  <td className="num">{b.balanceDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
