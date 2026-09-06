import { useEffect, useState } from 'react';
import type { ThemePreference } from '../../shared/ipc';

const LABELS: Record<ThemePreference, string> = { LIGHT: '☀ Light', DARK: '☾ Dark', SYSTEM: '⚙ System' };
const NEXT: Record<ThemePreference, ThemePreference> = { LIGHT: 'DARK', DARK: 'SYSTEM', SYSTEM: 'LIGHT' };

function applyTheme(theme: ThemePreference) {
  if (theme === 'SYSTEM') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme.toLowerCase());
  }
}

/** Rendered once, at the top of the App tree, so the toggle is visible on every screen without touching each one individually. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference | null>(null);

  useEffect(() => {
    (async () => {
      const result = await window.mhts.getThemePreference();
      const initial = result.ok && result.data ? result.data : 'SYSTEM';
      setTheme(initial);
      applyTheme(initial);
    })();
  }, []);

  async function cycle() {
    if (!theme) return;
    const next = NEXT[theme];
    setTheme(next);
    applyTheme(next);
    await window.mhts.setThemePreference(next);
  }

  if (!theme) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title="Switch theme"
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 1000,
        fontSize: 12,
        padding: '4px 8px',
        background: 'var(--bg-secondary)',
        color: 'var(--fg)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        cursor: 'pointer',
      }}
    >
      {LABELS[theme]}
    </button>
  );
}
