import type { DocumentLineInput } from './types';

/** Shared by sales/purchase invoices and orders — all four document types carry the same line shape. */
export function validateDocumentLines(lines: DocumentLineInput[]): void {
  if (lines.length === 0) {
    throw new Error('A document needs at least one line');
  }
  for (const line of lines) {
    if (!line.description.trim()) {
      throw new Error('Every line needs a description');
    }
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      throw new Error('Every line needs a positive whole-paise amount');
    }
    if (line.taxAmount !== undefined && (!Number.isInteger(line.taxAmount) || line.taxAmount < 0)) {
      throw new Error('Tax amount must be a non-negative whole-paise amount');
    }
    if ((line.taxAmount ?? 0) > 0 && !line.taxLedgerId) {
      throw new Error('A tax amount needs a tax ledger to post it to');
    }
  }
}
