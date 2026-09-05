# MHTS ERP — Phase Tracker & Continuity Log
**Companion to:** MHTS-ERP_Master_Blueprint.md
**Purpose:** Carry this doc into every new chat/session so nothing gets re-explained or lost. Keep both files in Project Knowledge (if using claude.ai) or in `/docs` at the repo root (if using Claude Code).

---

## How to Resume in a New Chat

At the start of any new session, paste this:

> "We're building the MHTS ERP per `MHTS-ERP_Master_Blueprint.md`. Currently on **Phase [N]**. See the Session Handoff Log below for exact status. Continue from there."

Then paste the latest entry from the **Session Handoff Log** (Section 4 of this doc). That's the entire re-onboarding — nothing else needs to be retyped.

---

## 1. Phase Status Board

| # | Phase | Scope | Status | Owner | Notes |
|---|---|---|---|---|---|
| 0 | Foundation | Shell, DB, auth, RBAC, audit trail, backup framework, theme, license/white-label plumbing | 🟨 In progress | | Electron+React shell scaffolded with a real IPC boundary; multi-company creation, login, and RBAC permission resolution built and verified end-to-end against real encrypted files. Backup framework, theme engine, and license/white-label plumbing still pending. |
| 1 | Accounting Core | Chart of accounts, ledgers, vouchers, double-entry, TB/P&L/BS | ⬜ Not started | | |
| 2 | Sales + Purchase | Customers, suppliers, invoices, receivables/payables, vendor TDS, 43B(h) flag | ⬜ Not started | | |
| 3 | Inventory | Items, units, warehouses, batches, valuation | ⬜ Not started | | |
| 4 | GST Engine | Rules engine, HSN/SAC, ITC, GSTR-1/3B/9/9C prep | ⬜ Not started | | ⚠️ Re-verify current GST slab rules before starting |
| 5 | Banking | Accounts, reconciliation, cheque/UTR | ⬜ Not started | | |
| 6 | Expenses/Travel/Documents | Claims, reimbursements, attachments | ⬜ Not started | | |
| 7 | Payroll | CTC, salary rules engine, attendance, leave, statutory, payslips | ⬜ Not started | | ⚠️ Re-verify Labour Code final rules before starting |
| 8 | Advanced ERP | Fixed assets (dual depreciation), cost centres, budgets, manufacturing, multi-currency, multi-branch | ⬜ Not started | | |
| 9 | Print + Templates | Print Centre, native printing, PDF, template designer | ⬜ Not started | | |
| 10 | Commercialization | Installer, updates, demo mode, setup wizard | ⬜ Not started | | |
| 11 | UAT & Compliance Sign-off | Full acceptance test, CA sign-off, security pass | ⬜ Not started | | |

**Status legend:** ⬜ Not started · 🟨 In progress · ✅ Done · 🔴 Blocked

