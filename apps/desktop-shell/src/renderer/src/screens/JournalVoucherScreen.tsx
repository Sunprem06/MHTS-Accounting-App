import { Fragment, useEffect, useState } from 'react';
import { ArrowLeft, Receipt } from 'lucide-react';
import type { BranchSummary, CostCentreSummary, LedgerAccountSummary, VoucherLineInput } from '../../../shared/ipc';
import { foreignUnitsToBaseRupees } from '../fx';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

function emptyLine(): VoucherLineInput {
  return { ledgerId: '', debitRupees: 0, creditRupees: 0 };
}

/** For adjustments not involving Cash/Bank directly. Payment/Receipt/Contra have their own dedicated, auto-balancing screens. */
export function JournalVoucherScreen({ onCreated, onBack }: Props) {
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [costCentres, setCostCentres] = useState<CostCentreSummary[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<VoucherLineInput[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listLedgers();
      if (result.ok && result.data) {
        setLedgers(result.data);
        setLines([
          { ...emptyLine(), ledgerId: result.data[0]?.id ?? '' },
          { ...emptyLine(), ledgerId: result.data[0]?.id ?? '' },
        ]);
      }
    })();
    window.mhts.listCostCentres().then((r) => r.ok && r.data && setCostCentres(r.data));
    window.mhts.listBranches().then((r) => r.ok && r.data && setBranches(r.data));
  }, []);

  function updateLine(index: number, patch: Partial<VoucherLineInput>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  /** Keeps debit/credit rupees exactly consistent with foreignAmountUnits x exchangeRate, since core-accounting rejects any mismatch. */
  function updateFx(index: number, patch: { foreignCurrency?: string; foreignAmountUnits?: number; exchangeRate?: number }) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (next.foreignCurrency && next.foreignAmountUnits !== undefined && next.exchangeRate !== undefined) {
          const base = foreignUnitsToBaseRupees(next.foreignAmountUnits, next.exchangeRate);
          if (line.debitRupees > 0) next.debitRupees = base;
          else next.creditRupees = base;
        }
        return next;
      }),
    );
  }

  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debitRupees) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.creditRupees) || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.createVoucher({
      voucherType: 'JOURNAL',
      voucherDate,
      narration: narration || undefined,
      lines: lines.map((line) => ({
        ledgerId: line.ledgerId,
        debitRupees: Number(line.debitRupees) || 0,
        creditRupees: Number(line.creditRupees) || 0,
        costCentreId: line.costCentreId || undefined,
        branchId: line.branchId || undefined,
        foreignCurrency: line.foreignCurrency || undefined,
        foreignAmountUnits: line.foreignCurrency ? Number(line.foreignAmountUnits) || 0 : undefined,
        exchangeRate: line.foreignCurrency ? Number(line.exchangeRate) || 0 : undefined,
      })),
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to create voucher');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack} disabled={submitting}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Receipt size={18} style={{ color: 'var(--accent)' }} /> Journal voucher
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field-row">
            <label className="field">
              Date
              <input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} required />
            </label>
            <label className="field" style={{ flex: 3 }}>
              Narration
              <input value={narration} onChange={(e) => setNarration(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ledger</th>
                <th className="num">Debit (₹)</th>
                <th className="num">Credit (₹)</th>
                <th>Cost centre</th>
                <th>Branch</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <Fragment key={index}>
                  <tr>
                    <td>
                      <select value={line.ledgerId} onChange={(e) => updateLine(index, { ledgerId: e.target.value })} required>
                        <option value="" disabled>
                          Select ledger
                        </option>
                        {ledgers.map((ledger) => (
                          <option key={ledger.id} value={ledger.id}>
                            {ledger.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debitRupees || ''}
                        disabled={Boolean(line.foreignCurrency)}
                        onChange={(e) => updateLine(index, { debitRupees: Number(e.target.value) || 0, creditRupees: 0 })}
                        style={{ width: 100, textAlign: 'right' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.creditRupees || ''}
                        disabled={Boolean(line.foreignCurrency)}
                        onChange={(e) => updateLine(index, { creditRupees: Number(e.target.value) || 0, debitRupees: 0 })}
                        style={{ width: 100, textAlign: 'right' }}
                      />
                    </td>
                    <td>
                      <select value={line.costCentreId ?? ''} onChange={(e) => updateLine(index, { costCentreId: e.target.value || undefined })}>
                        <option value="">—</option>
                        {costCentres.map((cc) => (
                          <option key={cc.id} value={cc.id}>
                            {cc.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={line.branchId ?? ''} onChange={(e) => updateLine(index, { branchId: e.target.value || undefined })}>
                        <option value="">—</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {lines.length > 2 && (
                        <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ paddingBottom: 8 }}>
                      <label style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(line.foreignCurrency)}
                          onChange={(e) => updateFx(index, e.target.checked ? { foreignCurrency: 'USD', foreignAmountUnits: 0, exchangeRate: 0 } : { foreignCurrency: undefined, foreignAmountUnits: undefined, exchangeRate: undefined })}
                        />
                        Foreign currency
                      </label>
                      {line.foreignCurrency && (
                        <span style={{ marginLeft: 8 }}>
                          <input value={line.foreignCurrency} onChange={(e) => updateFx(index, { foreignCurrency: e.target.value.toUpperCase() })} style={{ width: 50 }} placeholder="USD" />{' '}
                          <input
                            type="number"
                            step="0.01"
                            value={line.foreignAmountUnits || ''}
                            onChange={(e) => updateFx(index, { foreignAmountUnits: Number(e.target.value) || 0 })}
                            style={{ width: 100 }}
                            placeholder="Foreign amount"
                          />{' '}
                          <input
                            type="number"
                            step="0.0001"
                            value={line.exchangeRate || ''}
                            onChange={(e) => updateFx(index, { exchangeRate: Number(e.target.value) || 0 })}
                            style={{ width: 90 }}
                            placeholder="Rate (₹)"
                          />
                        </span>
                      )}
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                    + Add line
                  </button>
                </td>
                <td className="num">₹{totalDebit.toFixed(2)}</td>
                <td className="num">₹{totalCredit.toFixed(2)}</td>
                <td />
                <td />
                <td />
              </tr>
            </tfoot>
          </table>

          {!balanced && (
            <p style={{ color: totalDebit === 0 ? 'var(--fg-muted)' : 'var(--danger)', fontSize: 13, marginTop: 12, marginBottom: 0 }}>
              Debits and credits must be equal and non-zero to save.
            </p>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting || !balanced}>
            {submitting ? 'Saving…' : 'Save voucher'}
          </button>
          <button type="button" onClick={onBack} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
