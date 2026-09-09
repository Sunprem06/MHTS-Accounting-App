import { useEffect, useState } from 'react';
import { ArrowLeft, Layers } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Layers size={18} style={{ color: 'var(--accent)' }} /> Salary components
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        The building blocks of a CTC breakup. "Counts as wages" marks whether this component is part of the Labour Code's statutory wage base before the
        allowance cap reclassifies any excess allowance as wages (see Manage Payroll Rules).
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {components === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Calculation</th>
                <th className="num">Value</th>
                <th>Counts as wages</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.6 }}>
                  <td>{c.name}</td>
                  <td>{c.componentType}</td>
                  <td>{c.calculationType}</td>
                  <td className="num">{c.calculationType === 'FLAT' ? `₹${c.flatAmountRupees?.toFixed(2)}` : `${c.percent}%`}</td>
                  <td>
                    <span className={`badge ${c.isStatutoryWageBase ? 'badge-success' : 'badge-muted'}`}>{c.isStatutoryWageBase ? 'Yes' : 'No'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New component</h2>
          <div className="field-row">
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Type
              <select value={componentType} onChange={(e) => setComponentType(e.target.value as ComponentType)}>
                <option value="EARNING">Earning</option>
                <option value="DEDUCTION">Deduction</option>
              </select>
            </label>
            <label className="field">
              Calculation
              <select value={calculationType} onChange={(e) => setCalculationType(e.target.value as CalculationType)}>
                <option value="FLAT">Flat amount</option>
                <option value="PCT_OF_BASIC">% of Basic</option>
                <option value="PCT_OF_CTC">% of annual CTC</option>
              </select>
            </label>
            {calculationType === 'FLAT' ? (
              <label className="field">
                Monthly amount (₹)
                <input type="number" step="0.01" min="0" value={flatAmountRupees} onChange={(e) => setFlatAmountRupees(Number(e.target.value) || 0)} style={{ width: 140 }} />
              </label>
            ) : (
              <label className="field">
                Percent
                <input type="number" step="0.01" min="0" value={percent} onChange={(e) => setPercent(Number(e.target.value) || 0)} style={{ width: 120 }} />
              </label>
            )}
          </div>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={isStatutoryWageBase} onChange={(e) => setIsStatutoryWageBase(e.target.checked)} />
            Counts as statutory wages (e.g. Basic, DA)
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add component'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
