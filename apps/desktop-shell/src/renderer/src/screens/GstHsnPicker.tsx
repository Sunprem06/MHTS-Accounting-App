import { useEffect, useMemo, useRef, useState } from 'react';
import type { GstRateSummary } from '../../../shared/ipc';

interface Props {
  value: string | undefined;
  onChange: (hsnSacCode: string | undefined) => void;
}

/**
 * Category -> code picker for GST rate selection: browse the seeded starter
 * catalog by human-friendly category (Groceries, Electrical, Hardware, ...)
 * instead of typing a raw HSN/SAC code blind, with a "type it manually"
 * escape hatch for anything not in the catalog or a business's own custom
 * rate. Purely a UX layer on top of the existing GST engine — the value this
 * produces is always a real HSN/SAC code, resolved exactly the same way
 * either way (see core-gst-engine's resolveGstRate).
 */
export function GstHsnPicker({ value, onChange }: Props) {
  const [rates, setRates] = useState<GstRateSummary[] | null>(null);
  const [category, setCategory] = useState('');
  const [manualMode, setManualMode] = useState(false);
  // Tracks the last value THIS component emitted, so the sync effect below only
  // reacts to an externally-driven change (e.g. an item's own hsnSacCode auto-fill),
  // never to the user's own selection re-triggering itself.
  const lastEmitted = useRef<string | undefined>(value);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.listActiveGstRates();
      if (result.ok && result.data) setRates(result.data);
    })();
  }, []);

  const categories = useMemo(() => {
    if (!rates) return [];
    return Array.from(new Set(rates.filter((r) => r.category).map((r) => r.category as string))).sort();
  }, [rates]);

  useEffect(() => {
    if (!rates || value === lastEmitted.current) return;
    lastEmitted.current = value;
    if (!value) {
      setManualMode(false);
      return;
    }
    const match = rates.find((r) => r.hsnSacCode === value);
    if (match?.category) {
      setManualMode(false);
      setCategory(match.category);
    } else {
      setManualMode(true);
    }
    // Only re-syncs on an externally-driven value change (guarded by lastEmitted above),
    // so categories/manualMode aren't listed as deps — including them would re-run this
    // on every one of the user's own category/mode toggles, fighting their input.
  }, [rates, value]);

  useEffect(() => {
    if (rates && !category && categories.length > 0 && !manualMode) {
      setCategory(categories[0]);
    }
  }, [rates, categories, category, manualMode]);

  function emit(newValue: string) {
    const next = newValue || undefined;
    lastEmitted.current = next;
    onChange(next);
  }

  if (rates === null) {
    return <input value={value ?? ''} disabled placeholder="Loading…" style={{ width: 110 }} />;
  }

  if (manualMode || rates.length === 0) {
    return (
      <span>
        <input value={value ?? ''} onChange={(e) => emit(e.target.value)} placeholder="e.g. 1006" style={{ width: 90 }} />
        {rates.length > 0 && (
          <button type="button" onClick={() => setManualMode(false)} style={{ fontSize: 11, marginLeft: 4 }}>
            Browse catalog
          </button>
        )}
      </span>
    );
  }

  const codesInCategory = rates.filter((r) => r.category === category);

  return (
    <span>
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ fontSize: 12 }}>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>{' '}
      <select value={value ?? ''} onChange={(e) => emit(e.target.value)} style={{ fontSize: 12 }}>
        <option value="">Select…</option>
        {codesInCategory.map((r) => (
          <option key={r.hsnSacCode} value={r.hsnSacCode}>
            {r.hsnSacCode} — {r.description} ({r.ratePercent}%)
          </option>
        ))}
      </select>{' '}
      <button type="button" onClick={() => setManualMode(true)} style={{ fontSize: 11 }}>
        Type manually
      </button>
    </span>
  );
}
