import { useState } from 'react';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
import type { Gstr1Result, Gstr3bResult, Gstr9Result, Gstr9cResult } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

type Tab = 'gstr1' | 'gstr3b' | 'gstr9' | 'gstr9c';

function startOfYearIso(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function currentFinancialYearGuess(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const startYear = now.getUTCMonth() + 1 >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

function toCsvValue(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((row) => row.map(toCsvValue).join(',')).join('\n');
}

/**
 * CA-facing reference data for GSTR-1/3B/9/9C — on-screen tables plus a
 * plain CSV export, NOT an attempt to match the GST portal's exact
 * upload-ready JSON schema (a deliberate scope choice — see core-sales-
 * purchase's gstReturns.ts for the full reasoning). Only invoice lines with
 * an HSN/SAC code (the GST-computed path) are reflected here.
 */
export function GstReturnsScreen({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('gstr1');
  const [fromDate, setFromDate] = useState(startOfYearIso());
  const [toDate, setToDate] = useState(todayIso());
  const [financialYear, setFinancialYear] = useState(currentFinancialYearGuess());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [gstr1, setGstr1] = useState<Gstr1Result | null>(null);
  const [gstr3b, setGstr3b] = useState<Gstr3bResult | null>(null);
  const [gstr9, setGstr9] = useState<Gstr9Result | null>(null);
  const [gstr9c, setGstr9c] = useState<Gstr9cResult | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    if (tab === 'gstr1') {
      const result = await window.mhts.getGstr1({ fromDate, toDate });
      if (result.ok && result.data) setGstr1(result.data);
      else setError(result.error ?? 'Failed to load GSTR-1 data');
    } else if (tab === 'gstr3b') {
      const result = await window.mhts.getGstr3b({ fromDate, toDate });
      if (result.ok && result.data) setGstr3b(result.data);
      else setError(result.error ?? 'Failed to load GSTR-3B data');
    } else if (tab === 'gstr9') {
      const result = await window.mhts.getGstr9({ financialYear });
      if (result.ok && result.data) setGstr9(result.data);
      else setError(result.error ?? 'Failed to load GSTR-9 data');
    } else {
      const result = await window.mhts.getGstr9c({ financialYear });
      if (result.ok && result.data) setGstr9c(result.data);
      else setError(result.error ?? 'Failed to load GSTR-9C data');
    }
    setLoading(false);
  }

  async function exportCurrentTab() {
    let csv = '';
    let fileName = '';
    if (tab === 'gstr1' && gstr1) {
      const b2bCsv = toCsv(
        ['Section', 'Invoice No', 'Invoice Date', 'Party', 'GSTIN', 'State', 'RCM', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Cess (₹)'],
        gstr1.b2bInvoices.map((r) => ['B2B', r.voucherNumber, r.invoiceDate, r.partyName, r.partyGstin, r.partyStateCode ?? '', r.isReverseCharge ? 'Y' : 'N', r.taxableAmount, r.cgstAmount, r.sgstAmount, r.igstAmount, r.cessAmount]),
      );
      const b2cCsv = toCsv(
        ['Section', 'State', 'Rate %', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Cess (₹)'],
        gstr1.b2cSummary.map((r) => ['B2C', r.stateCode ?? '', r.ratePercent, r.taxableAmount, r.cgstAmount, r.sgstAmount, r.igstAmount, r.cessAmount]),
      );
      const hsnCsv = toCsv(
        ['Section', 'HSN/SAC', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Cess (₹)'],
        gstr1.hsnSummary.map((r) => ['HSN Summary', r.hsnSacCode, r.taxableAmount, r.cgstAmount, r.sgstAmount, r.igstAmount, r.cessAmount]),
      );
      csv = `${b2bCsv}\n\n${b2cCsv}\n\n${hsnCsv}`;
      fileName = `GSTR1_${fromDate}_to_${toDate}.csv`;
    } else if (tab === 'gstr3b' && gstr3b) {
      csv = toCsv(
        ['Field', 'Value (₹)'],
        [
          ['Outward taxable value', gstr3b.outwardTaxableValue],
          ['Outward CGST', gstr3b.outwardCgst],
          ['Outward SGST', gstr3b.outwardSgst],
          ['Outward IGST', gstr3b.outwardIgst],
          ['Outward Cess', gstr3b.outwardCess],
          ['RCM inward taxable value', gstr3b.rcmInwardTaxableValue],
          ['RCM inward CGST', gstr3b.rcmInwardCgst],
          ['RCM inward SGST', gstr3b.rcmInwardSgst],
          ['RCM inward IGST', gstr3b.rcmInwardIgst],
          ['RCM inward Cess', gstr3b.rcmInwardCess],
          ['ITC eligible CGST', gstr3b.itcEligibleCgst],
          ['ITC eligible SGST', gstr3b.itcEligibleSgst],
          ['ITC eligible IGST', gstr3b.itcEligibleIgst],
          ['ITC eligible Cess', gstr3b.itcEligibleCess],
          ['ITC ineligible CGST', gstr3b.itcIneligibleCgst],
          ['ITC ineligible SGST', gstr3b.itcIneligibleSgst],
          ['ITC ineligible IGST', gstr3b.itcIneligibleIgst],
          ['ITC ineligible Cess', gstr3b.itcIneligibleCess],
          ['Net CGST payable', gstr3b.netPayable.netCgstPayable],
          ['Net SGST payable', gstr3b.netPayable.netSgstPayable],
          ['Net IGST payable', gstr3b.netPayable.netIgstPayable],
          ['Net Cess payable', gstr3b.netPayable.netCessPayable],
        ],
      );
      fileName = `GSTR3B_${fromDate}_to_${toDate}.csv`;
    } else if (tab === 'gstr9' && gstr9) {
      csv = toCsv(
        ['Field', 'Value (₹)'],
        [
          ['Financial year', gstr9.financialYear],
          ['Outward taxable value', gstr9.outwardTaxableValue],
          ['Outward CGST', gstr9.outwardCgst],
          ['Outward SGST', gstr9.outwardSgst],
          ['Outward IGST', gstr9.outwardIgst],
          ['ITC eligible CGST', gstr9.itcEligibleCgst],
          ['ITC eligible SGST', gstr9.itcEligibleSgst],
          ['ITC eligible IGST', gstr9.itcEligibleIgst],
          ['Net CGST payable', gstr9.netPayable.netCgstPayable],
          ['Net SGST payable', gstr9.netPayable.netSgstPayable],
          ['Net IGST payable', gstr9.netPayable.netIgstPayable],
        ],
      );
      fileName = `GSTR9_${gstr9.financialYear}.csv`;
    } else if (tab === 'gstr9c' && gstr9c) {
      csv = toCsv(
        ['Field', 'Value (₹)'],
        [
          ['Financial year', gstr9c.financialYear],
          ['Turnover per books', gstr9c.turnoverPerBooks],
          ['Turnover per GST returns', gstr9c.turnoverPerGstReturns],
          ['Reconciliation gap', gstr9c.turnoverReconciliationGap],
          ['Total tax declared for year', gstr9c.totalTaxDeclaredForYear],
        ],
      );
      fileName = `GSTR9C_${gstr9c.financialYear}.csv`;
    }
    if (!csv) return;
    const result = await window.mhts.exportCsv({ defaultFileName: fileName, csvContent: csv });
    if (!result.ok) setError(result.error ?? 'Failed to export CSV');
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <FileSpreadsheet size={18} style={{ color: 'var(--accent)' }} /> GST returns prep
        </h1>
      </div>

      <p style={{ color: 'var(--fg-muted)', fontSize: 13, marginTop: -8 }}>
        Reference data for manual filing or your CA — this is NOT a GSTN-portal-upload-ready file. Only invoice lines with an HSN/SAC code
        are reflected (a line still using the older manual tax-ledger entry has no rate/HSN to classify by).
      </p>

      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['gstr1', 'gstr3b', 'gstr9', 'gstr9c'] as Tab[]).map((t) => (
            <button key={t} type="button" className={tab === t ? 'btn-primary' : ''} onClick={() => setTab(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          {(tab === 'gstr1' || tab === 'gstr3b') && (
            <>
              <label className="field" style={{ maxWidth: 180 }}>
                From
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </label>
              <label className="field" style={{ maxWidth: 180 }}>
                To
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </label>
            </>
          )}
          {(tab === 'gstr9' || tab === 'gstr9c') && (
            <label className="field" style={{ maxWidth: 140 }}>
              Financial year
              <input value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} placeholder="e.g. 2025-26" />
            </label>
          )}
          <button type="button" className="btn-primary" onClick={refresh} disabled={loading} style={{ marginBottom: 12 }}>
            {loading ? 'Loading…' : 'Run'}
          </button>
          <button type="button" onClick={exportCurrentTab} style={{ marginBottom: 12 }}>
            Export CSV
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {tab === 'gstr1' && gstr1 && (
        <>
          <div className="card" style={{ overflowX: 'auto' }}>
            <h2>B2B invoices ({gstr1.b2bInvoices.length})</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Party</th>
                  <th>GSTIN</th>
                  <th>RCM</th>
                  <th className="num">Taxable (₹)</th>
                  <th className="num">Tax (₹)</th>
                </tr>
              </thead>
              <tbody>
                {gstr1.b2bInvoices.map((row) => (
                  <tr key={row.invoiceId}>
                    <td>{row.voucherNumber}</td>
                    <td>{row.invoiceDate}</td>
                    <td>{row.partyName}</td>
                    <td>{row.partyGstin}</td>
                    <td>{row.isReverseCharge ? 'Y' : ''}</td>
                    <td className="num">{row.taxableAmount.toFixed(2)}</td>
                    <td className="num">{(row.cgstAmount + row.sgstAmount + row.igstAmount + row.cessAmount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <h2>B2C summary (state + rate wise)</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th className="num">Rate %</th>
                  <th className="num">Taxable (₹)</th>
                  <th className="num">Tax (₹)</th>
                </tr>
              </thead>
              <tbody>
                {gstr1.b2cSummary.map((row, i) => (
                  <tr key={i}>
                    <td>{row.stateCode ?? '—'}</td>
                    <td className="num">{row.ratePercent}</td>
                    <td className="num">{row.taxableAmount.toFixed(2)}</td>
                    <td className="num">{(row.cgstAmount + row.sgstAmount + row.igstAmount + row.cessAmount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <h2>HSN-wise summary</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>HSN/SAC</th>
                  <th className="num">Taxable (₹)</th>
                  <th className="num">Tax (₹)</th>
                </tr>
              </thead>
              <tbody>
                {gstr1.hsnSummary.map((row) => (
                  <tr key={row.hsnSacCode}>
                    <td>{row.hsnSacCode}</td>
                    <td className="num">{row.taxableAmount.toFixed(2)}</td>
                    <td className="num">{(row.cgstAmount + row.sgstAmount + row.igstAmount + row.cessAmount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'gstr3b' && gstr3b && (
        <div className="card">
          <table className="data-table">
            <tbody>
              <tr>
                <td colSpan={2} style={{ fontWeight: 600, paddingTop: 12 }}>
                  3.1 Outward supplies
                </td>
              </tr>
              <tr>
                <td>Taxable value</td>
                <td className="num">₹{gstr3b.outwardTaxableValue.toFixed(2)}</td>
              </tr>
              <tr>
                <td>CGST / SGST / IGST / Cess</td>
                <td className="num">
                  {gstr3b.outwardCgst.toFixed(2)} / {gstr3b.outwardSgst.toFixed(2)} / {gstr3b.outwardIgst.toFixed(2)} / {gstr3b.outwardCess.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ fontWeight: 600, paddingTop: 12 }}>
                  3.1(d) Inward supplies liable to reverse charge
                </td>
              </tr>
              <tr>
                <td>Taxable value</td>
                <td className="num">₹{gstr3b.rcmInwardTaxableValue.toFixed(2)}</td>
              </tr>
              <tr>
                <td>CGST / SGST / IGST / Cess</td>
                <td className="num">
                  {gstr3b.rcmInwardCgst.toFixed(2)} / {gstr3b.rcmInwardSgst.toFixed(2)} / {gstr3b.rcmInwardIgst.toFixed(2)} / {gstr3b.rcmInwardCess.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ fontWeight: 600, paddingTop: 12 }}>
                  4. Input Tax Credit
                </td>
              </tr>
              <tr>
                <td>Eligible (CGST/SGST/IGST/Cess)</td>
                <td className="num">
                  {gstr3b.itcEligibleCgst.toFixed(2)} / {gstr3b.itcEligibleSgst.toFixed(2)} / {gstr3b.itcEligibleIgst.toFixed(2)} / {gstr3b.itcEligibleCess.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td>Ineligible / blocked (CGST/SGST/IGST/Cess)</td>
                <td className="num">
                  {gstr3b.itcIneligibleCgst.toFixed(2)} / {gstr3b.itcIneligibleSgst.toFixed(2)} / {gstr3b.itcIneligibleIgst.toFixed(2)} / {gstr3b.itcIneligibleCess.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ fontWeight: 600, paddingTop: 12 }}>
                  6.1 Net payable (after set-off; RCM paid separately in cash)
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>CGST / SGST / IGST / Cess</td>
                <td className="num">
                  {gstr3b.netPayable.netCgstPayable.toFixed(2)} / {gstr3b.netPayable.netSgstPayable.toFixed(2)} / {gstr3b.netPayable.netIgstPayable.toFixed(2)} /{' '}
                  {gstr3b.netPayable.netCessPayable.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {tab === 'gstr9' && gstr9 && (
        <>
          <div className="card">
            <p style={{ marginTop: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
              Financial year {gstr9.financialYear} ({gstr9.fromDate} to {gstr9.toDate})
            </p>
            <table className="data-table">
              <tbody>
                <tr>
                  <td colSpan={2} style={{ fontWeight: 600 }}>
                    Part II — Outward supplies for the year
                  </td>
                </tr>
                <tr>
                  <td>Taxable value</td>
                  <td className="num">₹{gstr9.outwardTaxableValue.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>CGST / SGST / IGST</td>
                  <td className="num">
                    {gstr9.outwardCgst.toFixed(2)} / {gstr9.outwardSgst.toFixed(2)} / {gstr9.outwardIgst.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ fontWeight: 600, paddingTop: 12 }}>
                    Part III — ITC for the year
                  </td>
                </tr>
                <tr>
                  <td>Eligible CGST / SGST / IGST</td>
                  <td className="num">
                    {gstr9.itcEligibleCgst.toFixed(2)} / {gstr9.itcEligibleSgst.toFixed(2)} / {gstr9.itcEligibleIgst.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ fontWeight: 600, paddingTop: 12 }}>
                    Part IV — Tax paid for the year
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Net CGST / SGST / IGST payable</td>
                  <td className="num">
                    {gstr9.netPayable.netCgstPayable.toFixed(2)} / {gstr9.netPayable.netSgstPayable.toFixed(2)} / {gstr9.netPayable.netIgstPayable.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <h2>HSN-wise summary for the year</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>HSN/SAC</th>
                  <th className="num">Taxable (₹)</th>
                </tr>
              </thead>
              <tbody>
                {gstr9.hsnSummary.map((row) => (
                  <tr key={row.hsnSacCode}>
                    <td>{row.hsnSacCode}</td>
                    <td className="num">{row.taxableAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ color: 'var(--fg-muted)', fontSize: 12, marginTop: 12, marginBottom: 0 }}>
              Part V (amendments to a prior financial year declared in a later year's returns) is not modeled — this app has no return-period
              concept separate from an invoice's own date.
            </p>
          </div>
        </>
      )}

      {tab === 'gstr9c' && gstr9c && (
        <div className="card">
          <table className="data-table">
            <tbody>
              <tr>
                <td>Turnover per audited books (P&amp;L)</td>
                <td className="num">₹{gstr9c.turnoverPerBooks.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Turnover per GST returns</td>
                <td className="num">₹{gstr9c.turnoverPerGstReturns.toFixed(2)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Reconciliation gap</td>
                <td className="num" style={{ fontWeight: 600 }}>
                  ₹{gstr9c.turnoverReconciliationGap.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td>Total tax declared for the year</td>
                <td className="num">₹{gstr9c.totalTaxDeclaredForYear.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ color: 'var(--fg-muted)', fontSize: 12, marginTop: 12, marginBottom: 0 }}>
            A positive gap is expected — it's non-GST income (e.g. interest) with no HSN/SAC that never appears in a GST return. A gap the
            other way would be worth investigating. The tax figure is informational only — this app has no independently-sourced "as per
            books" tax figure distinct from the return data itself.
          </p>
        </div>
      )}
    </div>
  );
}
