import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import brandConfig from './brand.config.json';
import './styles.css';

// White-label hook: a reseller build only needs to edit brand.config.json and rebuild —
// no component or stylesheet change needed to re-brand the app name, accent color, logo,
// or welcome-screen quotes. A separate light/dark accent (rather than
// documentElement.style.setProperty, which is an inline style and would beat every
// stylesheet rule including the dark-mode ones) is injected as real CSS so the existing
// :root[data-theme='dark'] / prefers-color-scheme cascade in styles.css still wins correctly.
document.title = brandConfig.appName;
const brandOverrides = document.createElement('style');
const darkAccent = brandConfig.accentColorDark || brandConfig.accentColor;
brandOverrides.textContent = `
  :root { --accent: ${brandConfig.accentColor}; }
  :root[data-theme='dark'] { --accent: ${darkAccent}; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']):not([data-theme='dark']) { --accent: ${darkAccent}; }
  }
`;
document.head.appendChild(brandOverrides);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
