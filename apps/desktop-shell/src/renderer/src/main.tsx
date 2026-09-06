import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import brandConfig from './brand.config.json';
import './styles.css';

// White-label hook: a reseller build only needs to edit brand.config.json and rebuild —
// no component or stylesheet change needed to re-brand the app name or accent color.
document.title = brandConfig.appName;
document.documentElement.style.setProperty('--accent', brandConfig.accentColor);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
