import { useEffect, useState } from 'react';
import type { EmployeeSummary, ExpenseClaimLineFormInput } from '../../../shared/ipc';
import { ExpenseLinesEditor } from './ExpenseLinesEditor';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

export function NewExpenseClaimScreen({ onCreated, onBack }: Props) {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [claimDate, setClaimDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState('');
  const [lines, setLines] = useState<ExpenseClaimLineFormInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listEmployees();
      if (result.ok && result.data) {
        setEmployees(result.data);
        setEmployeeId(result.data[0]?.id ?? '');
      }
    })();
  }, []);

  const total = lines.reduce((sum, line) => sum + (Number(line.amountRupees) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (total <= 0) {
      setError('Enter at least one line with an amount greater than zero.');
      return;
    }
    setSubmitting(true);
    const createResult = await window.mhts.createExpenseClaim({ employeeId, claimDate, purpose: purpose || undefined, lines });
    if (!createResult.ok || !createResult.data) {
      setSubmitting(false);
      setError(createResult.error ?? 'Failed to create expense claim');
      return;
    }
    const submitResult = await window.mhts.submitExpenseClaim(createResult.data);
    setSubmitting(false);
    if (submitResult.ok) {
      onCreated();
    } else {
      setError(`Claim saved but could not be submitted: ${submitResult.error ?? 'unknown error'}. Find it in the Expense Claim register to submit it there.`);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720 }}>
      <h1>New expense claim</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Employee
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} ({employee.employeeCode})
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Date
          <input type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} required />
        </label>
        <br />
        <label>
          Purpose
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} style={{ width: '100%' }} placeholder="e.g. Client visit to Mumbai, 12-14 June" />
        </label>

        <ExpenseLinesEditor lines={lines} onChange={setLines} />

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={submitting || total <= 0}>
          {submitting ? 'Saving…' : 'Save & submit for approval'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
