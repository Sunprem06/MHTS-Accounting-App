/**
 * Rendered once, at the top of the App tree (same pattern as ThemeToggle —
 * see App.tsx), so it appears on every screen without touching each one
 * individually.
 *
 * Deliberately NOT read from brand.config.json: that file is the white-label
 * hook a reseller/customer is meant to edit (app name, logo, tagline,
 * accent color, welcome-screen quotes) — this notice asserts the underlying
 * software's actual copyright holder and must stay constant regardless of
 * how a given build is rebranded or resold, individual customer or not.
 */
const COPYRIGHT_HOLDER = 'Maanagarram Hi Tech Solutions';

export function CopyrightFooter() {
  const year = new Date().getFullYear();
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        textAlign: 'center',
        fontSize: 11,
        padding: '3px 8px',
        color: 'var(--fg-muted, var(--fg))',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        opacity: 0.85,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      © {year} All Rights Reserved by {COPYRIGHT_HOLDER}
    </div>
  );
}
