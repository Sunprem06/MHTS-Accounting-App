import { defaultAccentColor, escapeHtml, formatQuantity, formatRupees, renderBankAndFooterBlock, renderLetterheadBlock, wrapHtmlDocument } from './htmlUtils';
import type { DocumentLayout, OrderTemplateData } from './types';

const TITLE_BY_KIND: Record<OrderTemplateData['kind'], string> = { SALES_ORDER: 'SALES ORDER', PURCHASE_ORDER: 'PURCHASE ORDER' };
const PARTY_LABEL_BY_KIND: Record<OrderTemplateData['kind'], string> = { SALES_ORDER: 'Customer', PURCHASE_ORDER: 'Supplier' };

function renderLineRows(data: OrderTemplateData): string {
  return data.lines
    .map(
      (line, index) => `<tr>
        <td style="text-align:center;border-bottom:1px solid #ddd;">${index + 1}</td>
        <td style="border-bottom:1px solid #ddd;">${escapeHtml(line.itemName ?? line.description)}${line.itemName ? `<div style="font-size:11px;color:#666;">${escapeHtml(line.description)}</div>` : ''}</td>
        <td style="text-align:center;border-bottom:1px solid #ddd;">${line.hsnSacCode ? escapeHtml(line.hsnSacCode) : '—'}</td>
        <td style="text-align:right;border-bottom:1px solid #ddd;">${line.quantity !== null ? `${formatQuantity(line.quantity)}${line.unitSymbol ? ` ${escapeHtml(line.unitSymbol)}` : ''}` : '—'}</td>
        <td style="text-align:right;border-bottom:1px solid #ddd;">${line.rate !== null ? formatRupees(line.rate) : '—'}</td>
        <td style="text-align:right;border-bottom:1px solid #ddd;">${formatRupees(line.amount)}</td>
        <td style="text-align:right;border-bottom:1px solid #ddd;">${line.taxAmount > 0 ? formatRupees(line.taxAmount) : '—'}</td>
      </tr>`,
    )
    .join('\n');
}

function renderBody(data: OrderTemplateData, accent: string): string {
  return `
    ${renderLetterheadBlock(data.letterhead, accent)}
    <hr style="border:none;border-top:2px solid ${accent};margin:12px 0;" />
    <div style="display:flex;justify-content:space-between;">
      <div>
        <h2 style="margin:0 0 4px 0;font-size:16px;">${TITLE_BY_KIND[data.kind]}</h2>
        <div><strong>${PARTY_LABEL_BY_KIND[data.kind]}:</strong> ${escapeHtml(data.partyName)}</div>
        ${data.partyAddress ? `<div style="white-space:pre-line;font-size:12px;">${escapeHtml(data.partyAddress)}</div>` : ''}
        ${data.partyGstin ? `<div style="font-size:12px;">GSTIN: ${escapeHtml(data.partyGstin)}</div>` : ''}
        ${data.partyStateCode ? `<div style="font-size:12px;">State code: ${escapeHtml(data.partyStateCode)}</div>` : ''}
      </div>
      <div style="text-align:right;font-size:12px;">
        <div><strong>Order No:</strong> ${data.orderNumber}</div>
        <div><strong>Date:</strong> ${escapeHtml(data.orderDate)}</div>
        <div><strong>FY:</strong> ${escapeHtml(data.financialYear)}</div>
        <div><strong>Status:</strong> ${escapeHtml(data.status)}</div>
      </div>
    </div>
    <table style="margin-top:16px;">
      <thead>
        <tr style="background:#f2f2f2;">
          <th style="width:32px;">#</th>
          <th style="text-align:left;">Item / Description</th>
          <th>HSN/SAC</th>
          <th style="text-align:right;">Qty</th>
          <th style="text-align:right;">Rate</th>
          <th style="text-align:right;">Amount</th>
          <th style="text-align:right;">Tax</th>
        </tr>
      </thead>
      <tbody>${renderLineRows(data)}</tbody>
      <tfoot>
        <tr><td colspan="5" style="text-align:right;padding:2px 8px;">Taxable amount</td><td colspan="2" style="text-align:right;padding:2px 8px;">${formatRupees(data.taxableAmount)}</td></tr>
        ${data.taxAmount > 0 ? `<tr><td colspan="5" style="text-align:right;padding:2px 8px;">Tax</td><td colspan="2" style="text-align:right;padding:2px 8px;">${formatRupees(data.taxAmount)}</td></tr>` : ''}
        <tr><td colspan="5" style="text-align:right;padding:6px 8px;font-weight:bold;border-top:2px solid #333;">Total</td><td colspan="2" style="text-align:right;padding:6px 8px;font-weight:bold;border-top:2px solid #333;">${formatRupees(data.totalAmount)}</td></tr>
      </tfoot>
    </table>
    ${data.narration ? `<div style="font-size:12px;margin-top:12px;"><strong>Note:</strong> ${escapeHtml(data.narration)}</div>` : ''}
    ${data.convertedToInvoiceId ? `<div style="font-size:12px;margin-top:8px;color:#666;">This order has been converted to an invoice.</div>` : ''}
    ${renderBankAndFooterBlock(data.letterhead)}`;
}

/**
 * A Sales/Purchase Order is a pre-transaction document (quotation/PO), not
 * yet a voucher — a simpler single-layout rendering covers it either way,
 * same precedent payslipTemplate.ts already established for its own
 * `void layout` in Increment 1.
 */
export function renderOrderHtml(data: OrderTemplateData, layout: DocumentLayout): string {
  void layout;
  const accent = data.letterhead.accentColorHex ?? defaultAccentColor();
  return wrapHtmlDocument(`${TITLE_BY_KIND[data.kind]} ${data.orderNumber}`, renderBody(data, accent));
}