*(Update this table at the end of every session — it's the single source of truth for "where are we.")*

---

## 2. Key Decisions Log

Record every architectural or business decision here the moment it's made, so it never needs re-litigating in a future chat.

| Date | Decision | Reasoning | Phase |
|---|---|---|---|
| — | Stack: Electron + React + TypeScript + Node.js | Reuses team's existing skillset; business logic isolated in pure-TS packages for future portability | 0 |
| — | DB: SQLite (better-sqlite3) + SQLCipher, one file per company | Hard tenant isolation, ACID, offline-first | 0 |
| — | GST & Payroll rules as versioned DB tables, not hardcoded | GST slabs changed Sept 2025; Labour Code wage definition changed Nov 2025 — both will change again | 0, 4, 7 |
| 2026-09-05 | ORM: **Kysely** (not Prisma) + `better-sqlite3-multiple-ciphers` + Kysely's built-in `Migrator` | Phase 0 spike confirmed `@prisma/adapter-better-sqlite3` hardcodes plain `better-sqlite3` internally with no hook to apply a SQLCipher `PRAGMA key` before its first query — can't open an encrypted file. Verified true for both the legacy engine and the current driver-adapter model. Kysely's `SqliteDialect` accepts an already-keyed connection directly; confirmed working end-to-end (migrations, inserts, encryption-at-rest all verified against real files). | 0 |
| 2026-09-05 | Monorepo tool: **Nx** (not Turborepo) | `@nx/enforce-module-boundaries` turns Rule #1 (core-* has zero Electron/UI dependency) into a lint failure via project tags (`type:core`/`type:db`/`type:shared`/`type:app`), not just convention — verified by deliberately violating the boundary and confirming `nx lint` blocks it. Fits the dual commercial/curriculum use case where trainees get assigned isolated core-* packages. | 0 |
| 2026-09-05 | DB architecture: two-tier **System DB** + one **Company DB** per company | Rule #3 (per-company encrypted file, no cross-company tables) taken literally would force duplicating Users/Roles/RuleSet into every company file. Instead: System DB (single, app-level) holds Company registry, AppUser logins, CompanyAccess grants, and the shared RuleSet table (reference data, not business data — doesn't violate isolation). Company DB (per company) holds company-scoped Role/Permission and that company's own append-only AuditLog. | 0 |
| 2026-09-05 | AuditLog is hash-chained (`prev_hash`/`hash` columns) + has DB-level triggers blocking UPDATE/DELETE | Rule #5 says "no UI path may hard-delete or edit" — the DB trigger makes this true even for a raw-SQL slip or future admin tool, not just documented UI behavior. Hash chain gives tamper-evidence (detects modification, not just deletion) for the MCA audit-trail requirement. Verified: both UPDATE and DELETE against audit_log correctly raise and abort. | 0 |
| 2026-09-05 | Key management resolved: System DB key via Electron `safeStorage` (OS keychain — DPAPI/Keychain/libsecret); each Company DB's random DEK is AES-256-GCM-wrapped per user under a scrypt-derived KEK from that user's login password, stored in a new `packages/db-schema` migration (`002_company_access_key_wrap`) on `company_access`. Lives in new pure-TS package `@mhts/core-identity` (password hashing, key-wrap, RBAC permission resolution) — zero Electron dependency, so it's independently testable/curriculum-assignable like the other `core-*` packages. `connection.ts` extended to accept a raw key (`rawKey: Buffer`) alongside the old passphrase mode. | Resolves the TODO explicitly left in `connection.ts` after the Phase 0 Prisma/SQLCipher spike ("do not wire a plaintext key into product code without this decision made first"). A user can only unwrap a company's DEK — and therefore open that Company DB — by supplying the correct password; the DEK never touches disk in the clear. Verified end-to-end (see latest Session Handoff entry): correct password unwraps the exact original DEK, wrong password fails closed via GCM auth-tag mismatch. | 0 |
| 2026-09-05 | Electron pinned to **44.x** (not the originally-scaffolded 33.x); `@mhts/*` workspace packages and `kysely` must be bundled (esbuild `exclude` in `externalizeDepsPlugin`) rather than left as externalized `require()` calls; `better-sqlite3-multiple-ciphers` must stay external and listed directly in `desktop-shell/package.json`. | Found via real end-to-end verification, not by inspection: (1) `better-sqlite3-multiple-ciphers@13.0.3` declares `engines.node >=22`; Electron 33 bundles Node ~20, and instantiating the native `Database` inside that Electron process hung/deadlocked (not a catchable JS error) — Electron 44 bundles Node ≥24 and it works cleanly. (2) `@mhts/*` packages ship raw TypeScript as `main` and `kysely` is ESM-only; externalizing them produced a `require()` a plain Electron process can't resolve (`ERR_REQUIRE_ESM`) or that points at unbuildable `.ts` source — bundling them with esbuild (electron-vite's default pipeline) resolves both. (3) `better-sqlite3-multiple-ciphers` is *not* a direct dependency of `desktop-shell` (only of `db-schema`), so `externalizeDepsPlugin` never saw it to auto-externalize once (1)/(2) were fixed — esbuild tried to bundle the native addon's JS wrapper, breaking its relative path to the compiled `.node` binary. Also: `better-sqlite3` cannot bind raw JS `boolean` values — insert/where values for `is_active`/`is_system_role` must be `1`/`0`, not `true`/`false`, even though the Kysely `ColumnType`'s declared Select type is `boolean` (SQLite has no boolean type and this driver/setup does no runtime coercion). | 0 |

---

## 3. Open Questions / Blockers

Track anything unresolved so it surfaces automatically in the next session instead of being forgotten.

