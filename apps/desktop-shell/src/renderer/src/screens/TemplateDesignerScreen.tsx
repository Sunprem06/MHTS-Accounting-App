import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ImageTemplateElement,
  LineTemplateElement,
  PrintTemplateLayoutSummary,
  SessionInfo,
  TableTemplateElement,
  TemplateElement,
  TemplateFamily,
  TemplateFieldCatalogEntry,
  TemplateLayoutDocument,
  TemplatePreviewData,
  TextTemplateElement,
} from '../../../shared/ipc';

interface Props {
  session: SessionInfo;
  onBack: () => void;
}

/** Roughly 96 CSS px per inch / 25.4mm — used only for the on-screen canvas; the print path always works in mm directly (see @mhts/print-templates's customLayoutRenderer.ts), so a slightly-off scale here never affects the printed output, only how big the canvas looks while editing. */
const MM_TO_PX = 3.78;

/** A4 (210x297mm) minus the fixed 14mm @page print margin on every side (see htmlUtils.ts's wrapHtmlDocument) — this IS the actual printable content area, so the designer canvas matches the final PDF/print pixel-for-pixel instead of only approximating it. */
const DEFAULT_PAGE = { widthMm: 182, heightMm: 269 };

const FAMILY_OPTIONS: { value: TemplateFamily; label: string }[] = [
  { value: 'SALES_INVOICE', label: 'Sales Invoice' },
  { value: 'PURCHASE_INVOICE', label: 'Purchase Invoice' },
  { value: 'ORDER', label: 'Sales / Purchase Order' },
  { value: 'VOUCHER', label: 'Journal / Payment / Receipt / Contra Voucher' },
  { value: 'EXPENSE_CLAIM', label: 'Expense Claim' },
  { value: 'PAYSLIP', label: 'Payslip' },
];

function emptyLayout(): TemplateLayoutDocument {
  return { version: 1, pageSize: { ...DEFAULT_PAGE }, elements: [] };
}

function randomElementId(): string {
  return `el_${Math.random().toString(36).slice(2, 10)}`;
}

function getFieldValue(data: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, data);
}

function formatPreviewValue(value: unknown, isCurrency: boolean): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (isCurrency && typeof value === 'number') {
    return `₹ ${value.toFixed(2)}`;
  }
  return String(value);
}

