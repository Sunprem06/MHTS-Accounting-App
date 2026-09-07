import type { LetterheadForPrint } from './types';

/** Every value plugged into a template string in this package goes through this — the data ultimately comes from user-entered fields (party names, narrations, footer notes), and this HTML is loaded directly into an Electron BrowserWindow for printing. */
export function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const RUPEE_FORMATTER = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** '₹ 1,23,456.00' — Indian digit grouping via the en-IN locale. */
export function formatRupees(amount: number): string {
  return `₹ ${RUPEE_FORMATTER.format(amount)}`;
}

const QUANTITY_FORMATTER = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });

export function formatQuantity(quantity: number): string {
  return QUANTITY_FORMATTER.format(quantity);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthLabel(periodMonth: number, periodYear: number): string {
  return `${MONTH_NAMES[periodMonth - 1] ?? periodMonth} ${periodYear}`;
}

export function defaultAccentColor(): string {
  return '#1a56db';
}

/** The letterhead block shared by every document type/layout: logo (if any), company name/address/contact, GSTIN/PAN. */
export function renderLetterheadBlock(letterhead: LetterheadForPrint, accent: string): string {
  const logo = letterhead.logoDataUrl ? `<img src="${escapeHtml(letterhead.logoDataUrl)}" alt="Logo" style="max-height:64px;max-width:180px;object-fit:contain;" />` : '';
  const contactParts = [letterhead.phone, letterhead.email, letterhead.website].filter(Boolean).map(escapeHtml);
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div>
        <h1 style="margin:0 0 4px 0;font-size:20px;color:${accent};">${escapeHtml(letterhead.companyName)}</h1>
        ${letterhead.address ? `<div style="white-space:pre-line;font-size:12px;color:#333;">${escapeHtml(letterhead.address)}</div>` : ''}
        ${contactParts.length ? `<div style="font-size:12px;color:#333;">${contactParts.join(' &nbsp;|&nbsp; ')}</div>` : ''}
        <div style="font-size:12px;color:#333;margin-top:4px;">
          ${letterhead.gstin ? `GSTIN: ${escapeHtml(letterhead.gstin)}` : ''}
          ${letterhead.gstin && letterhead.pan ? ' &nbsp;|&nbsp; ' : ''}
          ${letterhead.pan ? `PAN: ${escapeHtml(letterhead.pan)}` : ''}
        </div>
      </div>
      ${logo ? `<div>${logo}</div>` : ''}
    </div>`;
}

export function renderBankAndFooterBlock(letterhead: LetterheadForPrint): string {
  const hasBank = letterhead.bankAccountNumber || letterhead.bankAccountName;
  return `
    ${
      hasBank
        ? `<div style="font-size:11px;color:#333;margin-top:16px;">
      <strong>Bank details:</strong>
      ${letterhead.bankAccountName ? escapeHtml(letterhead.bankAccountName) : ''}
      ${letterhead.bankName ? ` — ${escapeHtml(letterhead.bankName)}` : ''}
      ${letterhead.bankBranch ? ` (${escapeHtml(letterhead.bankBranch)})` : ''}
      ${letterhead.bankAccountNumber ? `, A/c No: ${escapeHtml(letterhead.bankAccountNumber)}` : ''}
      ${letterhead.bankIfsc ? `, IFSC: ${escapeHtml(letterhead.bankIfsc)}` : ''}
    </div>`
        : ''
    }
    ${letterhead.footerNote ? `<div style="font-size:11px;color:#666;margin-top:8px;white-space:pre-line;">${escapeHtml(letterhead.footerNote)}</div>` : ''}`;
}

/** Wraps a document's own body markup in a full HTML page ready for BrowserWindow.loadURL/printToPDF — A4, print-safe margins, no external resources (everything inline, per the CSP-style constraint every other generated artifact in this app follows). */
export function wrapHtmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 6px 8px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
