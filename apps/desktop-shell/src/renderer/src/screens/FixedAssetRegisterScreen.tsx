import { Fragment, useEffect, useState } from 'react';
import type { AssetClassSummary, AssetDepreciationEntrySummary, CostCentreSummary, FixedAssetSummary, LedgerAccountSummary, SessionInfo } from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000 }}>
      <h1>Fixed asset register</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {assets === null ? (
        <p>Loading…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Code</th>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Class</th>
              <th style={{ textAlign: 'left' }}>Purchase date</th>
              <th style={{ textAlign: 'right' }}>Cost (₹)</th>
              <th style={{ textAlign: 'left' }}>Status</th>
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
                  <td style={{ textAlign: 'right' }}>{asset.purchaseCost.toFixed(2)}</td>
                  <td>{asset.status}</td>
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
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Book</th>
                            <th style={{ textAlign: 'left' }}>FY</th>
                            <th style={{ textAlign: 'right' }}>Opening WDV (₹)</th>
                            <th style={{ textAlign: 'right' }}>Depreciation (₹)</th>
                            <th style={{ textAlign: 'right' }}>Closing WDV (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedule.map((entry, i) => (
                            <tr key={i}>
                              <td>{entry.book === 'SCHEDULE2' ? 'Companies Act (Schedule II)' : 'Income Tax (WDV block)'}</td>
                              <td>{entry.financialYear}</td>
                              <td style={{ textAlign: 'right' }}>{entry.openingWdv.toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>{entry.depreciationAmount.toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>{entry.closingWdv.toFixed(2)}</td>
                            </tr>
                          ))}
                          {schedule.length === 0 && (
                            <tr>
                              <td colSpan={5}>No depreciation posted yet — run depreciation for a financial year that includes this asset.</td>
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
                      <div style={{ padding: 8, border: '1px solid #ccc' }}>
                        <label>
                          Disposal date
                          <input type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} />
                        </label>{' '}
                        <label>
                          Sale proceeds (₹, 0 for a write-off)
                          <input type="number" step="0.01" value={saleProceedsRupees} onChange={(e) => setSaleProceedsRupees(e.target.value)} style={{ width: 100 }} />
                        </label>{' '}
                        {Number(saleProceedsRupees) > 0 && (
                          <label>
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
                        )}{' '}
                        <button type="button" onClick={() => handleDispose(asset.id)}>
                          Confirm disposal
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {canManage && (
        <form onSubmit={handleAcquire} style={{ marginBottom: 24 }}>
          <h2>Acquire a fixed asset</h2>
          <label>
            Asset class
            <select value={assetClassId} onChange={(e) => setAssetClassId(e.target.value)} required>
              <option value="">— select —</option>
              {assetClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>{' '}
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>{' '}
          <label>
            Asset code
            <input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} required style={{ width: 120 }} />
          </label>
          <br />
          <label>
            Purchase date
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
          </label>{' '}
          <label>
            Purchase cost (₹)
            <input type="number" step="0.01" value={purchaseCostRupees} onChange={(e) => setPurchaseCostRupees(e.target.value)} required style={{ width: 120 }} />
          </label>{' '}
          <label>
            Salvage value (₹, optional)
            <input type="number" step="0.01" value={salvageValueRupees} onChange={(e) => setSalvageValueRupees(e.target.value)} style={{ width: 100 }} />
          </label>
          <br />
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
          </label>{' '}
          <label>
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
          <br />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Acquiring…' : 'Acquire asset'}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  );
}
