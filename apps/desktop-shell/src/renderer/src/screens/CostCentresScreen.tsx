import { useEffect, useState } from 'react';
import { ArrowLeft, Building2 } from 'lucide-react';
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
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Building2 size={18} style={{ color: 'var(--accent)' }} /> Cost centres
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {costCentres === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {costCentres.map((cc) => (
                <tr key={cc.id} style={{ opacity: cc.isActive ? 1 : 0.6 }}>
                  <td>{cc.name}</td>
                  <td>{cc.code ?? '—'}</td>
                  <td>
                    <span className={`badge ${cc.isActive ? 'badge-success' : 'badge-muted'}`}>{cc.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td>{canManage && <button onClick={() => toggleActive(cc)}>{cc.isActive ? 'Deactivate' : 'Activate'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New cost centre</h2>
          <div className="field-row">
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Code (optional)
              <input value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 120 }} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add cost centre'}
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Cost centre P&amp;L (since inception)</h2>
        {report === null ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Cost centre</th>
                <th className="num">Income (₹)</th>
                <th className="num">Expense (₹)</th>
                <th className="num">Net (₹)</th>
              </tr>
            </thead>
            <tbody>
              {report.map((row) => (
                <tr key={row.costCentreId ?? '__unassigned__'}>
                  <td>{row.costCentreName}</td>
                  <td className="num">{row.totalIncome.toFixed(2)}</td>
                  <td className="num">{row.totalExpense.toFixed(2)}</td>
                  <td className="num">{row.net.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