- [x] Prisma + SQLCipher compatibility spike — **done 2026-09-05, resolved: not compatible, Kysely fallback adopted** (see Key Decisions Log)
- [x] System/Company DB key management — **done 2026-09-05, resolved: safeStorage + per-user AES-256-GCM key wrap** (see Key Decisions Log)
- [ ] Team allocation (internal vs. KoodaldigiXS trainees vs. hire) — pending
- [ ] White-label/reseller legal agreement — pending
- [ ] CA/compliance advisor retained on standing basis — pending
- [ ] `safeStorage.isEncryptionAvailable()` was only exercised on this Windows dev machine (DPAPI). Linux without a keyring daemon (headless/CI, some minimal desktop environments) will make it return false, and the shell currently just refuses to start rather than offering a fallback — revisit before targeting Linux.
- [ ] No password-reset / re-issue-access flow exists yet for a user who forgets their password: since the Company DEK is wrapped under a KEK derived from that exact password, a straightforward password reset would orphan that user's wrapped DEK. Needs a real design (e.g. an Admin-initiated re-grant that re-wraps the DEK under the new password) before Phase 0 is "done," not before this pass.

---

## 4. Session Handoff Log

*Add a new entry at the top after every working session. This is what you paste into the next chat.*

### Entry template:
```
Date:
Phase worked on:
What was completed:
What's still pending in this phase:
Any decisions made (also add to Section 2):
Any blockers (also add to Section 3):
Next concrete step:
```

### Entries:
```
Date: 2026-09-05 (session 2)
Phase: 0 — Foundation
What was completed:
  - Scaffolded the Electron + React desktop-shell app for real (electron-vite +
    React + TS): src/main (bootstrap, System DB open/migrate, IPC handlers),
    src/preload (contextBridge — renderer never touches Node/DB/keys directly),
    src/renderer (Company list -> Create Company -> Login -> Dashboard screens),
    src/shared (the only types crossing the IPC boundary). nx build/lint wired
    for the app (electron-vite under an nx:run-commands target).
  - New pure-TS package @mhts/core-identity (type:core, zero Electron deps):
    scrypt password hashing, AES-256-GCM per-user Company-DEK key wrapping,
    and RBAC permission resolution + a Phase-0 permission seed list. Resolves
    the key-management TODO left in db-schema/connection.ts by the Phase 0
    spike: System DB is keyed via Electron's OS-keychain-backed safeStorage;
    each Company DB's random DEK is wrapped per-user under a password-derived
    key and only unwrapped after a correct login (never stored in the clear).
  - db-schema: migration 002 adds the wrapped-DEK columns to company_access;
    connection.ts now accepts a raw key (Buffer) alongside the old passphrase
    mode, using SQLCipher's `key = x'...'` raw-key pragma form.
  - Built a real multi-company creation + login + RBAC flow end-to-end:
    createCompany generates a company DB file, migrates it, seeds an Admin
    role with a Phase-0 permission set, creates the admin AppUser, and wraps
    the DEK for them; login verifies the password, unwraps the DEK, reopens
    the Company DB, and resolves permissions — the Dashboard screen shows the
    real resolved role/permissions, not placeholder UI (Rule #6).
  - Verified end-to-end with a throwaway script (bundled with esbuild the same
    way electron-vite bundles main, run inside a real Electron process — not
    committed, same precedent as the Phase 0 Prisma spike): System DB
    encrypted at rest via safeStorage-backed key; Company DB created + Admin
    role seeded; wrong password rejected by both password-hash check AND
    GCM-auth-tag-verified DEK unwrap; correct password unwraps the exact
    original DEK and reopens the real Company DB; audit_log append-only
    trigger still enforced through this real path.
  - Two real bugs surfaced and fixed only by that end-to-end run (neither
    was visible from code review or `tsc`/lint alone — logged in Key
    Decisions Log with full detail): (1) Electron 33 (Node ~20 embedded)
    hangs/deadlocks instantiating better-sqlite3-multiple-ciphers, which
    requires Node >=22 — upgraded to Electron 44. (2) better-sqlite3 cannot
    bind raw JS booleans — is_active/is_system_role inserts and WHERE
    clauses must use 1/0. Also had to stop externalizeDepsPlugin from
    externalizing @mhts/* (ships raw TS as `main`) and kysely (ESM-only),
    while explicitly keeping the native better-sqlite3-multiple-ciphers
    addon external (it isn't a direct desktop-shell dependency, so it had to
    be added to desktop-shell/package.json to be recognized as such).
  - GUI itself was not visually clicked through — this sandboxed environment
    has no interactive Windows desktop session for Electron's renderer/
    window to be driven visually. Everything above was verified by exercising
    the exact same handler logic (main-process functions) against real
    encrypted files inside a real Electron process, which is what actually
    caught the two bugs above; a first real click-through on a normal
    developer machine is still worth doing before calling Phase 0 UI done.
What's still pending in this phase: backup framework, theme engine, license/
  white-label plumbing. Also, within what was touched this session: a
  password-reset / access-re-grant flow (see Open Questions — resetting a
  password today would orphan that user's wrapped Company DEK), and
  safeStorage's Linux-without-keyring fallback behavior is unverified.
Any decisions made (also add to Section 2): key management (safeStorage +
  per-user AES-256-GCM DEK wrap); Electron pinned to 44.x; @mhts/* + kysely
  bundled instead of externalized; better-sqlite3 boolean-binding gotcha.
  All logged above with full reasoning.
Any blockers (also add to Section 3): Team allocation, white-label/reseller
  legal agreement, CA/compliance advisor retention — all still pending,
  unchanged. Two new non-blocking open questions added (Linux safeStorage
  fallback, password-reset flow) — see Section 3.
Next concrete step: Either (a) do a real visual click-through of the shell on
  a normal dev machine (create a company, log in, confirm the Dashboard
  shows real permissions, sign out, log back in) before treating Phase 0's
  shell as done, or (b) continue Foundation scope — backup framework, theme
  engine, license/white-label plumbing — and fold the click-through into
  whichever of those needs the shell running anyway. Recommend (a) first
  since it's cheap and this is the first time the shell has existed.
```

