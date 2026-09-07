import { Fragment, useEffect, useState } from 'react';
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Budgets</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {budgets === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>FY</th>
              <th style={{ textAlign: 'left' }}>Ledger</th>
              <th style={{ textAlign: 'left' }}>Cost centre</th>
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
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Month</th>
                            <th style={{ textAlign: 'right' }}>Budgeted (₹)</th>
                            <th style={{ textAlign: 'right' }}>Actual (₹)</th>
                            <th style={{ textAlign: 'right' }}>Variance (₹)</th>
                            <th style={{ textAlign: 'right' }}>Variance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {actual.rows.map((row) => (
                            <tr key={row.periodMonth}>
                              <td>{MONTH_NAMES[row.periodMonth - 1]}</td>
                              <td style={{ textAlign: 'right' }}>{row.budgetedAmount.toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>{row.actualAmount.toFixed(2)}</td>
                              <td style={{ textAlign: 'right', color: row.varianceAmount > 0 ? 'crimson' : 'inherit' }}>{row.varianceAmount.toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>{row.variancePercent === null ? '—' : `${row.variancePercent.toFixed(1)}%`}</td>
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

      {canManage && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <h2>New budget</h2>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>{' '}
          <label>
            Financial year (e.g. 2026-27)
            <input value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} required style={{ width: 100 }} />
          </label>
          <br />
          <label>
            Ledger (optional)
            <select value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
              <option value="">—</option>
              {ledgers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>{' '}
          <label>
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
          <br />
          <label>
            Annual total (₹) — splits evenly across 12 months below, then edit any month
            <input type="number" step="0.01" value={annualTotal} onChange={(e) => setAnnualTotal(e.target.value)} style={{ width: 120 }} />
          </label>{' '}
          <button type="button" onClick={applyEvenSplit}>
            Split evenly
          </button>
          <table style={{ marginTop: 8, marginBottom: 8 }}>
            <thead>
              <tr>
                {MONTH_NAMES.map((m) => (
                  <th key={m} style={{ fontSize: 11, padding: '0 4px' }}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {monthlyAmounts.map((amount, i) => (
                  <td key={i}>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => {
                        const next = [...monthlyAmounts];
                        next[i] = Number(e.target.value);
                        setMonthlyAmounts(next);
                      }}
                      style={{ width: 70 }}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Create budget'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
