import { defaultAccentColor, escapeHtml, formatRupees, renderBankAndFooterBlock, renderLetterheadBlock, wrapHtmlDocument } from './htmlUtils';
import type { DocumentLayout, VoucherTemplateData } from './types';

const TITLE_BY_TYPE: Record<VoucherTemplateData['voucherType'], string> = {
  JOURNAL: 'JOURNAL VOUCHER',
  PAYMENT: 'PAYMENT VOUCHER',
  RECEIPT: 'RECEIPT VOUCHER',
  CONTRA: 'CONTRA VOUCHER',
};

function renderLineRows(data: VoucherTemplateData): string {
  return data.lines
    .map((line, index) => {
      const dimensions = [line.costCentreName, line.branchName].filter(Boolean).join(' / ');
      return `<tr>
        <td style="text-align:center;border-bottom:1px solid #ddd;">${index + 1}</td>
        <td style="border-bottom:1px solid #ddd;">
          ${escapeHtml(line.ledgerName)}
          ${line.lineNarration ? `<div style="font-size:11px;color:#666;">${escapeHtml(line.lineNarration)}</div>` : ''}
          ${dimensions ? `<div style="font-size:11px;color:#666;">${escapeHtml(dimensions)}</div>` : ''}
        </td>
        <td style="text-align:right;border-bottom:1px solid #ddd;">${line.debitAmount > 0 ? formatRupees(line.debitAmount) : ''}</td>
        <td style="text-align:right;border-bottom:1px solid #ddd;">${line.creditAmount > 0 ? formatRupees(line.creditAmount) : ''}</td>
      </tr>`;
    })
    .join('\n');
}

function renderBody(data: VoucherTemplateData, accent: string): string {
  return `
    ${renderLetterheadBlock(data.letterhead, accent)}
    <hr style="border:none;border-top:2px solid ${accent};margin:12px 0;" />
    <div style="display:flex;justify-content:space-between;">
      <h2 style="margin:0 0 4px 0;font-size:16px;">${TITLE_BY_TYPE[data.voucherType]}${data.cancelled ? ' (CANCELLED)' : ''}</h2>
      <div style="text-align:right;font-size:12px;">
        <div><strong>Voucher No:</strong> ${data.voucherNumber}</div>
        <div><strong>Date:</strong> ${escapeHtml(data.voucherDate)}</div>
        <div><strong>FY:</strong> ${escapeHtml(data.financialYear)}</div>
      </div>
    </div>
    <table style="margin-top:16px;">
      <thead>
        <tr style="background:#f2f2f2;">
          <th style="width:32px;">#</th>
          <th style="text-align:left;">Ledger / Narration</th>
          <th style="text-align:right;">Debit</th>
          <th style="text-align:right;">Credit</th>
        </tr>
      </thead>
      <tbody>${renderLineRows(data)}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="text-align:right;padding:6px 8px;font-weight:bold;border-top:2px solid #333;">Total</td>
          <td style="text-align:right;padding:6px 8px;font-weight:bold;border-top:2px solid #333;">${formatRupees(data.totalAmount)}</td>
          <td style="text-align:right;padding:6px 8px;font-weight:bold;border-top:2px solid #333;">${formatRupees(data.totalAmount)}</td>
        </tr>
      </tfoot>
    </table>
    ${data.narration ? `<div style="font-size:12px;margin-top:12px;"><strong>Narration:</strong> ${escapeHtml(data.narration)}</div>` : ''}
    ${renderBankAndFooterBlock(data.letterhead)}`;
}

/** A plain Dr/Cr ledger-line document — a single layout covers Journal/Payment/Receipt/Contra either way, same precedent payslipTemplate.ts already established for its own `void layout`. */
export function renderVoucherHtml(data: VoucherTemplateData, layout: DocumentLayout): string {
  void layout;
  const accent = data.letterhead.accentColorHex ?? defaultAccentColor();
  return wrapHtmlDocument(`${TITLE_BY_TYPE[data.voucherType]} ${data.voucherNumber}`, renderBody(data, accent));
}
