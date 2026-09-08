import { describe, expect, it } from 'vitest';
import { renderCustomLayoutHtml } from './customLayoutRenderer';
import type { TemplateLayoutDocument } from './templateLayoutTypes';

/**
 * Regression test for the security follow-up review's finding: styleToCss()
 * used to interpolate layout-authored colorHex/align/fontWeight straight
 * into an inline style="..." attribute with no validation, so a corrupted
 * or maliciously crafted print_template_layout.layout_json row could break
 * out of the attribute. Every value should now be validated against its
 * known-safe shape (a strict hex pattern for colours, an enum check for the
 * rest) and silently dropped if it doesn't match — never trusted as-is.
 */
describe('apps/print-templates: customLayoutRenderer style-attribute hardening', () => {
  it('renders a valid style normally', () => {
    const doc: TemplateLayoutDocument = {
      version: 1,
      pageSize: { widthMm: 210, heightMm: 297 },
      elements: [{ id: '1', type: 'text', xMm: 10, yMm: 10, widthMm: 50, heightMm: 10, staticText: 'Hello', style: { fontSizePx: 14, fontWeight: 'bold', align: 'center', colorHex: '#1a2b3c' } }],
    };
    const html = renderCustomLayoutHtml({}, doc, 'Test');
    expect(html).toContain('font-size:14px');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('text-align:center');
    expect(html).toContain('color:#1a2b3c');
  });

  it('drops a malicious colorHex that attempts to break out of the style attribute', () => {
    const doc: TemplateLayoutDocument = {
      version: 1,
      pageSize: { widthMm: 210, heightMm: 297 },
      elements: [{ id: '1', type: 'text', xMm: 10, yMm: 10, widthMm: 50, heightMm: 10, staticText: 'Hello', style: { colorHex: '"><script>alert(1)</script>' } }],
    };
    const html = renderCustomLayoutHtml({}, doc, 'Test');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('color:"><script>');
  });

  it('drops a malicious/unexpected fontWeight or align value instead of trusting the stored JSON', () => {
    const doc: TemplateLayoutDocument = {
      version: 1,
      pageSize: { widthMm: 210, heightMm: 297 },
      elements: [
        {
          id: '1',
          type: 'text',
          xMm: 10,
          yMm: 10,
          widthMm: 50,
          heightMm: 10,
          staticText: 'Hello',
          // Cast through unknown: a corrupted DB row could hold anything at runtime even though the TS type is a literal union.
          style: { fontWeight: 'bold; } body { display:none' as unknown as 'bold', align: 'center"><b>x</b>' as unknown as 'center' },
        },
      ],
    };
    const html = renderCustomLayoutHtml({}, doc, 'Test');
    expect(html).not.toContain('display:none');
    expect(html).not.toContain('<b>x</b>');
  });

  it('a line element with a malicious colorHex falls back to the safe default color', () => {
    const doc: TemplateLayoutDocument = {
      version: 1,
      pageSize: { widthMm: 210, heightMm: 297 },
      elements: [{ id: '1', type: 'line', xMm: 0, yMm: 0, widthMm: 100, colorHex: '"><script>alert(1)</script>' }],
    };
    const html = renderCustomLayoutHtml({}, doc, 'Test');
    expect(html).not.toContain('<script>');
    expect(html).toContain('border-top:1px solid #333;');
  });

  it('a line element with a valid colorHex uses it', () => {
    const doc: TemplateLayoutDocument = {
      version: 1,
      pageSize: { widthMm: 210, heightMm: 297 },
      elements: [{ id: '1', type: 'line', xMm: 0, yMm: 0, widthMm: 100, colorHex: '#ff0000' }],
    };
    const html = renderCustomLayoutHtml({}, doc, 'Test');
    expect(html).toContain('border-top:1px solid #ff0000;');
  });

  it('still escapes ordinary text content (existing behavior, not regressed)', () => {
    const doc: TemplateLayoutDocument = {
      version: 1,
      pageSize: { widthMm: 210, heightMm: 297 },
      elements: [{ id: '1', type: 'text', xMm: 0, yMm: 0, widthMm: 100, heightMm: 10, staticText: '<script>alert(1)</script>' }],
    };
    const html = renderCustomLayoutHtml({}, doc, 'Test');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
