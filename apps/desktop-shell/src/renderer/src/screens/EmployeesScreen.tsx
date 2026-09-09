import { useEffect, useState } from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import type { EmployeeSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

export function EmployeesScreen({ session, onBack }: Props) {
  const [employees, setEmployees] = useState<EmployeeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [employeeCode, setEmployeeCode] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = session.permissions.includes('EXPENSE.MANAGE_EMPLOYEES');

  async function refresh() {
    const result = await window.mhts.listEmployees();
    if (result.ok && result.data) {
      setEmployees(result.data);
    } else {
      setError(result.error ?? 'Failed to load employees');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createEmployee({ employeeCode, name, department: department || undefined });
    setSubmitting(false);
    if (result.ok) {
      setEmployeeCode('');
      setName('');
      setDepartment('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create employee');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Users size={18} style={{ color: 'var(--accent)' }} /> Employees
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {employees === null ? (
          <p className="empty-state">Loading…</p>
        ) : employees.length === 0 ? (
          <p className="empty-state">No employees yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th className="num">Owed (₹)</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} style={{ opacity: employee.isActive ? 1 : 0.6 }}>
                  <td>{employee.employeeCode}</td>
                  <td>{employee.name}</td>
                  <td>{employee.department ?? '—'}</td>
                  <td className="num">{employee.outstandingBalance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New employee</h2>
          <div className="field-row">
            <label className="field">
              Employee code
              <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required />
            </label>
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Department
              <input value={department} onChange={(e) => setDepartment(e.target.value)} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add employee'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
