import { useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720 }}>
      <h1>Employees</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {employees === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Code</th>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Department</th>
              <th style={{ textAlign: 'right' }}>Owed (₹)</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} style={{ opacity: employee.isActive ? 1 : 0.6 }}>
                <td>{employee.employeeCode}</td>
                <td>{employee.name}</td>
                <td>{employee.department ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{employee.outstandingBalance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <h2>New employee</h2>
          <label>
            Employee code
            <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required />
          </label>{' '}
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>{' '}
          <label>
            Department
            <input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </label>
          <br />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add employee'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
