import { defaultAccentColor, escapeHtml, formatRupees, renderBankAndFooterBlock, renderLetterheadBlock, wrapHtmlDocument } from './htmlUtils';
import type { DocumentLayout, ExpenseClaimTemplateData } from './types';

function renderLineRows(data: ExpenseClaimTemplateData): string {
  return data.lines
    .map(
      (line, index) => `<tr>
        <td style="text-align:center;border-bottom:1px solid #ddd;">${index + 1}</td>
        <td style="border-bottom:1px solid #ddd;">${escapeHtml(line.expenseLedgerName)}</td>
        <td style="border-bottom:1px solid #ddd;">
          ${escapeHtml(line.description)}
          ${line.lineNarration ? `<div style="font-size:11px;color:#666;">${escapeHtml(line.lineNarration)}</div>` : ''}
        </td>
        <td style="border-bottom:1px solid #ddd;">${escapeHtml(line.expenseDate)}</td>
        <td style="text-align:right;border-bottom:1px solid #ddd;">${formatRupees(line.amount)}</td>
      </tr>`,
    )
    .join('\n');
}

function renderBody(data: ExpenseClaimTemplateData, accent: string): string {
  return `
    ${renderLetterheadBlock(data.letterhead, accent)}
    <hr style="border:none;border-top:2px solid ${accent};margin:12px 0;" />
    <div style="display:flex;justify-content:space-between;">
      <div>
        <h2 style="margin:0 0 4px 0;font-size:16px;">EXPENSE CLAIM</h2>
        <div><strong>Employee:</strong> ${escapeHtml(data.employeeName)}</div>
        ${data.purpose ? `<div style="font-size:12px;">${escapeHtml(data.purpose)}</div>` : ''}
      </div>
      <div style="text-align:right;font-size:12px;">
        <div><strong>Claim No:</strong> ${data.claimNumber}</div>
        <div><strong>Date:</strong> ${escapeHtml(data.claimDate)}</div>
        <div><strong>FY:</strong> ${escapeHtml(data.financialYear)}</div>
        <div><strong>Status:</strong> ${escapeHtml(data.status)}</div>
      </div>
    </div>
    <table style="margin-top:16px;">
      <thead>
        <tr style="background:#f2f2f2;">
          <th style="width:32px;">#</th>
          <th style="text-align:left;">Category</th>
          <th style="text-align:left;">Description</th>
          <th style="text-align:left;">Date</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${renderLineRows(data)}</tbody>
      <tfoot>
        <tr><td colspan="4" style="text-align:right;padding:6px 8px;font-weight:bold;border-top:2px solid #333;">Total</td><td style="text-align:right;padding:6px 8px;font-weight:bold;border-top:2px solid #333;">${formatRupees(data.totalAmount)}</td></tr>
      </tfoot>
    </table>
    ${data.status === 'REJECTED' && data.rejectedReason ? `<div style="font-size:12px;margin-top:12px;color:#a33;"><strong>Rejected:</strong> ${escapeHtml(data.rejectedReason)}</div>` : ''}
    ${renderBankAndFooterBlock(data.letterhead)}`;
}

/** A plain claim-lines document — a single layout covers it either way, same precedent payslipTemplate.ts already established for its own `void layout`. */
export function renderExpenseClaimHtml(data: ExpenseClaimTemplateData, layout: DocumentLayout): string {
  void layout;
  const accent = data.letterhead.accentColorHex ?? defaultAccentColor();
  return wrapHtmlDocument(`Expense Claim ${data.claimNumber}`, renderBody(data, accent));
}
