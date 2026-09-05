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
| 0 | Foundation | Shell, DB, auth, RBAC, audit trail, backup framework, theme, license/white-label plumbing | ⬜ Not started | | |
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
| | | | |

---

## 3. Open Questions / Blockers

Track anything unresolved so it surfaces automatically in the next session instead of being forgotten.

- [ ] Prisma + SQLCipher compatibility spike — pending
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
Date: [not yet started]
Phase: —
What was completed: Blueprint + Phase Tracker created. No code written yet.
Pending: Phase 0 kickoff — repo scaffolding, Prisma schema, RuleSet engine design.
Decisions: See Section 2.
Blockers: Team allocation, tool choice (Claude Code vs. claude.ai) — being decided.
Next step: Set up Claude Code project, scaffold repo per Blueprint Section 6.
```

---

*Keep this file and the Blueprint in Project Knowledge (claude.ai) or `/docs` in the repo (Claude Code) — every new chat/session should read both before doing anything else.*
