import { Fragment, useEffect, useState } from 'react';
import type { BranchSummary, CostCentreSummary, LedgerAccountSummary, PaymentInstrumentInput, SessionInfo } from '../../../shared/ipc';
import { PaymentInstrumentFields } from './PaymentInstrumentFields';
import { foreignUnitsToBaseRupees } from '../fx';

interface Props {
  session: SessionInfo;
  onCreated: () => void;
  onBack: () => void;
}

const BANK_ACCOUNTS_GROUP = 'Bank Accounts';

interface ParticularLine {
  ledgerId: string;
  amountRupees: number;
  costCentreId?: string;
  branchId?: string;
  foreignCurrency?: string;
  foreignAmountUnits?: number;
  exchangeRate?: number;
}

function emptyParticular(): ParticularLine {
  return { ledgerId: '', amountRupees: 0 };
}

/** Money going out: one "Paid from" ledger (Cash/Bank) is credited automatically for the total; one or more "Paid to" lines are debited — no manual balancing needed. */
export function PaymentVoucherScreen({ session, onCreated, onBack }: Props) {
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [costCentres, setCostCentres] = useState<CostCentreSummary[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [paidFromLedgerId, setPaidFromLedgerId] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [particulars, setParticulars] = useState<ParticularLine[]>([emptyParticular()]);
  const [instrument, setInstrument] = useState<PaymentInstrumentInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const paidFromIsBank = ledgers.find((l) => l.id === paidFromLedgerId)?.groupName === BANK_ACCOUNTS_GROUP;
  const canRecordInstrument = session.permissions.includes('BANKING.RECORD_PAYMENT_INSTRUMENT');

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listLedgers();
      if (result.ok && result.data) {
        setLedgers(result.data);
        setPaidFromLedgerId(result.data.find((l) => l.name === 'Cash')?.id ?? result.data[0]?.id ?? '');
        setParticulars([{ ...emptyParticular(), ledgerId: result.data[0]?.id ?? '' }]);
      }
    })();
    window.mhts.listCostCentres().then((r) => r.ok && r.data && setCostCentres(r.data));
    window.mhts.listBranches().then((r) => r.ok && r.data && setBranches(r.data));
  }, []);

  function updateParticular(index: number, patch: Partial<ParticularLine>) {
    setParticulars((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  /** Keeps amountRupees exactly consistent with foreignAmountUnits x exchangeRate, since core-accounting rejects any mismatch. */
  function updateParticularFx(index: number, patch: { foreignCurrency?: string; foreignAmountUnits?: number; exchangeRate?: number }) {
    setParticulars((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (next.foreignCurrency && next.foreignAmountUnits !== undefined && next.exchangeRate !== undefined) {
          next.amountRupees = foreignUnitsToBaseRupees(next.foreignAmountUnits, next.exchangeRate);
        }
        return next;
      }),
    );
  }

  const total = particulars.reduce((sum, p) => sum + (Number(p.amountRupees) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (total <= 0) {
      setError('Enter at least one amount greater than zero.');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.recordBankVoucher({
      voucherType: 'PAYMENT',
      voucherDate,
      narration: narration || undefined,
      lines: [
        ...particulars.map((p) => ({
          ledgerId: p.ledgerId,
          debitRupees: Number(p.amountRupees) || 0,
          creditRupees: 0,
          costCentreId: p.costCentreId,
          branchId: p.branchId,
          foreignCurrency: p.foreignCurrency,
          foreignAmountUnits: p.foreignCurrency ? Number(p.foreignAmountUnits) || 0 : undefined,
          exchangeRate: p.foreignCurrency ? Number(p.exchangeRate) || 0 : undefined,
        })),
        { ledgerId: paidFromLedgerId, debitRupees: 0, creditRupees: total },
      ],
      instrument: paidFromIsBank ? instrument : null,
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to create payment voucher');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>Payment voucher</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Paid from
          <select value={paidFromLedgerId} onChange={(e) => setPaidFromLedgerId(e.target.value)} required>
            {ledgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>
                {ledger.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Date
          <input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} required />
        </label>
        <br />
        <label>
          Narration
          <input value={narration} onChange={(e) => setNarration(e.target.value)} style={{ width: '100%' }} />
        </label>

        {paidFromIsBank && canRecordInstrument && <PaymentInstrumentFields value={instrument} onChange={setInstrument} />}

        <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Paid to</th>
              <th style={{ textAlign: 'right' }}>Amount (₹)</th>
              <th style={{ textAlign: 'left' }}>Cost centre</th>
              <th style={{ textAlign: 'left' }}>Branch</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {particulars.map((line, index) => (
              <Fragment key={index}>
                <tr>
                  <td>
                    <select value={line.ledgerId} onChange={(e) => updateParticular(index, { ledgerId: e.target.value })} required>
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
                      value={line.amountRupees || ''}
                      disabled={Boolean(line.foreignCurrency)}
                      onChange={(e) => updateParticular(index, { amountRupees: Number(e.target.value) || 0 })}
                      style={{ width: 100, textAlign: 'right' }}
                    />
                  </td>
                  <td>
                    <select value={line.costCentreId ?? ''} onChange={(e) => updateParticular(index, { costCentreId: e.target.value || undefined })}>
                      <option value="">—</option>
                      {costCentres.map((cc) => (
                        <option key={cc.id} value={cc.id}>
                          {cc.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={line.branchId ?? ''} onChange={(e) => updateParticular(index, { branchId: e.target.value || undefined })}>
                      <option value="">—</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {particulars.length > 1 && (
                      <button type="button" onClick={() => setParticulars((prev) => prev.filter((_, i) => i !== index))}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} style={{ paddingBottom: 8 }}>
                    <label style={{ fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(line.foreignCurrency)}
                        onChange={(e) =>
                          updateParticularFx(index, e.target.checked ? { foreignCurrency: 'USD', foreignAmountUnits: 0, exchangeRate: 0 } : { foreignCurrency: undefined, foreignAmountUnits: undefined, exchangeRate: undefined })
                        }
                      />{' '}
                      Foreign currency
                    </label>
                    {line.foreignCurrency && (
                      <span style={{ marginLeft: 8 }}>
                        <input value={line.foreignCurrency} onChange={(e) => updateParticularFx(index, { foreignCurrency: e.target.value.toUpperCase() })} style={{ width: 50 }} placeholder="USD" />{' '}
                        <input
                          type="number"
                          step="0.01"
                          value={line.foreignAmountUnits || ''}
                          onChange={(e) => updateParticularFx(index, { foreignAmountUnits: Number(e.target.value) || 0 })}
                          style={{ width: 100 }}
                          placeholder="Foreign amount"
                        />{' '}
                        <input
                          type="number"
                          step="0.0001"
                          value={line.exchangeRate || ''}
                          onChange={(e) => updateParticularFx(index, { exchangeRate: Number(e.target.value) || 0 })}
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
                <button type="button" onClick={() => setParticulars((prev) => [...prev, emptyParticular()])}>
                  + Add line
                </button>
              </td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{total.toFixed(2)}</td>
              <td />
              <td />
              <td />
            </tr>
          </tfoot>
        </table>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={submitting || total <= 0}>
          {submitting ? 'Saving…' : 'Save payment'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
