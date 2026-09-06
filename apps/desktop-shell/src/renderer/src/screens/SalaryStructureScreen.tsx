import { useEffect, useState } from 'react';
import type { EmployeePayrollProfileSummary, SalaryStructureSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Salary structure (CTC)</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <label>
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

      {selectedEmployeeId && (
        <>
          {active && (
            <div style={{ margin: '16px 0' }}>
              <h2>Current structure (effective {active.effectiveFrom})</h2>
              <p>
                Annual CTC: ₹{active.annualCtc.toFixed(2)} — Monthly statutory wage base: ₹{active.monthlyStatutoryWageBase.toFixed(2)}
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Component</th>
                    <th style={{ textAlign: 'left' }}>Type</th>
                    <th style={{ textAlign: 'right' }}>Monthly (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {active.lines.map((line) => (
                    <tr key={line.componentId}>
                      <td>{line.componentName}</td>
                      <td>{line.componentType}</td>
                      <td style={{ textAlign: 'right' }}>{line.monthlyAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {structures && structures.length > 0 && (
            <div style={{ margin: '16px 0' }}>
              <h3>History</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Effective from</th>
                    <th style={{ textAlign: 'left' }}>Effective to</th>
                    <th style={{ textAlign: 'right' }}>Annual CTC (₹)</th>
                    <th style={{ textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {structures.map((s) => (
                    <tr key={s.id}>
                      <td>{s.effectiveFrom}</td>
                      <td>{s.effectiveTo ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{s.annualCtc.toFixed(2)}</td>
                      <td>{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && (
            <form onSubmit={handleAssign} style={{ marginTop: 16 }}>
              <h2>{active ? 'Revise CTC' : 'Assign CTC'}</h2>
              <label>
                Effective from
                <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
              </label>{' '}
              <label>
                Annual CTC (₹)
                <input type="number" step="0.01" min="0" value={annualCtcRupees} onChange={(e) => setAnnualCtcRupees(Number(e.target.value) || 0)} required />
              </label>{' '}
              <button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </form>
          )}
        </>
      )}

      <p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
