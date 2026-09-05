# MHTS ERP — Master Technical & Delivery Blueprint
**Prepared for:** Maanagarram Hi Tech Solutions — MHTSdigiXR (build & sell) × KoodaldigiXS (build & teach)
**Status:** Pre-Phase 0 — architecture & sequencing decisions
**Scope:** Full spec (all 94 sections of the Master Build Prompt) — sequenced, not reduced

---

## 1. Executive Summary

You're building a commercial-grade, offline-first, white-label Indian Business ERP — full parity ambition with TallyPrime-class software plus payroll and DMS layered in. The full spec stays intact. What changes from the raw prompt is **how** it gets built:

1. A **stack decision**, made once, that both brands can live with.
2. Two **rule engines** (GST + Payroll/Statutory) built as data, not code — because Indian tax and labour law changed materially in just the last 12 months (details below), and will again.
3. A **phased delivery plan** that reaches full scope without ever shipping fake functionality along the way.
4. A structure that works **both** as a sellable MHTSdigiXR product and a KoodaldigiXS project-based curriculum, by design, not by accident.

---

## 2. Tech Stack — Recommendation

| Option | Fit | Trade-off |
|---|---|---|
| **① Electron + React + TypeScript + Node.js** ✅ **Recommended for v1** | 100% reuse of your existing JS/React/Node skillset (MHTSdigiXR web stack = same stack). Fastest time-to-first-sellable-build. Massive ecosystem for PDF, printing, SQLite drivers. Directly teachable at KoodaldigiXS as a mainstream, highly employable stack. | Larger binary (~150MB+), higher RAM, Chromium patching overhead — acceptable for a business desktop app, not a dealbreaker. |
| ② Tauri v2 + React/TS + Rust core | Smaller (~15–20MB), lower RAM, tighter security sandbox — good for a v2 migration once the core is stable | Needs Rust for the native shell; splits your team's skillset now, not worth it for v1 |
| ③ .NET (C#) + WPF/WinUI | Best native Windows printing/perf | Abandons your JS stack — hurts both brand-code-reuse and the training curriculum synergy |

**Decision: Electron + React + TypeScript + Node.js**, with one hard architectural rule:

> **The business logic (Accounting Engine, GST Engine, Payroll Engine, Inventory valuation) must live in a pure TypeScript package with zero Electron/UI dependency.**

This means: if you migrate the shell to Tauri in 18 months, or spin up a cloud/web edition later, you port the shell only — the accounting/GST/payroll core doesn't get touched. This single decision is what protects the multi-year investment.

**Database:** SQLite (`better-sqlite3`, WAL mode) — one **encrypted** database file per company (via SQLCipher), giving you hard tenant isolation for free (Section 6's "never leak data between companies" becomes a filesystem-level guarantee, not just an application-level check).

**Migrations/ORM:** ~~Prisma~~ — **Kysely + `better-sqlite3-multiple-ciphers` + Kysely's built-in `Migrator`**. The Phase 0 spike (2026-09-05) confirmed Prisma is not viable here: `@prisma/adapter-better-sqlite3` hardcodes `require('better-sqlite3')` internally and never applies a `PRAGMA key` before its first query, so it cannot open a SQLCipher-encrypted file — this is true for both the legacy Rust query engine and the current driver-adapter model. Kysely, by contrast, accepts any pre-opened, already-keyed `better-sqlite3`-compatible connection via `SqliteDialect`, which works cleanly with `better-sqlite3-multiple-ciphers` (the actively-maintained, SQLCipher-compatible fork — real Zetetic SQLCipher needs OpenSSL linking and isn't realistically npm-installable cross-platform). See Phase Tracker Key Decisions Log.

**Printing:** Electron's native print + `pdfmake`/`puppeteer-print` for templated PDF generation → OS print dialog. No proprietary driver, satisfying Section 53.

**Licensing:** Ed25519-signed offline license files + `node-machine-id` hardware binding, validated locally — no phone-home dependency for core operation (Section 75).

---

## 3. The Two Rule Engines — Your Real Differentiator

This is the most important architectural decision in the entire build, and it comes directly out of the CA audit:

### 3.1 GST Rate & Rules Engine
On 22 September 2025, GST moved from a five-slab structure to essentially three working slabs (5%, 18%, 40%, with 3% for gold/silver), eliminating the 12% and 28% slabs outright. Any hardcoded rate logic broke that day. **Design requirement:** rates, HSN/SAC mappings, cess, and place-of-supply rules live in **date-effective, versioned database tables**, editable by an admin without a code deploy or app update. Treat this exactly like a pricing table, not an enum.

### 3.2 Payroll / Statutory Rules Engine
Four new Labour Codes took effect 21 November 2025, introducing a unified "wages" definition where allowances are capped at 50% of total pay — anything above that is reclassified as wages for PF, gratuity, bonus, and leave-encashment calculations — and fixed-term employees now qualify for gratuity after 1 year instead of 5. **Central and state rules are still being finalized as of this writing.** 

**Design requirement:** do not hardcode a "50%" constant anywhere. Build salary structure computation as a **configurable formula/rules layer** (component → wage-classification → statutory-base mapping), versioned by effective date, exactly like the GST engine. This is the difference between a payroll module you update via config next quarter and one you rebuild.

**Practical implication:** both engines share one internal pattern — a `RuleSet` table (effective_from, effective_to, jurisdiction, rule_type, rule_payload_json) evaluated by a single rules-resolution service. Build this resolution service **once**, in Phase 0, and both engines consume it.

---

## 4. Compliance Gaps to Build In From Day 1

These were missing or underspecified in the original spec — carrying them forward now avoids rework later:

| Gap | Requirement |
|---|---|
| **Vendor-side TDS** | Sections 194C/194J/194Q/194-I, Form 26Q, Form 16A generation — the spec only covered salary TDS (192). Purchase/Payables module needs this from Phase 3. |
| **Section 43B(h) — MSME 45-day rule** | Since FY 2023–24, unpaid dues to Udyam-registered MSME vendors beyond 45 days are disallowed as a tax expense. Supplier master needs a Udyam-registration flag + automated ageing alert tied to this rule. |
| **TCS** | Section 206C(1H) and GST e-commerce TCS — not in original spec; add to Sales module if B2B/marketplace flows are ever in scope. |
| **Dual depreciation books** | Companies Act Schedule II (accounting) vs Income Tax Act WDV block (tax) are different calculations — Fixed Assets module needs both, not one "depreciation" field. |
| **GSTR-9 / 9C** | Only 1/3B prep was specified — annual return/reconciliation data needs its own report. |
| **Entity-type-aware financial statements** | Schedule III format for companies vs. simpler formats for proprietorships/partnerships/LLPs — Company Master needs an entity-type field that drives report templates. |
| **MCA Audit Trail mandate** | Already correctly required in Section 48 — implement as an **append-only** ledger table that no role, including Super Admin, can hard-delete from the UI. This is now a legal requirement for companies under the Companies Act, not just good practice. |

---

## 5. Full Phased Roadmap (complete scope, sequenced)

Team baseline: 1 architect/lead + 2–4 full-stack engineers + 1 part-time CA/compliance advisor (retained throughout, not just at sign-off) + QA from Phase 2 onward.

| Phase | Scope (maps to spec sections) | Est. Duration | Key exit criteria |
|---|---|---|---|
| **0. Foundation** | Shell, DB, auth, RBAC, audit trail, backup framework, theme engine, **licensing/white-label plumbing pulled forward from Phase 11** | 6–8 wks | Multi-company creation works; license gating works; nothing accounting-specific yet |
| **1. Accounting Core** | Chart of accounts, ledgers, groups, vouchers, double-entry, Trial Balance/P&L/BS | 8–10 wks | Assets = Liabilities + Equity enforced; unbalanced entries impossible |
| **2. Sales + Purchase** | Customers, suppliers, orders, invoices, receivables, payables, **vendor TDS**, **43B(h) MSME flag** | 6–8 wks | Full invoice-to-ledger-to-report chain, atomic |
| **3. Inventory** | Items, units, warehouses, batches, valuation (FIFO/weighted avg) | 6–8 wks | Stock reports reconcile to accounting COGS |
| **4. GST Engine** | Rules engine (Section 3.1 above), HSN/SAC, ITC, GSTR-1/3B/9/9C prep | 6–8 wks | Rate change simulation test: swap a rate via config, zero code changes |
| **5. Banking** | Bank accounts, reconciliation, cheque/UTR tracking | 3–4 wks | Bank rec matches ledger to the paisa |
| **6. Expenses, Travel, Documents** | Expense/travel workflows, reimbursements, document attachment + search | 5–6 wks | Every transaction type can carry an attached document |
| **7. Payroll** | Employees, CTC, salary structure engine (Section 3.2 above), attendance, leave, statutory deductions, payslips | 8–10 wks | Rule-set swap test for wage-definition changes, same as GST test |
| **8. Advanced ERP** | Fixed assets (dual depreciation), cost centres, budgets, manufacturing, multi-currency, multi-branch | 8–10 wks | Consolidated multi-branch reports tie out |
| **9. Print + Templates** | Print Centre, native OS printing, PDF, document template designer | 4–5 wks | Invoice/payslip templates fully re-brandable without code |
| **10. Commercialization Hardening** | Installer, update/migration pipeline, demo mode, setup wizard | 5–6 wks | Clean install → first invoice in under 15 minutes |
| **11. UAT, Security & Compliance Sign-off** | Full acceptance test (spec Section 93), CA sign-off on GST/payroll logic, penetration pass | 4–6 wks | CA-reviewed test cases pass; ready for first paying customer |

**Total: ~14–18 months** for the complete spec with the team above. This is a realistic estimate, not a pessimistic one — every module above touches financial correctness, which is not compressible the way a marketing site is.

---

## 6. Repository Structure (monorepo — **Nx**, decided 2026-09-05)

Nx over Turborepo: its `@nx/enforce-module-boundaries` ESLint rule encodes Rule #1 (business logic has zero Electron/UI dependency) as a lint failure via project tags, not just a documented convention — a good fit given this codebase doubles as KoodaldigiXS teaching material with trainees assigned isolated `core-*` packages.

```
mhts-erp/
├── packages/
│   ├── core-accounting/       # type:core — pure TS, zero UI deps
│   ├── core-gst-engine/       # type:core — pure TS, rules-driven
│   ├── core-payroll-engine/   # type:core — pure TS, rules-driven
│   ├── core-inventory/        # type:core — pure TS
│   ├── core-rules-engine/     # type:core — shared RuleSet resolution service (Section 3)
│   ├── db-schema/             # type:db — Kysely schema + migrations, two-tier: system/ + company/
│   └── shared-types/          # type:shared
├── apps/
│   ├── desktop-shell/         # type:app — Electron + React + TS
│   └── print-templates/       # type:app
├── docs/
│   └── compliance-checklist.md   # living doc, ties to Section 4 above
└── curriculum/                    # KoodaldigiXS mapping — see Section 7
```

Each `packages/core-*` maps 1:1 to a service boundary from the original spec (Section 4) — this is deliberate: it's both good architecture and a clean curriculum module boundary.

**DB architecture is two-tier**, per Rule #3: a single **System DB** (company registry, login identities, cross-company access grants, and the shared GST/Payroll `RuleSet` reference data — the deliberate exception to "no cross-company tables," since it's the registry, not business data) plus one **Company DB** per company (company-scoped Role/Permission, and that company's own append-only AuditLog). See `packages/db-schema/src/{system,company}`.

---

## 7. Dual-Purpose Design (Commercial + Training, from Day 1)

Since this serves both brands from the start:

- **Code quality bar is non-negotiable, not aspirational** — this codebase *is* the KoodaldigiXS teaching material, so strict TypeScript, TSDoc comments, and consistent patterns aren't nice-to-haves.
- **Module isolation lets you parallelize** — advanced trainees can be assigned an isolated `core-*` package (e.g., Expense Management, Section 21–24) under supervision, while your core team builds Accounting/GST/Payroll.
- **Top-performing trainees become your certified implementation bench** once this ships — a natural pipeline from KoodaldigiXS course completion into MHTSdigiXR delivery/support roles for paying ERP customers.
- **Marketing angle:** "the ERP was built and is supported by our own certified graduates" is a genuinely strong differentiator for both brands simultaneously — worth designing the certification track around this product specifically.

---

## 8. Immediate Next Steps (Phase 0 kickoff)

1. Confirm team allocation (internal MHTSdigiXR engineers vs. KoodaldigiXS advanced trainees vs. hire).
2. Retain a CA/compliance advisor on a standing (not one-time) basis — given how fast GST and labour rules are moving, this is now an ongoing cost centre, not a launch-review checkbox.
3. Spike: Prisma + SQLCipher compatibility (2–3 days) — this decision gates the whole DB layer.
4. Draft the white-label/reseller legal agreement in parallel with Phase 0 — don't let this become a Phase 10 scramble.
5. Lock the `RuleSet` schema (Section 3 above) before writing a single line of GST or Payroll logic — every downstream module depends on getting this right once.

---

*This blueprint keeps every one of the original 94 sections in scope — nothing was cut. What changed is sequencing, the two rule-engine designs, and closing the compliance gaps the audit surfaced, so what you build in month 1 doesn't need to be rebuilt in month 8.*