export function TemplateDesignerScreen({ session, onBack }: Props) {
  const canManage = session.permissions.includes('PRINT.MANAGE_LETTERHEAD');

  const [family, setFamily] = useState<TemplateFamily>('SALES_INVOICE');
  const [catalog, setCatalog] = useState<TemplateFieldCatalogEntry[]>([]);
  const [layout, setLayout] = useState<TemplateLayoutDocument>(emptyLayout());
  const [activeLayout, setActiveLayout] = useState<PrintTemplateLayoutSummary | null>(null);
  const [previewData, setPreviewData] = useState<TemplatePreviewData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ id: string; mode: 'move' | 'resize'; startXPx: number; startYPx: number; start: TemplateElement } | null>(null);

  const refresh = useCallback(async (f: TemplateFamily) => {
    setLoading(true);
    setError(null);
    const [catalogResult, layoutResult, previewResult] = await Promise.all([window.mhts.getTemplateFieldCatalog(f), window.mhts.getTemplateLayout(f), window.mhts.getTemplatePreviewData(f)]);
    setLoading(false);
    if (catalogResult.ok && catalogResult.data) setCatalog(catalogResult.data);
    if (previewResult.ok && previewResult.data) setPreviewData(previewResult.data);
    if (layoutResult.ok) {
      if (layoutResult.data) {
        setActiveLayout(layoutResult.data);
        setLayout(layoutResult.data.layout);
      } else {
        setActiveLayout(null);
        setLayout(emptyLayout());
      }
    } else {
      setError(layoutResult.error ?? 'Failed to load template layout');
    }
    setSelectedId(null);
  }, []);

  useEffect(() => {
    refresh(family);
  }, [family, refresh]);

  function updateElement(id: string, patch: Partial<TemplateElement>) {
    setLayout((prev) => ({ ...prev, elements: prev.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as TemplateElement) : el)) }));
  }

  function removeElement(id: string) {
    setLayout((prev) => ({ ...prev, elements: prev.elements.filter((el) => el.id !== id) }));
    setSelectedId(null);
  }

  function addFieldToCanvas(entry: TemplateFieldCatalogEntry) {
    const offset = 8 + layout.elements.length * 4;
    if (entry.kind === 'image') {
      const el: ImageTemplateElement = { id: randomElementId(), type: 'image', xMm: offset, yMm: offset, widthMm: 30, heightMm: 15, source: 'logo' };
      setLayout((prev) => ({ ...prev, elements: [...prev.elements, el] }));
      setSelectedId(el.id);
      return;
    }
    if (entry.kind === 'table') {
      const el: TableTemplateElement = {
        id: randomElementId(),
        type: 'table',
        xMm: 10,
        yMm: offset,
        widthMm: DEFAULT_PAGE.widthMm - 20,
        heightMm: 60,
        rowSource: entry.path,
        columns: (entry.columns ?? []).slice(0, 5).map((c) => ({ headerLabel: c.label, fieldPath: c.path, widthMm: (DEFAULT_PAGE.widthMm - 20) / Math.max(1, Math.min(5, entry.columns?.length ?? 1)), format: c.kind === 'currency' ? 'currency' : 'plain' })),
      };
      setLayout((prev) => ({ ...prev, elements: [...prev.elements, el] }));
      setSelectedId(el.id);
      return;
    }
    const el: TextTemplateElement = {
      id: randomElementId(),
      type: 'text',
      xMm: offset,
      yMm: offset,
      widthMm: entry.kind === 'currency' ? 30 : 50,
      heightMm: 8,
      fieldPath: entry.path,
      format: entry.kind === 'currency' ? 'currency' : 'plain',
      style: { fontSizePx: 12, fontWeight: 'normal', align: 'left' },
    };
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }

  function addStaticText() {
    const offset = 8 + layout.elements.length * 4;
    const el: TextTemplateElement = { id: randomElementId(), type: 'text', xMm: offset, yMm: offset, widthMm: 60, heightMm: 8, staticText: 'Label text', style: { fontSizePx: 12, align: 'left' } };
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }

  function addLine() {
    const offset = 8 + layout.elements.length * 4;
    const el: LineTemplateElement = { id: randomElementId(), type: 'line', xMm: 10, yMm: offset, widthMm: DEFAULT_PAGE.widthMm - 20 };
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }

  function onElementPointerDown(e: React.PointerEvent, el: TemplateElement, mode: 'move' | 'resize') {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { id: el.id, mode, startXPx: e.clientX, startYPx: e.clientY, start: el };
    setSelectedId(el.id);
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    const drag = dragState.current;
    if (!drag) return;
    const deltaXMm = (e.clientX - drag.startXPx) / MM_TO_PX;
    const deltaYMm = (e.clientY - drag.startYPx) / MM_TO_PX;
    if (drag.mode === 'move') {
      const xMm = Math.max(0, Math.round(drag.start.xMm + deltaXMm));
      const yMm = Math.max(0, Math.round(drag.start.yMm + deltaYMm));
      updateElement(drag.id, { xMm, yMm } as Partial<TemplateElement>);
    } else if (drag.start.type !== 'line') {
      const widthMm = Math.max(5, Math.round(drag.start.widthMm + deltaXMm));
      const heightMm = Math.max(5, Math.round(('heightMm' in drag.start ? drag.start.heightMm : 5) + deltaYMm));
      updateElement(drag.id, { widthMm, heightMm } as Partial<TemplateElement>);
    } else {
      const widthMm = Math.max(5, Math.round(drag.start.widthMm + deltaXMm));
      updateElement(drag.id, { widthMm } as Partial<TemplateElement>);
    }
  }

  function onCanvasPointerUp() {
    dragState.current = null;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setInfo(null);
    const result = await window.mhts.saveTemplateLayout({ documentFamily: family, name: null, layout });
    setSaving(false);
    if (result.ok) {
      setInfo('Saved. This layout now prints instead of the CLASSIC/MODERN default.');
      await refresh(family);
    } else {
      setError(result.error ?? 'Failed to save layout');
    }
  }

  async function handleRevert() {
    setSaving(true);
    setError(null);
    setInfo(null);
    const result = await window.mhts.revertTemplateLayout(family);
    setSaving(false);
    if (result.ok) {
      setInfo('Reverted — this document family now prints its CLASSIC/MODERN default again.');
      await refresh(family);
    } else {
      setError(result.error ?? 'Failed to revert layout');
    }
  }

  if (!canManage) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <p>You do not have permission to design print templates.</p>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </div>
    );
  }

  const selected = layout.elements.find((el) => el.id === selectedId) ?? null;
  const previewValues = previewData?.data;

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Template designer</h1>
      <p style={{ color: '#666', fontSize: 13 }}>
        Design exactly where each field appears on a printed document. Fields you place here are live-bound — drag to reposition, drag the bottom-right handle to resize. Values shown below are from{' '}
        {previewData?.isPlaceholder ? 'a placeholder sample (no real document of this type exists yet)' : 'your most recent real document of this type'}.
      </p>

      <label>
        Document family{' '}
        <select value={family} onChange={(e) => setFamily(e.target.value as TemplateFamily)}>
          {FAMILY_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>{' '}
      {activeLayout ? <span style={{ color: '#2a7a2a' }}>Custom layout active (v{activeLayout.version}).</span> : <span style={{ color: '#666' }}>Using the CLASSIC/MODERN default — no custom layout yet.</span>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {info && <p style={{ color: '#2a7a2a' }}>{info}</p>}
      {loading && <p>Loading…</p>}

      <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 220, flexShrink: 0 }}>
          <h3 style={{ marginTop: 0 }}>Fields</h3>
          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #ccc', padding: 4 }}>
            <button type="button" onClick={addStaticText} style={{ width: '100%', marginBottom: 4 }}>
              + Static text
            </button>
            <button type="button" onClick={addLine} style={{ width: '100%', marginBottom: 8 }}>
              + Divider line
            </button>
            {catalog.map((entry) => (
              <button key={entry.path} type="button" onClick={() => addFieldToCanvas(entry)} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 2 }}>
                + {entry.label} {entry.kind === 'table' ? '(table)' : ''}
              </button>
            ))}
          </div>

          {selected && (
            <div style={{ marginTop: 16, border: '1px solid #ccc', padding: 8 }}>
              <h3 style={{ marginTop: 0 }}>Selected element</h3>
              <p style={{ fontSize: 12, color: '#666' }}>Type: {selected.type}</p>
              <label>
                X (mm) <input type="number" value={selected.xMm} onChange={(e) => updateElement(selected.id, { xMm: Number(e.target.value) } as Partial<TemplateElement>)} style={{ width: 60 }} />
              </label>
              <br />
              <label>
                Y (mm) <input type="number" value={selected.yMm} onChange={(e) => updateElement(selected.id, { yMm: Number(e.target.value) } as Partial<TemplateElement>)} style={{ width: 60 }} />
              </label>
              <br />
              <label>
                Width (mm) <input type="number" value={selected.widthMm} onChange={(e) => updateElement(selected.id, { widthMm: Number(e.target.value) } as Partial<TemplateElement>)} style={{ width: 60 }} />
              </label>
              {selected.type !== 'line' && (
                <>
                  <br />
                  <label>
                    Height (mm)
                    <input type="number" value={selected.heightMm} onChange={(e) => updateElement(selected.id, { heightMm: Number(e.target.value) } as Partial<TemplateElement>)} style={{ width: 60 }} />
                  </label>
                </>
              )}

              {selected.type === 'text' && (
                <>
                  <hr />
                  <label>
                    Static text
                    <br />
                    <input
                      value={selected.staticText ?? ''}
                      disabled={selected.fieldPath !== undefined}
                      onChange={(e) => updateElement(selected.id, { staticText: e.target.value } as Partial<TemplateElement>)}
                      style={{ width: '100%' }}
                    />
                  </label>
                  {selected.fieldPath && <p style={{ fontSize: 11, color: '#666' }}>Bound to field: {selected.fieldPath}</p>}
                  <label>
                    Font size <input type="number" value={selected.style?.fontSizePx ?? 12} onChange={(e) => updateElement(selected.id, { style: { ...selected.style, fontSizePx: Number(e.target.value) } } as Partial<TemplateElement>)} style={{ width: 50 }} />
                  </label>
                  <br />
                  <label>
                    Bold{' '}
                    <input
                      type="checkbox"
                      checked={selected.style?.fontWeight === 'bold'}
                      onChange={(e) => updateElement(selected.id, { style: { ...selected.style, fontWeight: e.target.checked ? 'bold' : 'normal' } } as Partial<TemplateElement>)}
                    />
                  </label>
                  <br />
                  <label>
                    Align{' '}
                    <select value={selected.style?.align ?? 'left'} onChange={(e) => updateElement(selected.id, { style: { ...selected.style, align: e.target.value as 'left' | 'center' | 'right' } } as Partial<TemplateElement>)}>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                </>
              )}

              {selected.type === 'table' && (
                <>
                  <hr />
                  <p style={{ fontSize: 12 }}>Row source: {selected.rowSource}</p>
                  {selected.columns.map((col, idx) => (
                    <div key={idx} style={{ fontSize: 12, marginBottom: 4 }}>
                      {col.headerLabel} ({col.fieldPath})
                    </div>
                  ))}
                </>
              )}

              <hr />
              <button type="button" onClick={() => removeElement(selected.id)}>
                Delete element
              </button>
            </div>
          )}
        </div>

        <div>
          <div
            ref={canvasRef}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onClick={() => setSelectedId(null)}
            style={{ position: 'relative', width: layout.pageSize.widthMm * MM_TO_PX, height: layout.pageSize.heightMm * MM_TO_PX, background: '#fff', border: '1px solid #999', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
          >
            {layout.elements.map((el) => {
              const isSelected = el.id === selectedId;
              const boxStyle: React.CSSProperties = {
                position: 'absolute',
                left: el.xMm * MM_TO_PX,
                top: el.yMm * MM_TO_PX,
                width: el.widthMm * MM_TO_PX,
                height: el.type === 'line' ? 1 : el.heightMm * MM_TO_PX,
                border: isSelected ? '1px dashed #1a56db' : '1px dashed transparent',
                cursor: 'move',
                overflow: 'hidden',
              };
              const content =
                el.type === 'text' ? (
                  <div style={{ fontSize: el.style?.fontSizePx ?? 12, fontWeight: el.style?.fontWeight ?? 'normal', textAlign: el.style?.align ?? 'left', color: el.style?.colorHex, whiteSpace: 'nowrap' }}>
                    {el.fieldPath !== undefined ? formatPreviewValue(getFieldValue(previewValues, el.fieldPath), el.format === 'currency') : el.staticText}
                  </div>
                ) : el.type === 'image' ? (
                  <div style={{ fontSize: 11, color: '#999', border: '1px dashed #ccc', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Logo</div>
                ) : el.type === 'line' ? (
                  <div style={{ borderTop: `1px solid ${el.colorHex ?? '#333'}`, width: '100%' }} />
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr>
                        {el.columns.map((c, i) => (
                          <th key={i} style={{ border: '1px solid #ccc', textAlign: c.align ?? 'left' }}>
                            {c.headerLabel}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(getFieldValue(previewValues, el.rowSource)) ? (getFieldValue(previewValues, el.rowSource) as unknown[]) : []).slice(0, 4).map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          {el.columns.map((c, i) => (
                            <td key={i} style={{ border: '1px solid #eee', textAlign: c.align ?? 'left' }}>
                              {formatPreviewValue(getFieldValue(row, c.fieldPath), c.format === 'currency')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              return (
                <div key={el.id} style={boxStyle} onPointerDown={(e) => onElementPointerDown(e, el, 'move')}>
                  {content}
                  {el.type !== 'line' && (
                    <div
                      onPointerDown={(e) => onElementPointerDown(e, el, 'resize')}
                      style={{ position: 'absolute', right: 0, bottom: 0, width: 10, height: 10, background: '#1a56db', cursor: 'nwse-resize', opacity: isSelected ? 1 : 0 }}
                    />
                  )}
                  {el.type === 'line' && isSelected && (
                    <div onPointerDown={(e) => onElementPointerDown(e, el, 'resize')} style={{ position: 'absolute', right: -5, top: -5, width: 10, height: 10, background: '#1a56db', cursor: 'ew-resize' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p style={{ marginTop: 16 }}>
        <button type="button" disabled={saving} onClick={handleSave}>
          {saving ? 'Working…' : 'Save as new version'}
        </button>{' '}
        {activeLayout && (
          <button type="button" disabled={saving} onClick={handleRevert}>
            Revert to CLASSIC/MODERN default
          </button>
        )}{' '}
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
