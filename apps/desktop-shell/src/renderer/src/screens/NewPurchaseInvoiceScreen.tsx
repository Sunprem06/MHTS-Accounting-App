import { useEffect, useState } from 'react';
import type { DocumentLineInput, LedgerAccountSummary, PartySummary, TdsSectionCode } from '../../../shared/ipc';
import { DocumentLinesEditor } from './DocumentLinesEditor';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

const TDS_SECTIONS: { code: TdsSectionCode; label: string }[] = [
  { code: '194C', label: '194C — Contractors/sub-contractors' },
  { code: '194J', label: '194J — Professional/technical fees' },
  { code: '194Q', label: '194Q — Purchase of goods' },
  { code: '194I', label: '194I — Rent' },
];

export function NewPurchaseInvoiceScreen({ onCreated, onBack }: Props) {
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [partyId, setPartyId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [tdsSection, setTdsSection] = useState<TdsSectionCode | ''>('');
  const [lines, setLines] = useState<DocumentLineInput[]>([{ description: '', ledgerId: '', amountRupees: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [partiesResult, ledgersResult] = await Promise.all([window.mhts.listParties(), window.mhts.listLedgers()]);
      if (partiesResult.ok && partiesResult.data) {
        const suppliers = partiesResult.data.filter((p) => p.partyType === 'SUPPLIER' || p.partyType === 'BOTH');
        setParties(suppliers);
        setPartyId(suppliers[0]?.id ?? '');
      }
      if (ledgersResult.ok && ledgersResult.data) {
        const expenseLedgers = ledgersResult.data.filter((l) => l.nature === 'EXPENSE');
        setLedgers(expenseLedgers.length > 0 ? expenseLedgers : ledgersResult.data);
        setLines([{ description: '', ledgerId: (expenseLedgers[0] ?? ledgersResult.data[0])?.id ?? '', amountRupees: 0 }]);
      }
    })();
  }, []);

  const selectedParty = parties.find((p) => p.id === partyId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!partyId) {
      setError('Add a supplier first.');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.createPurchaseInvoice({
      partyId,
      invoiceDate,
      narration: narration || undefined,
      tdsSection: tdsSection || undefined,
      lines,
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to create purchase invoice');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>New purchase invoice</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Supplier
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)} required>
            <option value="" disabled>
              Select supplier
            </option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
                {party.isMsmeUdyamRegistered ? ' (MSME)' : ''}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Date
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
        </label>
        <br />
        <label>
          Narration
          <input value={narration} onChange={(e) => setNarration(e.target.value)} style={{ width: '100%' }} />
        </label>
        <br />
        <label>
          TDS section (optional)
          <select value={tdsSection} onChange={(e) => setTdsSection(e.target.value as TdsSectionCode | '')}>
            <option value="">No TDS</option>
            {TDS_SECTIONS.map((section) => (
              <option key={section.code} value={section.code}>
                {section.label}
              </option>
            ))}
          </select>
        </label>
        {selectedParty?.isMsmeUdyamRegistered && (
          <p style={{ color: '#8a6d00' }}>
            This supplier is Udyam-registered MSME — Section 43B(h) requires payment within 45 days (or the agreed credit period, if shorter).
          </p>
        )}

        <div style={{ marginTop: 16 }}>
          <DocumentLinesEditor lines={lines} ledgers={ledgers} ledgerLabel="Expense ledger" onChange={setLines} />
        </div>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={submitting || parties.length === 0}>
          {submitting ? 'Saving…' : 'Save invoice'}
        </button>{' '}
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
      </form>
    </div>
  );
}
