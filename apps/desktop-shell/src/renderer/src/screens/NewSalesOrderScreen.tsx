import { useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import type { DocumentLineInput, ItemSummary, LedgerAccountSummary, PartySummary, WarehouseSummary } from '../../../shared/ipc';
import { DocumentLinesEditor } from './DocumentLinesEditor';

interface Props {
  onCreated: () => void;
  onBack: () => void;
}

/** An order has no ledger impact until it's converted to an invoice — see SalesOrderRegisterScreen. A stockable line here also has no stock impact until conversion; item/quantity/rate just ride along on the order until then. */
export function NewSalesOrderScreen({ onCreated, onBack }: Props) {
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [partyId, setPartyId] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
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
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!partyId) {
      setError('Add a customer first.');
      return;
    }
    setSubmitting(true);
    const result = await window.mhts.createSalesOrder({ partyId, orderDate, narration: narration || undefined, lines });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to create sales order');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack} disabled={submitting}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ClipboardList size={18} style={{ color: 'var(--accent)' }} /> New sales order
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
              <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required />
            </label>
          </div>
          <label className="field">
            Narration
            <input value={narration} onChange={(e) => setNarration(e.target.value)} />
          </label>
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
            documentDate={orderDate}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting || parties.length === 0}>
            {submitting ? 'Saving…' : 'Save order'}
          </button>
          <button type="button" onClick={onBack} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
