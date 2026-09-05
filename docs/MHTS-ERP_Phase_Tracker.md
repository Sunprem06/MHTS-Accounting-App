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
| 0 | Foundation | Shell, DB, auth, RBAC, audit trail, backup framework, theme, license/white-label plumbing | 🟨 In progress | | Monorepo (Nx) scaffolded; db-schema (Kysely, System+Company DB, migrations, append-only AuditLog trigger) built and verified end-to-end. Shell/auth/RBAC/backup/theme/licensing still pending. |
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

---

## 3. Open Questions / Blockers

Track anything unresolved so it surfaces automatically in the next session instead of being forgotten.

- [x] Prisma + SQLCipher compatibility spike — **done 2026-09-05, resolved: not compatible, Kysely fallback adopted** (see Key Decisions Log)
- [ ] Team allocation (internal vs. KoodaldigiXS trainees vs. hire) — pending
- [ ] White-label/reseller legal agreement — pending
- [ ] CA/compliance advisor retained on standing basis — pending

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
