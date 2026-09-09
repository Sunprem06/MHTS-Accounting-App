import { useEffect, useState } from 'react';
import { ArrowLeft, Banknote } from 'lucide-react';
import type { EmployeePayrollProfileSummary, SalaryStructureSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusBadgeClass(status: string): string {
  return status === 'ACTIVE' ? 'badge-success' : 'badge-muted';
}

/** Assigns/re-assigns an employee's CTC — a raise is a new dated row, never an edit of history (see @mhts/core-payroll-engine's assignSalaryStructure), so the history table below always shows the full progression, not just the current figure. */
export function SalaryStructureScreen({ session, onBack }: Props) {
  const [employees, setEmployees] = useState<EmployeePayrollProfileSummary[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [structures, setStructures] = useState<SalaryStructureSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [annualCtcRupees, setAnnualCtcRupees] = useState(0);

  const canManage = session.permissions.includes('PAYROLL.MANAGE_SALARY_STRUCTURE');

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listEmployeePayrollProfiles();
      if (result.ok && result.data) {
        setEmployees(result.data.filter((e) => e.isActive));
      }
    })();
  }, []);

  async function refresh(employeeId: string) {
    const result = await window.mhts.listSalaryStructuresForEmployee(employeeId);
    if (result.ok && result.data) {
      setStructures(result.data);
    } else {
      setError(result.error ?? 'Failed to load salary structures');
    }
  }

  useEffect(() => {
    if (selectedEmployeeId) {
      refresh(selectedEmployeeId);
    } else {
      setStructures(null);
    }
  }, [selectedEmployeeId]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployeeId) return;
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.assignSalaryStructure({ employeeId: selectedEmployeeId, effectiveFrom, annualCtcRupees });
    setSubmitting(false);
    if (result.ok) {
      await refresh(selectedEmployeeId);
    } else {
      setError(result.error ?? 'Failed to assign salary structure');
    }
  }

  const active = structures?.find((s) => s.status === 'ACTIVE') ?? null;

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Banknote size={18} style={{ color: 'var(--accent)' }} /> Salary structure (CTC)
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <label className="field" style={{ maxWidth: 320, marginBottom: 0 }}>
          Employee
          <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
            <option value="">— select —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employeeCode} — {emp.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedEmployeeId && (
        <>
          {active && (
            <div className="card" style={{ overflowX: 'auto' }}>
              <h2>Current structure (effective {active.effectiveFrom})</h2>
              <p style={{ marginTop: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
                Annual CTC: ₹{active.annualCtc.toFixed(2)} — Monthly statutory wage base: ₹{active.monthlyStatutoryWageBase.toFixed(2)}
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Type</th>
                    <th className="num">Monthly (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {active.lines.map((line) => (
                    <tr key={line.componentId}>
                      <td>{line.componentName}</td>
                      <td>{line.componentType}</td>
                      <td className="num">{line.monthlyAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {structures && structures.length > 0 && (
            <div className="card" style={{ overflowX: 'auto' }}>
              <h2>History</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Effective from</th>
                    <th>Effective to</th>
                    <th className="num">Annual CTC (₹)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {structures.map((s) => (
                    <tr key={s.id}>
                      <td>{s.effectiveFrom}</td>
                      <td>{s.effectiveTo ?? '—'}</td>
                      <td className="num">{s.annualCtc.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass(s.status)}`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && (
            <form onSubmit={handleAssign} className="card">
              <h2>{active ? 'Revise CTC' : 'Assign CTC'}</h2>
              <div className="field-row">
                <label className="field">
                  Effective from
                  <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
                </label>
                <label className="field">
                  Annual CTC (₹)
                  <input type="number" step="0.01" min="0" value={annualCtcRupees} onChange={(e) => setAnnualCtcRupees(Number(e.target.value) || 0)} required style={{ width: 160 }} />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
