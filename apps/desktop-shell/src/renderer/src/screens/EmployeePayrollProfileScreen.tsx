import { useEffect, useState } from 'react';
import type { EmployeePayrollProfileSummary, EmploymentType, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

const EMPLOYMENT_TYPES: EmploymentType[] = ['PERMANENT', 'FIXED_TERM', 'CONTRACTUAL', 'CONSULTANT'];

/** Extends Phase 6's bare employee (code/name/department) with the payroll-specific fields Phase 7 needs — a separate screen rather than folding into EmployeesScreen, since this data (PAN, bank details, statutory numbers) is materially more sensitive and gated by its own PAYROLL.MANAGE_EMPLOYEE_PROFILE permission. */
export function EmployeePayrollProfileScreen({ session, onBack }: Props) {
  const [employees, setEmployees] = useState<EmployeePayrollProfileSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    dateOfBirth: '',
    dateOfJoining: '',
    dateOfLeaving: '',
    employmentType: '' as EmploymentType | '',
    pan: '',
    bankAccountNumber: '',
    bankIfsc: '',
    uan: '',
    esiNumber: '',
    pfVoluntaryOptOut: false,
    designation: '',
  });

  const canManage = session.permissions.includes('PAYROLL.MANAGE_EMPLOYEE_PROFILE');

  async function refresh() {
    const result = await window.mhts.listEmployeePayrollProfiles();
    if (result.ok && result.data) {
      setEmployees(result.data);
    } else {
      setError(result.error ?? 'Failed to load employee payroll profiles');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function selectEmployee(employee: EmployeePayrollProfileSummary) {
    setSelectedId(employee.id);
    setForm({
      dateOfBirth: employee.dateOfBirth ?? '',
      dateOfJoining: employee.dateOfJoining ?? '',
      dateOfLeaving: employee.dateOfLeaving ?? '',
      employmentType: employee.employmentType ?? '',
      pan: employee.pan ?? '',
      bankAccountNumber: employee.bankAccountNumber ?? '',
      bankIfsc: employee.bankIfsc ?? '',
      uan: employee.uan ?? '',
      esiNumber: employee.esiNumber ?? '',
      pfVoluntaryOptOut: employee.pfVoluntaryOptOut,
      designation: employee.designation ?? '',
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);
    setSaving(true);
    const result = await window.mhts.updateEmployeePayrollProfile({
      employeeId: selectedId,
      dateOfBirth: form.dateOfBirth || undefined,
      dateOfJoining: form.dateOfJoining || undefined,
      dateOfLeaving: form.dateOfLeaving || undefined,
      employmentType: form.employmentType || undefined,
      pan: form.pan || undefined,
      bankAccountNumber: form.bankAccountNumber || undefined,
      bankIfsc: form.bankIfsc || undefined,
      uan: form.uan || undefined,
      esiNumber: form.esiNumber || undefined,
      pfVoluntaryOptOut: form.pfVoluntaryOptOut,
      designation: form.designation || undefined,
    });
    setSaving(false);
    if (result.ok) {
      setSelectedId(null);
      await refresh();
    } else {
      setError(result.error ?? 'Failed to save payroll profile');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Employee payroll profiles</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {employees === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Code</th>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Employment type</th>
              <th style={{ textAlign: 'left' }}>Date of joining</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} style={{ opacity: employee.isActive ? 1 : 0.6 }}>
                <td>{employee.employeeCode}</td>
                <td>{employee.name}</td>
                <td>{employee.employmentType ?? '—'}</td>
                <td>{employee.dateOfJoining ?? '—'}</td>
                <td>{canManage && <button onClick={() => selectEmployee(employee)}>Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && selectedId && (
        <form onSubmit={handleSave} style={{ marginBottom: 24, border: '1px solid #ccc', padding: 12 }}>
          <h2>Edit payroll profile</h2>
          <label>
            Designation
            <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          </label>{' '}
          <label>
            Date of birth
            <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          </label>{' '}
          <label>
            Date of joining
            <input type="date" value={form.dateOfJoining} onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })} />
          </label>{' '}
          <label>
            Date of leaving
            <input type="date" value={form.dateOfLeaving} onChange={(e) => setForm({ ...form, dateOfLeaving: e.target.value })} />
          </label>
          <br />
          <label>
            Employment type
            <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as EmploymentType })}>
              <option value="">— select —</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>{' '}
          <span style={{ fontSize: 11, color: '#666' }}>Drives gratuity's 1yr (fixed-term) vs 5yr (permanent) eligibility rule.</span>
          <br />
          <label>
            PAN
            <input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
          </label>{' '}
          <label>
            UAN
            <input value={form.uan} onChange={(e) => setForm({ ...form, uan: e.target.value })} />
          </label>{' '}
          <label>
            ESI number
            <input value={form.esiNumber} onChange={(e) => setForm({ ...form, esiNumber: e.target.value })} />
          </label>
          <br />
          <label>
            Bank account number
            <input value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} />
          </label>{' '}
          <label>
            Bank IFSC
            <input value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })} />
          </label>
          <br />
          <label>
            <input type="checkbox" checked={form.pfVoluntaryOptOut} onChange={(e) => setForm({ ...form, pfVoluntaryOptOut: e.target.checked })} /> Opted out of PF (above wage ceiling)
          </label>
          <br />
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>{' '}
          <button type="button" onClick={() => setSelectedId(null)}>
            Cancel
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
