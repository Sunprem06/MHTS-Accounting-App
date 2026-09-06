import { useEffect, useState } from 'react';
import type { CalculationType, ComponentType, SalaryComponentDefinitionSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

/** The CTC breakup building blocks (Basic, HRA, Special Allowance, ...) — see @mhts/core-payroll-engine's salaryStructure.ts for how PCT_OF_BASIC/PCT_OF_CTC get resolved into an employee's actual salary_structure_line amounts. isStatutoryWageBase marks whether this component counts toward "wages" under the Labour Code's unified definition, before the 50%-allowance-cap reclassification runs. */
export function SalaryComponentsScreen({ session, onBack }: Props) {
  const [components, setComponents] = useState<SalaryComponentDefinitionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [componentType, setComponentType] = useState<ComponentType>('EARNING');
  const [calculationType, setCalculationType] = useState<CalculationType>('FLAT');
  const [flatAmountRupees, setFlatAmountRupees] = useState(0);
  const [percent, setPercent] = useState(0);
  const [isStatutoryWageBase, setIsStatutoryWageBase] = useState(false);

  const canManage = session.permissions.includes('PAYROLL.MANAGE_SALARY_STRUCTURE');

  async function refresh() {
    const result = await window.mhts.listSalaryComponents();
    if (result.ok && result.data) {
      setComponents(result.data);
    } else {
      setError(result.error ?? 'Failed to load salary components');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createSalaryComponent({
      name,
      componentType,
      calculationType,
      flatAmountRupees: calculationType === 'FLAT' ? flatAmountRupees : undefined,
      percent: calculationType !== 'FLAT' ? percent : undefined,
      isStatutoryWageBase,
    });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setFlatAmountRupees(0);
      setPercent(0);
      setIsStatutoryWageBase(false);
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create salary component');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Salary components</h1>
      <p style={{ fontSize: 12, color: '#666' }}>
        The building blocks of a CTC breakup. "Counts as wages" marks whether this component is part of the Labour Code's statutory wage base before the
        allowance cap reclassifies any excess allowance as wages (see Manage Payroll Rules).
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {components === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Type</th>
              <th style={{ textAlign: 'left' }}>Calculation</th>
              <th style={{ textAlign: 'right' }}>Value</th>
              <th style={{ textAlign: 'center' }}>Counts as wages</th>
            </tr>
          </thead>
          <tbody>
            {components.map((c) => (
              <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.6 }}>
                <td>{c.name}</td>
                <td>{c.componentType}</td>
                <td>{c.calculationType}</td>
                <td style={{ textAlign: 'right' }}>{c.calculationType === 'FLAT' ? `₹${c.flatAmountRupees?.toFixed(2)}` : `${c.percent}%`}</td>
                <td style={{ textAlign: 'center' }}>{c.isStatutoryWageBase ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <h2>New component</h2>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>{' '}
          <label>
            Type
            <select value={componentType} onChange={(e) => setComponentType(e.target.value as ComponentType)}>
              <option value="EARNING">Earning</option>
              <option value="DEDUCTION">Deduction</option>
            </select>
          </label>{' '}
          <label>
            Calculation
            <select value={calculationType} onChange={(e) => setCalculationType(e.target.value as CalculationType)}>
              <option value="FLAT">Flat amount</option>
              <option value="PCT_OF_BASIC">% of Basic</option>
              <option value="PCT_OF_CTC">% of annual CTC</option>
            </select>
          </label>
          <br />
          {calculationType === 'FLAT' ? (
            <label>
              Monthly amount (₹)
              <input type="number" step="0.01" min="0" value={flatAmountRupees} onChange={(e) => setFlatAmountRupees(Number(e.target.value) || 0)} />
            </label>
          ) : (
            <label>
              Percent
              <input type="number" step="0.01" min="0" value={percent} onChange={(e) => setPercent(Number(e.target.value) || 0)} />
            </label>
          )}
          <br />
          <label>
            <input type="checkbox" checked={isStatutoryWageBase} onChange={(e) => setIsStatutoryWageBase(e.target.checked)} /> Counts as statutory wages (e.g. Basic, DA)
          </label>
          <br />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add component'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
