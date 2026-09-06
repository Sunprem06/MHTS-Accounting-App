import { useEffect, useState } from 'react';
import type { EmployeePayrollProfileSummary, LeaveApplicationSummary, LeaveBalanceSummary, LeaveTypeSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Leave</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {canManageTypes && (
        <details style={{ marginBottom: 16 }}>
          <summary>Leave types</summary>
          <ul>
            {leaveTypes.map((t) => (
              <li key={t.id}>
                {t.name} — {t.annualEntitlementDays} days/year {t.isPaid ? '(paid)' : '(unpaid)'}
              </li>
            ))}
          </ul>
          <form onSubmit={handleCreateType}>
            <input placeholder="Name (e.g. Casual Leave)" value={typeName} onChange={(e) => setTypeName(e.target.value)} required />{' '}
            <input type="number" min={0} value={typeDays} onChange={(e) => setTypeDays(Number(e.target.value) || 0)} style={{ width: 60 }} /> days/year{' '}
            <label>
              <input type="checkbox" checked={typeIsPaid} onChange={(e) => setTypeIsPaid(e.target.checked)} /> Paid
            </label>{' '}
            <button type="submit">Add</button>
          </form>
        </details>
      )}

      {canApply && (
        <form onSubmit={handleApply} style={{ marginBottom: 24, border: '1px solid #ccc', padding: 12 }}>
          <h2>Apply for leave</h2>
          <label>
            Employee
            <select value={applyEmployeeId} onChange={(e) => setApplyEmployeeId(e.target.value)} required>
              <option value="">— select —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeCode} — {emp.name}
                </option>
              ))}
            </select>
          </label>{' '}
          <label>
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
          <br />
          <label>
            From
            <input type="date" value={applyFrom} onChange={(e) => setApplyFrom(e.target.value)} required />
          </label>{' '}
          <label>
            To
            <input type="date" value={applyTo} onChange={(e) => setApplyTo(e.target.value)} required />
          </label>{' '}
          <label>
            Reason
            <input value={applyReason} onChange={(e) => setApplyReason(e.target.value)} />
          </label>{' '}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Applying…' : 'Apply'}
          </button>
        </form>
      )}

      <h2>Applications</h2>
      {applications === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Employee</th>
              <th style={{ textAlign: 'left' }}>Type</th>
              <th style={{ textAlign: 'left' }}>From</th>
              <th style={{ textAlign: 'left' }}>To</th>
              <th style={{ textAlign: 'right' }}>Days</th>
              <th style={{ textAlign: 'left' }}>Status</th>
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
                <td style={{ textAlign: 'right' }}>{app.days}</td>
                <td>{app.status}</td>
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

      <h2>Leave balance</h2>
      <label>
        Employee
        <select value={balanceEmployeeId} onChange={(e) => setBalanceEmployeeId(e.target.value)}>
          <option value="">— select —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.employeeCode} — {emp.name}
            </option>
          ))}
        </select>
      </label>{' '}
      <button type="button" onClick={handleLoadBalances}>
        Load
      </button>
      {balances && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Type</th>
              <th style={{ textAlign: 'right' }}>Opening</th>
              <th style={{ textAlign: 'right' }}>Accrued</th>
              <th style={{ textAlign: 'right' }}>Availed</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.leaveTypeId}>
                <td>{b.leaveTypeName}</td>
                <td style={{ textAlign: 'right' }}>{b.openingBalanceDays}</td>
                <td style={{ textAlign: 'right' }}>{b.accruedDays}</td>
                <td style={{ textAlign: 'right' }}>{b.availedDays}</td>
                <td style={{ textAlign: 'right' }}>{b.balanceDays}</td>
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
