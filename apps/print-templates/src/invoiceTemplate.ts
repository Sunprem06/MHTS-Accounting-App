import { defaultAccentColor, escapeHtml, formatQuantity, formatRupees, renderBankAndFooterBlock, renderLetterheadBlock, wrapHtmlDocument } from './htmlUtils';
import type { DocumentLayout, InvoiceTemplateData } from './types';

function renderLineRows(data: InvoiceTemplateData): string {
  return data.lines
    .map((line, index) => {
      const taxCell =
        line.gstRatePercent !== null
          ? `${line.gstRatePercent}%`
          : line.manualTaxAmount > 0
            ? formatRupees(line.manualTaxAmount)
            : '—';
      return `<tr>
        <td style="text-align:center;border-bottom:1px solid #ddd;">${index + 1}</td>
        <td style="border-bottom:1px solid #ddd;">${escapeHtml(line.itemName ?? line.description)}${line.itemName ? `<div style="font-size:11px;color:#666;">${escapeHtml(line.description)}</div>` : ''}</td>
        <td style="text-align:center;border-bottom:1px solid #ddd;">${line.hsnSacCode ? escapeHtml(line.hsnSacCode) : '—'}</td>
        <td style="text-align:right;border-bottom:1px solid #ddd;">${line.quantity !== null ? `${formatQuantity(line.quantity)}${line.unitSymbol ? ` ${escapeHtml(line.unitSymbol)}` : ''}` : '—'}</td>
        <td style="text-align:right;border-bottom:1px solid #ddd;">${line.rate !== null ? formatRupees(line.rate) : '—'}</td>
        <td style="text-align:right;border-bottom:1px solid #ddd;">${formatRupees(line.taxableAmount)}</td>
        <td style="text-align:center;border-bottom:1px solid #ddd;">${taxCell}</td>
      </tr>`;
    })
    .join('\n');
}

function renderTotalsRows(data: InvoiceTemplateData): string {
  const rows: string[] = [];
  const row = (label: string, amount: number) =>
    `<tr><td colspan="6" style="text-align:right;padding:2px 8px;">${label}</td><td style="text-align:right;padding:2px 8px;">${formatRupees(amount)}</td></tr>`;
  rows.push(row('Taxable amount', data.taxableAmount));
  if (data.cgstAmount > 0) rows.push(row('CGST', data.cgstAmount));
  if (data.sgstAmount > 0) rows.push(row('SGST', data.sgstAmount));
  if (data.igstAmount > 0) rows.push(row('IGST', data.igstAmount));
  if (data.cessAmount > 0) rows.push(row('Cess', data.cessAmount));
  if (data.manualTaxAmount > 0) rows.push(row('Tax', data.manualTaxAmount));
  rows.push(
    `<tr><td colspan="6" style="text-align:right;padding:6px 8px;font-weight:bold;border-top:2px solid #333;">Total</td><td style="text-align:right;padding:6px 8px;font-weight:bold;border-top:2px solid #333;">${formatRupees(data.totalAmount)}</td></tr>`,
  );
  return rows.join('\n');
}

