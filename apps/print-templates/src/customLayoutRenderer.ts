import { escapeHtml, formatRupees, wrapHtmlDocument } from './htmlUtils';
import type { ImageTemplateElement, LineTemplateElement, TableTemplateElement, TemplateElement, TemplateElementStyle, TemplateLayoutDocument, TemplateValueFormat, TextTemplateElement } from './templateLayoutTypes';

/**
 * Resolves a dot-path (e.g. 'letterhead.companyName', or a bare 'lines' for
 * a table's rowSource) against a plain data object. Deliberately untyped
 * against any single *TemplateData interface — a TemplateLayoutDocument is
 * user-authored JSON built at design time from templateFieldCatalog.ts's
 * field list, which spans 6 structurally different data shapes, so there is
 * no single TS interface to type this interpreter against.
 */
function getFieldValue(data: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, data);
}

function formatValue(value: unknown, format: TemplateValueFormat | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (format === 'currency' && typeof value === 'number') {
    return formatRupees(value);
  }
  return escapeHtml(String(value));
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/;

/**
 * Every value here is interpolated directly into an inline style="..."
 * attribute (renderTextElement/renderTableElement below), unlike every
 * other dynamic value in this file, which goes through escapeHtml(). A
 * TemplateElementStyle is authored as JSON (print_template_layout.layout_json)
 * and only TYPE-checked, never runtime-validated, before reaching here — a
 * hand-edited or corrupted row could otherwise break out of the attribute
 * (e.g. a colorHex containing a quote). Validate each value against its own
 * known-safe shape and silently drop anything that doesn't match, rather
 * than trust the stored JSON's shape at runtime.
 */
function styleToCss(style: TemplateElementStyle | undefined): string {
  const parts: string[] = [];
  if (typeof style?.fontSizePx === 'number' && Number.isFinite(style.fontSizePx) && style.fontSizePx > 0) {
    parts.push(`font-size:${style.fontSizePx}px`);
  }
  if (style?.fontWeight === 'normal' || style?.fontWeight === 'bold') {
    parts.push(`font-weight:${style.fontWeight}`);
  }
  if (style?.align === 'left' || style?.align === 'center' || style?.align === 'right') {
    parts.push(`text-align:${style.align}`);
  }
  if (typeof style?.colorHex === 'string' && HEX_COLOR_PATTERN.test(style.colorHex)) {
    parts.push(`color:${style.colorHex}`);
  }
  return parts.length ? `${parts.join(';')};` : '';
}

function renderTextElement(el: TextTemplateElement, data: unknown): string {
  const raw = el.fieldPath !== undefined ? getFieldValue(data, el.fieldPath) : el.staticText;
  const text = formatValue(raw, el.format);
  return `<div style="position:absolute;left:${el.xMm}mm;top:${el.yMm}mm;width:${el.widthMm}mm;height:${el.heightMm}mm;overflow:hidden;${styleToCss(el.style)}">${text}</div>`;
}

function renderImageElement(el: ImageTemplateElement, data: unknown): string {
  const url = getFieldValue(data, 'letterhead.logoDataUrl');
  if (typeof url !== 'string' || url.length === 0) {
    return '';
  }
  return `<img src="${escapeHtml(url)}" style="position:absolute;left:${el.xMm}mm;top:${el.yMm}mm;width:${el.widthMm}mm;height:${el.heightMm}mm;object-fit:contain;" alt="Logo" />`;
}

function renderLineElement(el: LineTemplateElement): string {
  const color = typeof el.colorHex === 'string' && HEX_COLOR_PATTERN.test(el.colorHex) ? el.colorHex : '#333';
  return `<div style="position:absolute;left:${el.xMm}mm;top:${el.yMm}mm;width:${el.widthMm}mm;border-top:1px solid ${color};"></div>`;
}

function renderTableElement(el: TableTemplateElement, data: unknown): string {
  const rows = getFieldValue(data, el.rowSource);
  const rowArray = Array.isArray(rows) ? rows : [];
  const headerCells = el.columns.map((c) => `<th style="width:${c.widthMm}mm;text-align:${c.align ?? 'left'};border-bottom:1px solid #333;padding:2px 4px;">${escapeHtml(c.headerLabel)}</th>`).join('');
  const bodyRows = rowArray
    .map(
      (row) =>
        `<tr>${el.columns.map((c) => `<td style="text-align:${c.align ?? 'left'};border-bottom:1px solid #ddd;padding:2px 4px;">${formatValue(getFieldValue(row, c.fieldPath), c.format)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<div style="position:absolute;left:${el.xMm}mm;top:${el.yMm}mm;width:${el.widthMm}mm;height:${el.heightMm}mm;overflow:auto;${styleToCss(el.style)}">
    <table style="width:100%;border-collapse:collapse;font-size:inherit;"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
  </div>`;
}

function renderElement(el: TemplateElement, data: unknown): string {
  switch (el.type) {
    case 'text':
      return renderTextElement(el, data);
    case 'image':
      return renderImageElement(el, data);
    case 'line':
      return renderLineElement(el);
    case 'table':
      return renderTableElement(el, data);
  }
}

/** Renders a user-designed TemplateLayoutDocument against real (or preview) document data — the print path's alternative to the fixed CLASSIC/MODERN builders when a company has an active custom layout for that document family. Absolute-positioned in mm, matching the designer canvas 1:1 for true WYSIWYG. */
export function renderCustomLayoutHtml(data: unknown, layoutDoc: TemplateLayoutDocument, title: string): string {
  const elementsHtml = layoutDoc.elements.map((el) => renderElement(el, data)).join('\n');
  const body = `<div style="position:relative;width:${layoutDoc.pageSize.widthMm}mm;height:${layoutDoc.pageSize.heightMm}mm;">${elementsHtml}</div>`;
  return wrapHtmlDocument(title, body);
}
