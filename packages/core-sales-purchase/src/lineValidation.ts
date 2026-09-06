import type { DocumentLineInput } from './types';

/** A line's amount vs. its own quantity*rate can legitimately differ by a paisa or two on an ordinary fractional-quantity line (e.g. 0.333 units at Rs 1.50 = Rs 49.95, not a whole paisa) — checked with a small tolerance, never exact equality. */
const AMOUNT_TOLERANCE_PAISE = 1;

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
    if (line.hsnSacCode !== undefined && line.hsnSacCode.trim() && ((line.taxAmount ?? 0) > 0 || line.taxLedgerId)) {
      throw new Error('A line cannot have both a manual tax amount/ledger and an HSN/SAC code — pick one');
    }

    const itemFields = [line.itemId, line.warehouseId, line.quantityThousandths, line.ratePaise];
    const itemFieldsPresent = itemFields.filter((f) => f !== undefined).length;
    if (itemFieldsPresent > 0 && itemFieldsPresent < itemFields.length) {
      throw new Error('itemId, warehouseId, quantityThousandths and ratePaise must all be set together, or not at all');
    }
    if (line.itemId !== undefined) {
      if (!Number.isInteger(line.quantityThousandths) || line.quantityThousandths! <= 0) {
        throw new Error('Quantity must be a positive whole number of thousandths of a unit');
      }
      if (!Number.isInteger(line.ratePaise) || line.ratePaise! < 0) {
        throw new Error('Rate must be a non-negative whole-paise amount');
      }
      const expectedAmount = Math.round((line.quantityThousandths! * line.ratePaise!) / 1000);
      if (Math.abs(expectedAmount - line.amount) > AMOUNT_TOLERANCE_PAISE) {
        throw new Error(`Line amount (${line.amount}) does not match quantity * rate (${expectedAmount})`);
      }
    }
  }
}
