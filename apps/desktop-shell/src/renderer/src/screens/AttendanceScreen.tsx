import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarCheck } from 'lucide-react';
import type { AttendanceRecordSummary, AttendanceStatus, EmployeePayrollProfileSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

const DIRECT_STATUSES: Exclude<AttendanceStatus, 'ON_LEAVE'>[] = ['PRESENT', 'ABSENT', 'HALF_DAY', 'HOLIDAY', 'WEEKLY_OFF'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Every calendar day is assumed PRESENT unless marked otherwise — this screen is for recording the exceptions (absences, half-days, holidays) across a date range for many employees at once, not confirming every ordinary working day one by one. ON_LEAVE is set only by an approved leave application (see the Leave screen), never marked directly here. */
export function AttendanceScreen({ session, onBack }: Props) {
  const [employees, setEmployees] = useState<EmployeePayrollProfileSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [status, setStatus] = useState<Exclude<AttendanceStatus, 'ON_LEAVE'>>('ABSENT');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [viewEmployeeId, setViewEmployeeId] = useState('');
  const [viewYear, setViewYear] = useState(new Date().getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getUTCMonth() + 1);
  const [records, setRecords] = useState<AttendanceRecordSummary[] | null>(null);

  const canManage = session.permissions.includes('PAYROLL.MANAGE_ATTENDANCE');

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listEmployeePayrollProfiles();
      if (result.ok && result.data) {
        setEmployees(result.data.filter((e) => e.isActive));
      }
    })();
  }, []);

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function handleMark(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (selectedIds.size === 0) {
      setError('Select at least one employee');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.markAttendance({ employeeIds: [...selectedIds], fromDate, toDate, status });
    setSubmitting(false);
    if (result.ok) {
      setMessage(`Marked ${status} for ${selectedIds.size} employee(s), ${fromDate} to ${toDate}`);
      setSelectedIds(new Set());
    } else {
      setError(result.error ?? 'Failed to mark attendance');
    }
  }

  async function handleView() {
    if (!viewEmployeeId) return;
    const result = await window.mhts.listAttendanceForEmployee({ employeeId: viewEmployeeId, periodYear: viewYear, periodMonth: viewMonth });
    if (result.ok && result.data) {
      setRecords(result.data);
    } else {
      setError(result.error ?? 'Failed to load attendance');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <CalendarCheck size={18} style={{ color: 'var(--accent)' }} /> Attendance
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && (
        <p className="badge badge-success" style={{ display: 'inline-block', marginBottom: 16 }}>
          {message}
        </p>
      )}

      {canManage && (
        <form onSubmit={handleMark} className="card">
          <h2>Mark a date range</h2>
          <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8, marginBottom: 12 }}>
            {employees.map((emp) => (
              <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '2px 0' }}>
                <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggle(emp.id)} /> {emp.employeeCode} — {emp.name}
              </label>
            ))}
          </div>
          <div className="field-row">
            <label className="field">
              From
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
            </label>
            <label className="field">
              To
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
            </label>
            <label className="field">
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as Exclude<AttendanceStatus, 'ON_LEAVE'>)}>
                {DIRECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Marking…' : 'Mark'}
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>View a month</h2>
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            Employee
            <select value={viewEmployeeId} onChange={(e) => setViewEmployeeId(e.target.value)}>
              <option value="">— select —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeCode} — {emp.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Year
            <input type="number" value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))} style={{ width: 90 }} />
          </label>
          <label className="field">
            Month
            <input type="number" min={1} max={12} value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))} style={{ width: 70 }} />
          </label>
          <button type="button" onClick={handleView} style={{ marginBottom: 12 }}>
            Load
          </button>
        </div>

        {records && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={2} className="empty-state">
                    No exceptions recorded — every day this month is assumed present.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.attendanceDate}>
                    <td>{r.attendanceDate}</td>
                    <td>{r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
