import { defaultAccentColor, escapeHtml, formatRupees, monthLabel, renderLetterheadBlock, wrapHtmlDocument } from './htmlUtils';
import type { DocumentLayout, PayslipTemplateData } from './types';

function renderLineRows(lines: PayslipTemplateData['lines'], type: 'EARNING' | 'DEDUCTION'): string {
  const filtered = lines.filter((l) => l.lineType === type);
  if (filtered.length === 0) {
    return `<tr><td style="color:#999;">—</td><td style="text-align:right;color:#999;">—</td></tr>`;
  }
  return filtered.map((l) => `<tr><td>${escapeHtml(l.label)}</td><td style="text-align:right;">${formatRupees(l.amount)}</td></tr>`).join('\n');
}

function renderBody(data: PayslipTemplateData, accent: string): string {
  return `
    ${renderLetterheadBlock(data.letterhead, accent)}
    <hr style="border:none;border-top:2px solid ${accent};margin:12px 0;" />
    <h2 style="margin:0 0 8px 0;font-size:16px;text-align:center;">PAYSLIP — ${escapeHtml(monthLabel(data.periodMonth, data.periodYear))}</h2>
    <table style="font-size:12px;margin-bottom:12px;">
      <tr><td><strong>Employee:</strong> ${escapeHtml(data.employeeName)} (${escapeHtml(data.employeeCode)})</td><td><strong>Designation:</strong> ${data.designation ? escapeHtml(data.designation) : '—'}</td></tr>
      <tr><td><strong>PAN:</strong> ${data.pan ? escapeHtml(data.pan) : '—'}</td><td><strong>UAN:</strong> ${data.uan ? escapeHtml(data.uan) : '—'}</td></tr>
      <tr><td><strong>Bank A/c:</strong> ${data.bankAccountNumber ? escapeHtml(data.bankAccountNumber) : '—'}</td><td><strong>IFSC:</strong> ${data.bankIfsc ? escapeHtml(data.bankIfsc) : '—'}</td></tr>
      <tr><td><strong>Paid days:</strong> ${data.paidDays}</td><td><strong>LOP days:</strong> ${data.lopDays}</td></tr>
    </table>
    <div style="display:flex;gap:16px;">
      <table style="border:1px solid #ddd;">
        <thead><tr style="background:#f2f2f2;"><th style="text-align:left;">Earnings</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>${renderLineRows(data.lines, 'EARNING')}</tbody>
        <tfoot><tr style="border-top:1px solid #333;font-weight:bold;"><td>Gross earnings</td><td style="text-align:right;">${formatRupees(data.grossEarnings)}</td></tr></tfoot>
      </table>
      <table style="border:1px solid #ddd;">
        <thead><tr style="background:#f2f2f2;"><th style="text-align:left;">Deductions</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>${renderLineRows(data.lines, 'DEDUCTION')}</tbody>
        <tfoot><tr style="border-top:1px solid #333;font-weight:bold;"><td>Total deductions</td><td style="text-align:right;">${formatRupees(data.totalDeductions)}</td></tr></tfoot>
      </table>
    </div>
    <div style="margin-top:16px;padding:10px 14px;background:${accent};color:#fff;border-radius:6px;font-size:15px;font-weight:bold;display:flex;justify-content:space-between;">
      <span>Net pay</span><span>${formatRupees(data.netPay)}</span>
    </div>`;
}

export function renderPayslipHtml(data: PayslipTemplateData, layout: DocumentLayout): string {
  const accent = data.letterhead.accentColorHex ?? defaultAccentColor();
  // MODERN vs CLASSIC differ only in accent placement for the invoice template's dense line-item table;
  // a payslip's simpler two-column layout reads the same either way, so both layouts share this body
  // (config-based rebranding still applies fully — logo/address/bank/footer/accent all still flow through).
  void layout;
  return wrapHtmlDocument(`Payslip - ${data.employeeName} - ${monthLabel(data.periodMonth, data.periodYear)}`, renderBody(data, accent));
}
