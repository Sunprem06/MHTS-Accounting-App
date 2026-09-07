/**
 * Phase 9 Increment 3 (Print + Templates) — the drag-and-drop template
 * designer's rendering model. A TemplateLayoutDocument is user-authored JSON
 * (built by the designer screen, persisted opaquely by
 * @mhts/core-print-templates) describing freely positioned/sized elements on
 * an A4-proportioned page, each optionally bound to a field path into that
 * document family's own *TemplateData shape (see types.ts) via
 * templateFieldCatalog.ts's static field list.
 *
 * 'TemplateFamily' mirrors @mhts/core-print-templates's own type of the same
 * name (kept as a plain string union here, not imported, so this package
 * stays dependency-free — same reasoning as this file's DocumentLayout).
 */
export type TemplateFamily = 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'ORDER' | 'VOUCHER' | 'EXPENSE_CLAIM' | 'PAYSLIP';

export interface TemplateElementStyle {
  fontSizePx?: number;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  colorHex?: string;
}

export type TemplateValueFormat = 'plain' | 'currency';

interface TemplateElementBase {
  id: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

/** Bound (fieldPath into the family's TemplateData) or static (literal staticText) — exactly one of the two is set. */
export interface TextTemplateElement extends TemplateElementBase {
  type: 'text';
  fieldPath?: string;
  staticText?: string;
  format?: TemplateValueFormat;
  style?: TemplateElementStyle;
}

/** Logo only — the letterhead's own logo, resolved via letterhead.logoDataUrl. Arbitrary uploaded images are out of scope this pass. */
export interface ImageTemplateElement extends TemplateElementBase {
  type: 'image';
  source: 'logo';
}

/** A decorative horizontal divider — heightMm is unused (rendered as a 0-height ruled line). */
export interface LineTemplateElement extends Omit<TemplateElementBase, 'heightMm'> {
  type: 'line';
  colorHex?: string;
}

export interface TemplateTableColumn {
  headerLabel: string;
  /** Relative to each ROW object (e.g. a single line-item), not to the document root. */
  fieldPath: string;
  widthMm: number;
  align?: 'left' | 'center' | 'right';
  format?: TemplateValueFormat;
}

/** A repeating region — one rendered row per entry in the array found at `rowSource` (e.g. 'lines'). */
export interface TableTemplateElement extends TemplateElementBase {
  type: 'table';
  rowSource: string;
  columns: TemplateTableColumn[];
  style?: TemplateElementStyle;
}

export type TemplateElement = TextTemplateElement | ImageTemplateElement | LineTemplateElement | TableTemplateElement;

export interface TemplateLayoutDocument {
  version: 1;
  pageSize: { widthMm: number; heightMm: number };
  elements: TemplateElement[];
}

export type TemplateFieldKind = 'text' | 'currency' | 'date' | 'image' | 'table';

export interface TemplateFieldCatalogTableColumn {
  /** Relative to each row, matching TemplateTableColumn.fieldPath's own convention. */
  path: string;
  label: string;
  kind: 'text' | 'currency';
}

export interface TemplateFieldCatalogEntry {
  path: string;
  label: string;
  kind: TemplateFieldKind;
  /** Present only when kind === 'table' — the columns available inside each repeated row. */
  columns?: TemplateFieldCatalogTableColumn[];
}