function renderClassic(data: InvoiceTemplateData, accent: string): string {
  return `
    ${renderLetterheadBlock(data.letterhead, accent)}
    <hr style="border:none;border-top:2px solid ${accent};margin:12px 0;" />
    <div style="display:flex;justify-content:space-between;">
      <div>
        <h2 style="margin:0 0 4px 0;font-size:16px;">TAX INVOICE${data.cancelled ? ' (CANCELLED)' : ''}</h2>
        <div><strong>Bill to:</strong> ${escapeHtml(data.partyName)}</div>
        ${data.partyAddress ? `<div style="white-space:pre-line;font-size:12px;">${escapeHtml(data.partyAddress)}</div>` : ''}
        ${data.partyGstin ? `<div style="font-size:12px;">GSTIN: ${escapeHtml(data.partyGstin)}</div>` : ''}
        ${data.partyStateCode ? `<div style="font-size:12px;">State code: ${escapeHtml(data.partyStateCode)}</div>` : ''}
      </div>
      <div style="text-align:right;font-size:12px;">
        <div><strong>Invoice No:</strong> ${data.voucherNumber}</div>
        <div><strong>Date:</strong> ${escapeHtml(data.invoiceDate)}</div>
        <div><strong>FY:</strong> ${escapeHtml(data.financialYear)}</div>
        ${data.currency ? `<div><strong>Currency:</strong> ${escapeHtml(data.currency)}</div>` : ''}
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
          <th>Tax</th>
        </tr>
      </thead>
      <tbody>${renderLineRows(data)}</tbody>
      <tfoot>${renderTotalsRows(data)}</tfoot>
    </table>
    ${data.narration ? `<div style="font-size:12px;margin-top:12px;"><strong>Note:</strong> ${escapeHtml(data.narration)}</div>` : ''}
    ${renderBankAndFooterBlock(data.letterhead)}`;
}

function renderModern(data: InvoiceTemplateData, accent: string): string {
  return `
    <div style="background:${accent};color:#fff;padding:16px 20px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:22px;font-weight:bold;">${escapeHtml(data.letterhead.companyName)}</div>
        ${data.letterhead.gstin ? `<div style="font-size:12px;opacity:0.9;">GSTIN: ${escapeHtml(data.letterhead.gstin)}</div>` : ''}
      </div>
      ${data.letterhead.logoDataUrl ? `<img src="${escapeHtml(data.letterhead.logoDataUrl)}" style="max-height:56px;max-width:160px;object-fit:contain;background:#fff;padding:4px;border-radius:4px;" />` : ''}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:16px;">
      <div style="font-size:12px;color:#333;">
        ${data.letterhead.address ? `<div style="white-space:pre-line;">${escapeHtml(data.letterhead.address)}</div>` : ''}
        ${[data.letterhead.phone, data.letterhead.email].filter(Boolean).map(escapeHtml).join(' | ')}
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px;font-weight:bold;color:${accent};">INVOICE${data.cancelled ? ' — CANCELLED' : ''}</div>
        <div style="font-size:12px;">#${data.voucherNumber} &nbsp;•&nbsp; ${escapeHtml(data.invoiceDate)} &nbsp;•&nbsp; FY ${escapeHtml(data.financialYear)}</div>
      </div>
    </div>
    <div style="margin-top:16px;padding:12px;background:#f8f9fb;border-radius:6px;font-size:12px;">
      <strong>Billed to:</strong> ${escapeHtml(data.partyName)}
      ${data.partyAddress ? `<div style="white-space:pre-line;">${escapeHtml(data.partyAddress)}</div>` : ''}
      ${data.partyGstin ? `<div>GSTIN: ${escapeHtml(data.partyGstin)}</div>` : ''}
    </div>
    <table style="margin-top:16px;">
      <thead>
        <tr style="border-bottom:2px solid ${accent};">
          <th style="width:32px;">#</th>
          <th style="text-align:left;">Item / Description</th>
          <th>HSN/SAC</th>
          <th style="text-align:right;">Qty</th>
          <th style="text-align:right;">Rate</th>
          <th style="text-align:right;">Amount</th>
          <th>Tax</th>
        </tr>
      </thead>
      <tbody>${renderLineRows(data)}</tbody>
      <tfoot>${renderTotalsRows(data)}</tfoot>
    </table>
    ${data.narration ? `<div style="font-size:12px;margin-top:12px;color:#555;">${escapeHtml(data.narration)}</div>` : ''}
    ${renderBankAndFooterBlock(data.letterhead)}`;
}

export function renderSalesInvoiceHtml(data: InvoiceTemplateData, layout: DocumentLayout): string {
  const accent = data.letterhead.accentColorHex ?? defaultAccentColor();
  const body = layout === 'MODERN' ? renderModern(data, accent) : renderClassic(data, accent);
  return wrapHtmlDocument(`Invoice ${data.voucherNumber}`, body);
}
