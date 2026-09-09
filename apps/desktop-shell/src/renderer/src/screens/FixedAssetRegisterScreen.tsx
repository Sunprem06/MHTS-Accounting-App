import { Fragment, useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import type { AssetClassSummary, AssetDepreciationEntrySummary, CostCentreSummary, FixedAssetSummary, SessionInfo, LedgerAccountSummary } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusBadgeClass(status: string): string {
  return status === 'DISPOSED' ? 'badge-muted' : 'badge-success';
}

export function FixedAssetRegisterScreen({ session, onBack }: Props) {
  const [assets, setAssets] = useState<FixedAssetSummary[] | null>(null);
  const [assetClasses, setAssetClasses] = useState<AssetClassSummary[]>([]);
  const [ledgers, setLedgers] = useState<LedgerAccountSummary[]>([]);
  const [costCentres, setCostCentres] = useState<CostCentreSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<AssetDepreciationEntrySummary[] | null>(null);
  const [disposingId, setDisposingId] = useState<string | null>(null);

  const [assetClassId, setAssetClassId] = useState('');
  const [name, setName] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [purchaseCostRupees, setPurchaseCostRupees] = useState('');
  const [salvageValueRupees, setSalvageValueRupees] = useState('');
  const [costCentreId, setCostCentreId] = useState('');
  const [paidFromLedgerId, setPaidFromLedgerId] = useState('');

  const [disposalDate, setDisposalDate] = useState(todayIso());
  const [saleProceedsRupees, setSaleProceedsRupees] = useState('0');
  const [receiptLedgerId, setReceiptLedgerId] = useState('');

  const canManage = session.permissions.includes('FIXED_ASSETS.MANAGE_ASSETS');

  async function refresh() {
    const result = await window.mhts.listFixedAssets();
    if (result.ok && result.data) {
      setAssets(result.data);
    } else {
      setError(result.error ?? 'Failed to load fixed assets');
    }
  }

  useEffect(() => {
    refresh();
    window.mhts.listAssetClasses().then((r) => r.ok && r.data && setAssetClasses(r.data));
    window.mhts.listLedgers().then((r) => r.ok && r.data && setLedgers(r.data));
    window.mhts.listCostCentres().then((r) => r.ok && r.data && setCostCentres(r.data));
  }, []);

  async function handleAcquire(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await window.mhts.acquireFixedAsset({
      assetClassId,
      name,
      assetCode,
      purchaseDate,
      purchaseCostRupees: Number(purchaseCostRupees),
      salvageValueRupees: salvageValueRupees ? Number(salvageValueRupees) : undefined,
      costCentreId: costCentreId || undefined,
      paidFromLedgerId,
    });
    setSubmitting(false);
    if (result.ok) {
      setName('');
      setAssetCode('');
      setPurchaseCostRupees('');
      setSalvageValueRupees('');
      await refresh();
    } else {
      setError(result.error ?? 'Failed to acquire fixed asset');
    }
  }

  async function toggleSchedule(assetId: string) {
    if (expandedId === assetId) {
      setExpandedId(null);
      setSchedule(null);
      return;
    }
    const result = await window.mhts.getAssetDepreciationSchedule(assetId);
    if (result.ok && result.data) {
      setSchedule(result.data);
      setExpandedId(assetId);
    } else {
      setError(result.error ?? 'Failed to load depreciation schedule');
    }
  }

  async function handleDispose(assetId: string) {
    setError(null);
    const proceeds = Number(saleProceedsRupees);
    if (proceeds > 0 && !receiptLedgerId) {
      setError('A receipt ledger is required when sale proceeds are greater than zero');
      return;
    }
    const result = await window.mhts.disposeFixedAsset({
      assetId,
      disposalDate,
      saleProceedsRupees: proceeds,
      receiptLedgerId: receiptLedgerId || undefined,
    });
    if (result.ok) {
      setDisposingId(null);
      await refresh();
    } else {
      setError(result.error ?? 'Failed to dispose fixed asset');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <ClipboardList size={18} style={{ color: 'var(--accent)' }} /> Fixed asset register
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {assets === null ? (
          <p className="empty-state">Loading…</p>
        ) : assets.length === 0 ? (
          <p className="empty-state">No fixed assets yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Class</th>
                <th>Purchase date</th>
                <th className="num">Cost (₹)</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <Fragment key={asset.id}>
                  <tr style={{ opacity: asset.status === 'DISPOSED' ? 0.6 : 1 }}>
                    <td>{asset.assetCode}</td>
                    <td>{asset.name}</td>
                    <td>{asset.assetClassName}</td>
                    <td>{asset.purchaseDate}</td>
                    <td className="num">{asset.purchaseCost.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(asset.status)}`}>{asset.status}</span>
                    </td>
                    <td>
                      <button type="button" onClick={() => toggleSchedule(asset.id)}>
                        {expandedId === asset.id ? 'Hide' : 'Schedule'}
                      </button>{' '}
                      {canManage && asset.status === 'ACTIVE' && (
                        <button type="button" onClick={() => setDisposingId(disposingId === asset.id ? null : asset.id)}>
                          Dispose
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === asset.id && schedule && (
                    <tr>
                      <td colSpan={7}>
                        <table className="data-table" style={{ fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th>Book</th>
                              <th>FY</th>
                              <th className="num">Opening WDV (₹)</th>
                              <th className="num">Depreciation (₹)</th>
                              <th className="num">Closing WDV (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.map((entry, i) => (
                              <tr key={i}>
                                <td>{entry.book === 'SCHEDULE2' ? 'Companies Act (Schedule II)' : 'Income Tax (WDV block)'}</td>
                                <td>{entry.financialYear}</td>
                                <td className="num">{entry.openingWdv.toFixed(2)}</td>
                                <td className="num">{entry.depreciationAmount.toFixed(2)}</td>
                                <td className="num">{entry.closingWdv.toFixed(2)}</td>
                              </tr>
                            ))}
                            {schedule.length === 0 && (
                              <tr>
                                <td colSpan={5} className="empty-state">
                                  No depreciation posted yet — run depreciation for a financial year that includes this asset.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                  {disposingId === asset.id && (
                    <tr>
                      <td colSpan={7}>
                        <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)' }}>
                          <div className="field-row" style={{ marginBottom: 0 }}>
                            <label className="field">
                              Disposal date
                              <input type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} />
                            </label>
                            <label className="field">
                              Sale proceeds (₹, 0 for a write-off)
                              <input type="number" step="0.01" value={saleProceedsRupees} onChange={(e) => setSaleProceedsRupees(e.target.value)} style={{ width: 120 }} />
                            </label>
                            {Number(saleProceedsRupees) > 0 && (
                              <label className="field">
                                Receipt ledger
                                <select value={receiptLedgerId} onChange={(e) => setReceiptLedgerId(e.target.value)}>
                                  <option value="">— select —</option>
                                  {ledgers.map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            <button type="button" className="btn-primary" onClick={() => handleDispose(asset.id)} style={{ marginBottom: 12 }}>
                              Confirm disposal
                            </button>
                          </div>
                        </div>
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
        <form onSubmit={handleAcquire} className="card">
          <h2>Acquire a fixed asset</h2>
          <div className="field-row">
            <label className="field">
              Asset class
              <select value={assetClassId} onChange={(e) => setAssetClassId(e.target.value)} required>
                <option value="">— select —</option>
                {assetClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Asset code
              <input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} required style={{ width: 140 }} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              Purchase date
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
            </label>
            <label className="field">
              Purchase cost (₹)
              <input type="number" step="0.01" value={purchaseCostRupees} onChange={(e) => setPurchaseCostRupees(e.target.value)} required style={{ width: 140 }} />
            </label>
            <label className="field">
              Salvage value (₹, optional)
              <input type="number" step="0.01" value={salvageValueRupees} onChange={(e) => setSalvageValueRupees(e.target.value)} style={{ width: 140 }} />
            </label>
          </div>
          <div className="field-row">
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
            <label className="field">
              Paid from ledger
              <select value={paidFromLedgerId} onChange={(e) => setPaidFromLedgerId(e.target.value)} required>
                <option value="">— select —</option>
                {ledgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Acquiring…' : 'Acquire asset'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
