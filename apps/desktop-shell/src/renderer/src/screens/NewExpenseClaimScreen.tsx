import { useEffect, useState } from 'react';
import { ArrowLeft, Receipt } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 780 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack} disabled={submitting}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Receipt size={18} style={{ color: 'var(--accent)' }} /> New expense claim
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="field-row">
          <label className="field">
            Employee
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.employeeCode})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Date
            <input type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} required />
          </label>
        </div>
        <label className="field">
          Purpose
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Client visit to Mumbai, 12-14 June" />
        </label>

        <ExpenseLinesEditor lines={lines} onChange={setLines} />

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting || total <= 0}>
            {submitting ? 'Saving…' : 'Save & submit for approval'}
          </button>
          <button type="button" onClick={onBack} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
