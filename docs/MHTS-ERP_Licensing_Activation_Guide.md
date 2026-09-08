# MHTS ERP — Online License Activation: Testing & Deployment Guide

*Written 2026-09-08 (session 30), covering the licensing/piracy-protection initiative merged this session. See the Phase Tracker's Section 4 (session 30 entries) for the full design history and Section 2's Key Decisions Log for the confirmed decisions. A beginner-friendly, click-by-click version of this guide (with copy-paste PowerShell commands) is also available as a published Claude Artifact — ask in a Claude Code session for the link, or follow the equivalent steps below.*

## What changed

Two repositories now work together:

- **This repo (`MHTS-Accounting-App`)** — the desktop app now activates online using a one-time activation code (instead of just copying a `license.lic` file, which could previously be copied to a second machine undetected). A portal-registered activation that goes more than 30 days without checking in soft-blocks the app until it reconnects — this closes the gap where a whole-folder clone left every existing company usable forever.
- **`MHTSdigiXR-Web-Accounting-App`** — gained a new `erpLicenses`/`erpLicenseActivations` module: `/api/erp-licenses/activate` and `/checkin` (machine-to-machine, authenticated by the activation code / a rotating per-machine token) and an employee-facing `ERP Licenses` admin page, restricted to `super_admin`.

The license-signing private key never touches either server — staff still sign license files offline with `scripts/generate-license.mjs`, exactly as before this change.

## Status as of this write-up

| Item | Status |
|---|---|
| Core feature (both repos) | Merged to `main` |
| 3 real bugs found by running the portal live, fixed | Merged to `main` |
| Issuance restricted to `super_admin` | Merged to `main` |
| `desktop-shell` test infrastructure (16 tests) | Merged to `main` |
| One-command local practice portal (`npm run test:local-portal`) | Merged to `main` |
| Deployed to the real `mhtsdigixr.com` server | **Not yet** — GitHub merges don't auto-deploy; confirmed by probing the live site directly |
| A real signed test license activated successfully in the desktop GUI | **Not yet** — needs the actual signing private key, which this environment intentionally never has access to |

## Testing locally (no production access needed)

From `MHTSdigiXR-Web-Accounting-App`'s root folder:

```
npm run test:local-portal
```

This starts a real (but throwaway) PostgreSQL database via the `embedded-postgres` package, applies the schema, and starts the actual server — all isolated inside `testing/.local-test-db` (git-ignored). It never touches the real database. Default login: `superadmin` / `admin123`.

Point the desktop app at it (PowerShell, from `apps/desktop-shell`):

```
$env:MHTS_LICENSE_PORTAL_URL = "http://localhost:5000/api/erp-licenses"
npm run dev
```

Create a license in the practice portal's `ERP Licenses` page using a placeholder license file (any well-formed JSON with a `payload.licenseId`), copy the one-time activation code, and use it in the desktop app's "Activate license" screen. **A placeholder license will correctly fail the signature check** — that's the desktop app's Ed25519 verification working as designed, not a bug. It proves the network/portal wiring is correct without needing the real signing key.

## Deploying for real

Two independent steps, both outside what this environment can do:

1. **Deploy the merged web app code** to the real server (`git pull` + restart on whatever process already deploys that site — no CI/CD pipeline exists for it today).
2. **Issue a real license** using `scripts/generate-license.mjs` and the actual private key, held outside this repository by whoever is authorized at MHTSdigiXR (still an open decision — see the Phase Tracker's Open Questions).

## Known limitation of this write-up

The desktop-side grace-period/activation logic is verified by 16 automated tests (against a real temporary encrypted system database, with the network layer and Ed25519 signature check mocked — the private key doesn't exist in this repo, matching `core-licensing`'s own pre-existing test file's documented constraint) and by one confirmed clean boot of the actual packaged app. A live, real-signature, click-through activation was not performed in this environment and needs either the real signing key or a deployed production portal.