```
Date: 2026-09-05
Phase: 0 — Foundation
What was completed:
  - Ran the Prisma + SQLCipher compatibility spike (real throwaway test, not committed):
    confirmed better-sqlite3-multiple-ciphers gives real SQLCipher-compatible encryption
    at rest, but @prisma/adapter-better-sqlite3 hardcodes require('better-sqlite3') with
    no hook to apply PRAGMA key before its first query — Prisma cannot open an encrypted
    file. Kysely's SqliteDialect, given an already-keyed connection, works cleanly.
  - Scaffolded the Nx monorepo per Blueprint Section 6: packages/{core-accounting,
    core-gst-engine, core-payroll-engine, core-inventory, core-rules-engine, db-schema,
    shared-types}, apps/{desktop-shell, print-templates}. Module boundaries enforced via
    @nx/enforce-module-boundaries (type:core cannot depend on type:app) — verified by
    deliberately violating it and confirming `nx lint` blocks the build, then reverted.
  - Built packages/db-schema: Kysely schema + migrations for both the System DB
    (Company, AppUser, CompanyAccess, RuleSet) and a per-company Company DB (Role,
    Permission, RolePermission, AuditLog). AuditLog is append-only, enforced by SQLite
    triggers (BEFORE UPDATE/DELETE RAISE ABORT) plus a prev_hash/hash tamper-evidence
    chain. Verified end-to-end against real encrypted files: migrations run, inserts
    work, UPDATE/DELETE on audit_log correctly blocked, file bytes confirmed encrypted.
  - core-* packages and apps/desktop-shell are placeholder stubs only (no business logic
    or Electron scaffold yet) — that's deliberately out of scope for this pass.
What's still pending in this phase: Electron/React shell itself, auth, RBAC enforcement
  (schema exists, service layer doesn't), backup framework, theme engine, license/
  white-label plumbing, core-rules-engine's actual RuleSet resolution logic.
Any decisions made (also add to Section 2): Kysely over Prisma; Nx over Turborepo;
  two-tier System DB / Company DB split; AuditLog hash-chained + trigger-enforced
  append-only. All four logged above with reasoning.
Any blockers (also add to Section 3): Team allocation, white-label/reseller legal
  agreement, CA/compliance advisor retention — all still pending, unchanged.
Next concrete step: Scaffold the Electron + React desktop-shell app itself (window,
  IPC boundary, first screen: multi-company creation flow using db-schema's
  openSystemDb/migrateSystemDb), then wire basic auth + RBAC enforcement against the
  Role/Permission tables already in company DB schema.
```

---

*Keep this file and the Blueprint in Project Knowledge (claude.ai) or `/docs` in the repo (Claude Code) — every new chat/session should read both before doing anything else.*
