import { useEffect, useState } from 'react';
import type { CostCentreSummary, CostCentreSummaryRow, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

/** Cost centres are a dimension tag any voucher line can optionally carry (see Journal/Payment/Receipt/Contra screens' cost centre selector) — this screen manages the tag list itself and a cost-centre-wise P&L. */
export function CostCentresScreen({ session, onBack }: Props) {
  const [costCentres, setCostCentres] = useState<CostCentreSummary[] | null>(null);
  const [report, setReport] = useState<CostCentreSummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = session.permissions.includes('ACCOUNTING.MANAGE_COST_CENTRES');

  async function refresh() {
    const result = await window.mhts.listCostCentres();
    if (result.ok && result.data) {
      setCostCentres(result.data);
    } else {
      setError(result.error ?? 'Failed to load cost centres');
    }
  }

  async function refreshReport() {
    const result = await window.mhts.getCostCentreReport({});
    if (result.ok && result.data) {
      setReport(result.data);
    }
  }

  useEffect(() => {
    refresh();
    refreshReport();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createCostCentre({ name, code: code || undefined });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setCode('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create cost centre');
    }
  }

  async function toggleActive(costCentre: CostCentreSummary) {
    const result = await window.mhts.updateCostCentre({ costCentreId: costCentre.id, isActive: !costCentre.isActive });
    if (result.ok) {
      await refresh();
    } else {
      setError(result.error ?? 'Failed to update cost centre');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Cost centres</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {costCentres === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Code</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {costCentres.map((cc) => (
              <tr key={cc.id} style={{ opacity: cc.isActive ? 1 : 0.6 }}>
                <td>{cc.name}</td>
                <td>{cc.code ?? '—'}</td>
                <td>{cc.isActive ? 'Active' : 'Inactive'}</td>
                <td>{canManage && <button onClick={() => toggleActive(cc)}>{cc.isActive ? 'Deactivate' : 'Activate'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <h2>New cost centre</h2>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>{' '}
          <label>
            Code (optional)
            <input value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 100 }} />
          </label>{' '}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add cost centre'}
          </button>
        </form>
      )}

      <h2>Cost centre P&amp;L (since inception)</h2>
      {report === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Cost centre</th>
              <th style={{ textAlign: 'right' }}>Income (₹)</th>
              <th style={{ textAlign: 'right' }}>Expense (₹)</th>
              <th style={{ textAlign: 'right' }}>Net (₹)</th>
            </tr>
          </thead>
          <tbody>
            {report.map((row) => (
              <tr key={row.costCentreId ?? '__unassigned__'}>
                <td>{row.costCentreName}</td>
                <td style={{ textAlign: 'right' }}>{row.totalIncome.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{row.totalExpense.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{row.net.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
