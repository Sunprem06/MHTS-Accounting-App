import { Fragment, useEffect, useState } from 'react';
import { ArrowLeft, PiggyBank } from 'lucide-react';
import type { BudgetSummary, BudgetVsActualResult, CostCentreSummary, LedgerAccountSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function evenSplit(totalRupees: number): number[] {
  const base = Math.floor((totalRupees / 12) * 100) / 100;
  const lines = Array(12).fill(base);
  lines[0] = Math.round((totalRupees - base * 11) * 100) / 100;
  return lines;
}

/** A budget is scoped to a ledger and/or a cost centre for a financial year, with 12 monthly amounts — compared against actual posted vouchers in Budget vs Actual below. */
export function BudgetsScreen({ session, onBack }: Props) {
  const [budgets, setBudgets] = useState<BudgetSummary[] | null>(null);
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [costCentres, setCostCentres] = useState<CostCentreSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actual, setActual] = useState<BudgetVsActualResult | null>(null);

  const [name, setName] = useState('');
  const [financialYear, setFinancialYear] = useState('');
  const [ledgerId, setLedgerId] = useState('');
  const [costCentreId, setCostCentreId] = useState('');
  const [annualTotal, setAnnualTotal] = useState('');
  const [monthlyAmounts, setMonthlyAmounts] = useState<number[]>(Array(12).fill(0));

  const canManage = session.permissions.includes('ACCOUNTING.MANAGE_BUDGETS');

  async function refresh() {
    const result = await window.mhts.listBudgets();
    if (result.ok && result.data) {
      setBudgets(result.data);
    } else {
      setError(result.error ?? 'Failed to load budgets');
    }
  }

  useEffect(() => {
    refresh();
    window.mhts.listLedgers().then((r) => r.ok && r.data && setLedgers(r.data));
    window.mhts.listCostCentres().then((r) => r.ok && r.data && setCostCentres(r.data));
  }, []);

  function applyEvenSplit() {
    const total = Number(annualTotal);
    if (!Number.isFinite(total) || total <= 0) {
      return;
    }
    setMonthlyAmounts(evenSplit(total));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ledgerId && !costCentreId) {
      setError('A budget must be scoped to a ledger, a cost centre, or both');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.createBudget({
      name,
      financialYear,
      ledgerId: ledgerId || undefined,
      costCentreId: costCentreId || undefined,
      lines: monthlyAmounts.map((amountRupees, i) => ({ periodMonth: i + 1, amountRupees })),
    });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setAnnualTotal('');
      setMonthlyAmounts(Array(12).fill(0));
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create budget');
    }
  }

  async function viewActual(budgetId: string) {
    if (expandedId === budgetId) {
      setExpandedId(null);
      setActual(null);
      return;
    }
    const result = await window.mhts.getBudgetVsActual(budgetId);
    if (result.ok && result.data) {
      setActual(result.data);
      setExpandedId(budgetId);
    } else {
      setError(result.error ?? 'Failed to load budget vs actual');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <PiggyBank size={18} style={{ color: 'var(--accent)' }} /> Budgets
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {budgets === null ? (
          <p className="empty-state">Loading…</p>
        ) : budgets.length === 0 ? (
          <p className="empty-state">No budgets yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>FY</th>
                <th>Ledger</th>
                <th>Cost centre</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => (
                <Fragment key={budget.id}>
                  <tr>
                    <td>{budget.name}</td>
                    <td>{budget.financialYear}</td>
                    <td>{budget.ledgerName ?? '—'}</td>
                    <td>{budget.costCentreName ?? '—'}</td>
                    <td>
                      <button type="button" onClick={() => viewActual(budget.id)}>
                        {expandedId === budget.id ? 'Hide' : 'Budget vs Actual'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === budget.id && actual && (
                    <tr>
                      <td colSpan={5}>
                        <table className="data-table" style={{ fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th className="num">Budgeted (₹)</th>
                              <th className="num">Actual (₹)</th>
                              <th className="num">Variance (₹)</th>
                              <th className="num">Variance %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {actual.rows.map((row) => (
                              <tr key={row.periodMonth}>
                                <td>{MONTH_NAMES[row.periodMonth - 1]}</td>
                                <td className="num">{row.budgetedAmount.toFixed(2)}</td>
                                <td className="num">{row.actualAmount.toFixed(2)}</td>
                                <td className="num" style={{ color: row.varianceAmount > 0 ? 'var(--danger)' : undefined }}>
                                  {row.varianceAmount.toFixed(2)}
                                </td>
                                <td className="num">{row.variancePercent === null ? '—' : `${row.variancePercent.toFixed(1)}%`}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="card">
          <h2>New budget</h2>
          <div className="field-row">
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Financial year (e.g. 2026-27)
              <input value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} required style={{ width: 120 }} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              Ledger (optional)
              <select value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
                <option value="">—</option>
                {ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Cost centre (optional)
              <select value={costCentreId} onChange={(e) => setCostCentreId(e.target.value)}>
                <option value="">—</option>
                {costCentres.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field" style={{ maxWidth: 400 }}>
            Annual total (₹) — splits evenly across 12 months below, then edit any month
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" step="0.01" value={annualTotal} onChange={(e) => setAnnualTotal(e.target.value)} style={{ width: 160 }} />
              <button type="button" onClick={applyEvenSplit}>
                Split evenly
              </button>
            </div>
          </label>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ marginTop: 8, marginBottom: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {MONTH_NAMES.map((m) => (
                    <th key={m} style={{ fontSize: 11, padding: '0 4px', color: 'var(--fg-muted)', textAlign: 'left' }}>
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {monthlyAmounts.map((amount, i) => (
                    <td key={i} style={{ padding: '2px 2px' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => {
                          const next = [...monthlyAmounts];
                          next[i] = Number(e.target.value);
                          setMonthlyAmounts(next);
                        }}
                        style={{ width: 76 }}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create budget'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
