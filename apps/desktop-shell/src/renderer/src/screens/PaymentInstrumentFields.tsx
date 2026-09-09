import type { InstrumentType, PaymentInstrumentInput } from '../../../shared/ipc';

interface Props {
  value: PaymentInstrumentInput | null;
  onChange: (value: PaymentInstrumentInput | null) => void;
}

const INSTRUMENT_TYPES: InstrumentType[] = ['CHEQUE', 'NEFT', 'RTGS', 'UPI', 'IMPS', 'DD', 'CARD', 'CASH'];
const UTR_TYPES: InstrumentType[] = ['NEFT', 'RTGS', 'IMPS', 'UPI'];

/** Optional cheque/UTR sub-form shown by the Payment/Receipt/Contra screens whenever a bank ledger is on one side of the entry. Reused as-is by all three so the fields stay identical everywhere they can appear. */
export function PaymentInstrumentFields({ value, onChange }: Props) {
  return (
    <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, marginTop: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <input type="checkbox" checked={value !== null} onChange={(e) => onChange(e.target.checked ? { instrumentType: 'CHEQUE' } : null)} /> Record cheque / UTR details for
        this bank entry
      </label>
      {value && (
        <div className="field-row" style={{ marginTop: 8 }}>
          <label className="field">
            Instrument
            <select value={value.instrumentType} onChange={(e) => onChange({ ...value, instrumentType: e.target.value as InstrumentType })}>
              {INSTRUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {value.instrumentType === 'CHEQUE' && (
            <>
              <label className="field">
                Cheque no.
                <input value={value.chequeNumber ?? ''} onChange={(e) => onChange({ ...value, chequeNumber: e.target.value })} />
              </label>
              <label className="field">
                Cheque date
                <input type="date" value={value.chequeDate ?? ''} onChange={(e) => onChange({ ...value, chequeDate: e.target.value })} />
              </label>
            </>
          )}
          {UTR_TYPES.includes(value.instrumentType) && (
            <label className="field">
              UTR / reference no.
              <input value={value.utrReference ?? ''} onChange={(e) => onChange({ ...value, utrReference: e.target.value })} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
