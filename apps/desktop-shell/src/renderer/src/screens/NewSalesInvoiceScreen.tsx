import { useEffect, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import type { BranchSummary, DocumentLineInput, ItemSummary, LedgerAccountSummary, PartySummary, WarehouseSummary } from '../../../shared/ipc';
import { DocumentLinesEditor } from './DocumentLinesEditor';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

export function NewSalesInvoiceScreen({ onCreated, onBack }: Props) {
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [partyId, setPartyId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [branchId, setBranchId] = useState('');
  const [isForeignCurrency, setIsForeignCurrency] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(0);
  const [lines, setLines] = useState<DocumentLineInput[]>([{ description: '', ledgerId: '', amountRupees: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [partiesResult, ledgersResult, itemsResult, warehousesResult] = await Promise.all([
        window.mhts.listParties(),
        window.mhts.listLedgers(),
        window.mhts.listItems(),
        window.mhts.listWarehouses(),
      ]);
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
      if (itemsResult.ok && itemsResult.data) setItems(itemsResult.data);
      if (warehousesResult.ok && warehousesResult.data) setWarehouses(warehousesResult.data);
    })();
    window.mhts.listBranches().then((r) => r.ok && r.data && setBranches(r.data));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!partyId) {
      setError('Add a customer first.');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.createSalesInvoice({
      partyId,
      invoiceDate,
      narration: narration || undefined,
      branchId: branchId || undefined,
      currency: isForeignCurrency ? currency : undefined,
      exchangeRate: isForeignCurrency ? exchangeRate : undefined,
      lines,
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to create sales invoice');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack} disabled={submitting}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <FileText size={18} style={{ color: 'var(--accent)' }} /> New sales invoice
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field-row">
            <label className="field">
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
            </label>
            <label className="field">
              Date
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
            </label>
            <label className="field">
              Branch
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Narration
            <input value={narration} onChange={(e) => setNarration(e.target.value)} />
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={isForeignCurrency} onChange={(e) => setIsForeignCurrency(e.target.checked)} />
            Foreign-currency invoice
          </label>
          {isForeignCurrency && (
            <div className="field-row">
              <label className="field">
                Currency
                <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} style={{ width: 80 }} placeholder="USD" />
              </label>
              <label className="field">
                Rate (₹ per unit)
                <input type="number" step="0.0001" value={exchangeRate || ''} onChange={(e) => setExchangeRate(Number(e.target.value) || 0)} style={{ width: 140 }} />
              </label>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Line items</h2>
          <DocumentLinesEditor
            lines={lines}
            ledgers={ledgers}
            ledgerLabel="Income ledger"
            onChange={setLines}
            items={items}
            warehouses={warehouses}
            mode="sales"
            partyId={partyId}
            documentDate={invoiceDate}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting || parties.length === 0 || (isForeignCurrency && exchangeRate <= 0)}>
            {submitting ? 'Saving…' : 'Save invoice'}
          </button>
          <button type="button" onClick={onBack} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
