import { useEffect, useState } from 'react';
import type { DocumentLineInput, LedgerAccountSummary, PartySummary } from '../../../shared/ipc';
import { DocumentLinesEditor } from './DocumentLinesEditor';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

export function NewSalesInvoiceScreen({ onCreated, onBack }: Props) {
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [partyId, setPartyId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<DocumentLineInput[]>([{ description: '', ledgerId: '', amountRupees: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [partiesResult, ledgersResult] = await Promise.all([window.mhts.listParties(), window.mhts.listLedgers()]);
      if (partiesResult.ok && partiesResult.data) {
        const customers = partiesResult.data.filter((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH');
        setParties(customers);
        setPartyId(customers[0]?.id ?? '');
      }
      if (ledgersResult.ok && ledgersResult.data) {
        const incomeLedgers = ledgersResult.data.filter((l) => l.nature === 'INCOME');
        setLedgers(incomeLedgers.length > 0 ? incomeLedgers : ledgersResult.data);
        setLines([{ description: '', ledgerId: (incomeLedgers[0] ?? ledgersResult.data[0])?.id ?? '', amountRupees: 0 }]);
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!partyId) {
      setError('Add a customer first.');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.createSalesInvoice({ partyId, invoiceDate, narration: narration || undefined, lines });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to create sales invoice');
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>New sales invoice</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Customer
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)} required>
            <option value="" disabled>
              Select customer
            </option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
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

        <div style={{ marginTop: 16 }}>
          <DocumentLinesEditor lines={lines} ledgers={ledgers} ledgerLabel="Income ledger" onChange={setLines} />
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
