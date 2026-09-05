# CLAUDE.md — MHTS ERP Project Instructions

Read this file fully before doing anything. Then read `/docs/MHTS-ERP_Master_Blueprint.md` and `/docs/MHTS-ERP_Phase_Tracker.md` (especially the latest Session Handoff Log entry at the top of Section 4) before writing or changing any code.

## What this project is
An offline-first, white-label Indian Business Accounting + GST + Inventory + Payroll + ERP desktop application, built by Maanagarram Hi Tech Solutions (MHTSdigiXR to sell it, KoodaldigiXS to teach it). Full spec lives in the Blueprint doc. Do not reduce scope without being told to — only sequence it.

## Hard architectural rules (non-negotiable, cite the Blueprint if unsure)
1. **Business logic isolation.** Accounting, GST, Payroll, and Inventory-valuation logic lives in pure TypeScript packages under `packages/core-*`, with zero Electron or UI dependency. UI code never contains business/tax/accounting logic directly.
2. **Rules as data, not code.** GST rates, HSN/SAC mappings, cess, and payroll/statutory formulas (PF, ESI, PT, gratuity, wage classification) must be stored as versioned, date-effective rows in the database and evaluated by a shared rules-resolution service. Never hardcode a rate, slab, or formula as a constant, enum, or switch-case. (Reason: GST slabs changed materially in Sept 2025; Labour Code wage definitions changed in Nov 2025; both will change again.)
3. **Company data isolation.** Each company gets its own encrypted SQLite database file (SQLCipher). No cross-company tables, no shared rows keyed by company_id as the only isolation mechanism.
4. **Atomicity.** Every financial transaction (e.g., a sales invoice touching ledger + inventory + tax + receivable) must succeed or roll back as one unit. Never leave partial financial state.
5. **Audit trail is append-only.** No UI path, including Super Admin, may hard-delete or edit audit log records.
6. **No fake functionality.** Never stand up a UI button or screen that isn't backed by real, working logic. Never use mock/hardcoded data where the spec calls for database-backed configuration (see Blueprint/original spec Section 84 — "No Hardcoding").

## Tech stack (decided, don't re-litigate without flagging it to the user)
- Electron + React + TypeScript + Node.js
- SQLite via `better-sqlite3` + SQLCipher
- Prisma ORM for schema/migrations (unless the Phase 0 spike finds SQLCipher-compatibility issues — fallback is Kysely + custom migration runner; check the Phase Tracker's Open Questions section for the spike result before assuming either way)
- Monorepo via Nx or Turborepo, structure defined in Blueprint Section 6

## Compliance facts to keep in mind while building (not exhaustive — defer to a CA review before shipping any tax/payroll logic)
- GST (as of the reforms effective 22 Sept 2025): working slabs are broadly 5%, 18%, 40%, with 3% for gold/silver. Treat as configurable, verify current rates before hardcoding any default/seed data.
- Labour Codes (effective 21 Nov 2025): unified "wages" definition, allowances capped at 50% of total pay for statutory calculation purposes; fixed-term employees qualify for gratuity after 1 year. Central/state rules were still being finalized as of early 2026 — build the payroll formula layer fully swappable.
- Vendor-side TDS (194C/194J/194Q/194-I) is required in the Purchase/Payables module, separate from salary TDS (192).
- Section 43B(h): payments to Udyam-registered MSME vendors unpaid past 45 days are tax-disallowed — Supplier master needs an MSME flag and ageing logic tied to this.
- Fixed Assets needs two separate depreciation calculations: Companies Act Schedule II (accounting books) and Income Tax Act WDV block (tax books) — not one shared field.
- MCA audit-trail requirement applies to any company under the Companies Act — treat Rule #5 above as a legal requirement, not a nice-to-have.

## Working process for every session
1. Read this file, then the Blueprint, then the Phase Tracker's current status + latest handoff entry.
2. State which Phase you're working on and confirm scope with the user before writing code, if it's ambiguous.
3. Before ending the session, update `/docs/MHTS-ERP_Phase_Tracker.md`: the Phase Status Board, the Key Decisions Log (if any architectural calls were made), and add a new Session Handoff Log entry at the top of Section 4.

## Current phase
Check the Phase Status Board in `/docs/MHTS-ERP_Phase_Tracker.md` — it is the single source of truth for what's done and what's next.

## Git workflow (every phase)
- Never commit directly to `main`. Create a feature branch named
  `phase{N}/{short-description}` for each unit of work.
- Open a Pull Request when work is ready — do not merge it yourself; the
  user reviews and merges.
- For anything touching accounting, GST, payroll, tax, or other
  business/financial logic: propose a plan and wait for explicit user
  confirmation before writing code.
- For infrastructure/scaffolding (project setup, schema, tooling,
  non-financial UI shells): build and verify end-to-end, then summarize
  for review — no plan-approval pause needed, same as Phase 0.
- End every session by updating /docs/MHTS-ERP_Phase_Tracker.md (status
  board, decisions log if applicable, new Session Handoff Log entry)
  before the final summary.