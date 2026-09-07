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
| 0 | Foundation | Shell, DB, auth, RBAC, audit trail, backup framework, theme, license/white-label plumbing | 🟨 In progress | | Electron+React shell (real packaged app relaunch-verified, not just build-verified) with a real IPC boundary; multi-company creation, per-company login credentials, offline account lockout, offline Super Admin password reset, recovery-key-based recovery, and an invite-a-new-user flow, all verified end-to-end against real encrypted files. Backup/restore (raw encrypted file export + a verify-and-rollback restore), a theme engine (light/dark + white-label brand.config.json), and Ed25519-signed offline licensing with local machine-binding (soft-gated: only new company creation is blocked without one) are now built and verified too. Still open: a real manual click-through of the GUI on a normal dev machine — this sandboxed environment has no interactive desktop session, so every session including this one has only verified via real handler calls against real encrypted files, never an actual mouse click. |
| 1 | Accounting Core | Chart of accounts, ledgers, vouchers, double-entry, TB/P&L/BS | ✅ Done | | Every item in the Blueprint's Phase 1 line is built, verified end-to-end, and has a real working UI: Chart of Accounts, ledgers, double-entry vouchers (unbalanced/malformed entries impossible — the exit criterion is a real tested code path), Trial Balance, Profit & Loss, and Balance Sheet (Assets = Liabilities + Equity proven to balance, incl. a Current Earnings roll-up). The two items previously deferred beyond the Blueprint's literal scope are now also done: voucher cancellation (via an auto-generated reversal voucher, not a destructive edit, with a new Voucher Register screen to find and cancel one) and dedicated Payment/Receipt/Contra voucher forms (auto-balancing, alongside the generic Journal form). Still open, not oversights (see Open Questions): opening-balance netting across ledgers. |
| 2 | Sales + Purchase | Customers, suppliers, invoices, receivables/payables, vendor TDS, 43B(h) flag | ✅ Done | | Customer/supplier master (unified `business_party`, own dedicated ledger under the existing Sundry Debtors/Creditors groups); Sales/Purchase Invoices AND Orders (order→invoice conversion), all posting through the unchanged Phase 1 double-entry engine; vendor TDS (194C/194J/194Q/194I) with threshold-aware deduction, rate resolved from a new versioned rule_set mechanism (never hardcoded); Section 43B(h) MSME due-date stamping + an ageing report. Bill-wise (invoice-level) payment allocation added in a follow-up session: Customer Receipt/Supplier Payment screens link a Receipt/Payment voucher to the specific invoice(s) it settles, so MSME ageing is now exact (not FIFO-estimated) for any invoice paid through them — the generic Payment/Receipt screens still work unchanged for anything not tied to an invoice. Verified end-to-end against real encrypted files. Deferred, tracked in Open Questions: TDS Form 26Q/16A generation, a rate-editing admin UI, 194Q's buyer-turnover eligibility gate. |
| 3 | Inventory | Items, units, warehouses, batches, valuation | ✅ Done | | Item/Unit/Warehouse/Batch master data; an append-only `stock_movement` ledger with FIFO-layer or weighted-average costing (`core-inventory`); Sales/Purchase invoices wired so a stockable item line moves stock and (on a sale) posts a self-balancing Cost-of-Goods-Sold voucher-line pair on the SAME atomic voucher; Stock Adjustment/Transfer/Opening Stock, Stock Summary, Stock Movement Register, and a Stock Valuation vs Ledger reconciliation view demonstrating the Blueprint's literal exit criterion. Verified end-to-end via real handler calls against a real encrypted company DB (FIFO multi-layer consumption, rounding-remainder absorption, weighted-average costing, batch isolation, insufficient-stock rollback, GL postings, and the invoice/order integration all independently checked). Deliberately deferred, tracked in Open Questions: full stock-aware invoice cancellation (a hard guard blocks it instead), alternate-UOM conversion, auto-batch-selection on issue. |
| 4 | GST Engine | Rules engine, HSN/SAC, ITC, GSTR-1/3B/9/9C prep | ✅ Done | | Increment 1: versioned GST rate/HSN-SAC rules engine (via `core-rules-engine`, same mechanism as vendor TDS), CGST/SGST/IGST place-of-supply auto-split wired into Sales/Purchase invoices and orders, new `core-gst-engine` package, Manage GST Rates admin screen, and a GST Summary reconciliation report — verified end-to-end (18 checks), including the Blueprint's literal exit criterion (rate-change simulation, zero code changes). Same-day follow-up: expanded the 5-example seed into a ~54-code, 14-category general-purpose starter catalog plus a category-browse HSN/SAC picker (`GstHsnPicker`) — verified (12 more checks). Increment 2 (same session, user asked to "complete Phase 4"): Input Tax Credit eligibility (blocked credit folds into cost, not a recoverable asset), reverse charge (self-assessed Dr Input/Cr RCM-Liability pair excluded from the supplier's payable), composition scheme (company-level, forces zero output tax + zero ITC), a standard GST set-off algorithm (`computeGstSetOff`), and all four GSTR-1/3B/9/9C prep reports (CA-facing reference reports + CSV export, not GSTN-upload-schema-exact — a deliberate, confirmed scope choice) — verified end-to-end (27 more checks) plus a full regression re-run of both earlier suites (30 checks, zero regressions). Phase 4 is now functionally complete against the Blueprint's one-line scope; residual simplifications are tracked explicitly in Open Questions, not silently dropped. |
| 5 | Banking | Accounts, reconciliation, cheque/UTR | ✅ Done | | New `bank_account` master (own dedicated ledger under the existing "Bank Accounts" group, atomic creation — same pattern as Phase 2's `createParty`), cheque/UTR/instrument tracking on Payment/Receipt/Contra vouchers (`voucher_payment_instrument`, one entry point `recordVoucherWithInstrument` degrading to a plain voucher post when no instrument), manual bank reconciliation (`bank_reconciliation`, a pure metadata/tracking layer that never touches `voucher`/`voucher_line`) with a reconciliation-statement report reusing Phase 1's `computeLedgerBalances`, and — per the user's explicit choice over manual-only — a real CSV bank-statement importer (`bank_statement_import`/`bank_statement_line`) with user-driven column mapping and paisa-exact, direction-aware auto-matching within a 7-day window (ambiguous/unmatched lines always left for manual resolution, never guessed). New pure-TS `core-banking` package, same `type:core` Nx boundary as every other module. Verified end-to-end (23 checks) against a real encrypted company DB, including the Blueprint's literal exit criterion (reconciliation statement ties to `computeLedgerBalances` to the paisa) and the CSV importer's direction-flip correctness (bank-statement CREDIT/DEBIT is the opposite sense of the ledger's own debit/credit on this asset account). Full workspace `lint`+`build` (14 projects, cache bypassed) clean. Not yet merged — on branch `phase5/banking`, pending user review. |
| 6 | Expenses/Travel/Documents | Claims, reimbursements, attachments | ✅ Done | | New `employee` master (own dedicated liability ledger under a new "Employee Reimbursements Payable" group — atomic creation, same pattern as Phase 2's `createParty`). Expense claim lifecycle (DRAFT→SUBMITTED→APPROVED→REIMBURSED, with REJECTED and CANCELLED side paths) mirrors the existing sales/purchase order state-machine pattern: approval posts a real new `EXPENSE_CLAIM` voucher (Dr each line's expense ledger, Cr the employee's ledger — the accrual), reimbursement is a separate `PAYMENT` voucher settling the claim via a new `expense_claim_settlement` table (exact mirror of the existing bill-wise invoice settlement tables, partial reimbursement supported), and a new settlement-aware cancellation guard (no precedent elsewhere in this codebase) blocks cancelling a claim that already has any reimbursement recorded. Travel is just another expense-claim line category (no separate pre-trip advance workflow — confirmed scope choice). Generic, entity-agnostic document attachment (`core-documents`, brand-new package with zero dependency on `core-accounting`) stores files as BLOBs inside the encrypted company DB — the first blob column in this schema — so `backupCompany`'s existing whole-file copy needed zero changes; wired via a reusable `AttachmentsPanel` component into the Expense Claim register plus five other representative screens (Voucher Register, both invoice registers, Parties, Bank Accounts), and a standalone filename/description `DocumentSearchScreen`. Verified end-to-end (29 checks) against a real encrypted company DB, including a byte-for-byte blob round-trip and the full claim lifecycle's voucher Dr/Cr correctness. Full workspace `lint`+`build` (16 projects) clean. Not yet merged — on branch `phase6/expenses-travel-documents`, pending user review. |
| 7 | Payroll | CTC, salary rules engine, attendance, leave, statutory, payslips | ✅ Done | | Full scope in one pass (user's explicit choice over a GST-style increment split): employee payroll profile extends the existing Phase 6 `employee` table (DOB/DOJ/DOL, employment type, PAN, bank details, UAN/ESI numbers, a second dedicated "Salaries Payable" ledger separate from Phase 6's reimbursement ledger); CTC/salary-structure engine (`salary_component_definition`/`salary_structure`/`salary_structure_line`, FLAT/PCT_OF_BASIC/PCT_OF_CTC, append-only supersede-on-raise); the Labour Code's wage-definition cap (allowances above X% of total pay reclassified as wages, X itself RuleSet-driven) implemented in `core-payroll-engine/wageClassification.ts`; PF/ESI/PT/Salary-TDS(192, new-regime slabs; old regime is manual-entry-only by design) all resolved via `core-rules-engine`'s existing RuleSet mechanism, same pattern as GST/vendor-TDS; a new `company_payroll_settings` table with AUTO/ALWAYS/NEVER applicability per scheme (AUTO compares live headcount against the RuleSet threshold; PF needs 20+ employees, ESI/Gratuity need 10+, and Gratuity's AUTO is sticky — once crossed it flips to ALWAYS permanently, per real EPF/ESI/Gratuity Act headcount thresholds); attendance (bulk date-range marking, PRESENT-by-default) and leave (company-configurable leave types, apply/approve/reject, balance tracking) feeding Loss-of-Pay proration into payroll; a payroll run lifecycle (DRAFT→PROCESSED→POSTED) posting one balanced new `PAYROLL` voucher per run, disbursement mirroring Phase 6's settlement pattern exactly; and gratuity — both a formula-based (NOT actuarial AS-15/Ind AS-19) monthly provisioning accrual AND a separation eligibility/formula calculator with a true-up adjustment + direct settlement from the Gratuity Provision ledger (both "do both" per the user's explicit choice). New `core-payroll-engine` package (was an empty Phase-0 stub) and 15 new company-DB tables (migration 012). Verified end-to-end (76 checks, throwaway tsx script against a real encrypted company/system DB pair, deleted after) — including a rate-change simulation (swap PF's rate via a new RuleSet version, zero code change), the wage-cap reclassification's literal Section 3.2 test, headcount-driven applicability at 1/10/20 employees plus the sticky-gratuity-survives-a-headcount-drop case, LOP proration, a two-employee run with PF/ESI/PT/TDS all live and the posted voucher balancing to the paise, and the full gratuity lifecycle (fixed-term-eligible vs permanent-ineligible at the same tenure, provisioning, a zero-adjustment separation, settlement, and settlement correctly refused for an ineligible employee). **Verification caught and fixed a real deadlock bug**: `gratuityRecords.ts` was calling back into the outer `companyDb` handle from inside its own `companyDb.transaction()` callback (instead of using `trx`), which silently deadlocks Kysely's single-connection queue — the awaiting promise never resolves, and since nothing else keeps Node's event loop alive, the process exits silently with no error, no crash, exit code 0. Fixed by resolving ledger IDs before opening the transaction (same pattern `postPayrollRun` already used correctly); grepped the rest of the codebase for the same pattern and found no other occurrence. Full workspace `nx run-many -t build` and `-t lint` (16 projects) clean with cache bypassed; `tsc --noEmit` clean on both the renderer and main-process TS projects (only the pre-existing, already-documented `licenseHandlers.ts` latent error remains, untouched, out of scope). Not yet merged — on branch `phase7/payroll`, pending user review. |
| 8 | Advanced ERP | Fixed assets (dual depreciation), cost centres, budgets, manufacturing, multi-currency, multi-branch | ✅ Done | | Split into three increments (user's explicit choice over one full pass): **Increment 1 (Fixed Assets + Cost Centres + Budgets) is done.** Cost centres are a nullable `cost_centre_id` dimension tag on `voucher_line` (new `cost_centre` table, `core-accounting/costCentres.ts` + a cost-centre-wise P&L report), wired as an optional selector into Journal/Payment/Receipt voucher-entry screens (Contra deliberately excluded — a pure internal Cash/Bank transfer, not an expense/income event). Budgets (`budget`/`budget_line`, 12 monthly lines, scoped to a ledger and/or cost centre) compare against actuals re-queried from `voucher_line`, no separate actuals table. Fixed Assets is a new pure-TS package `core-fixed-assets` (same `type:core` Nx boundary, depends on `core-accounting` + `core-rules-engine`): two genuinely independent depreciation books per asset — Companies Act Schedule II (SLM/WDV, strict day-count pro-ration, GL-posted via a new `DEPRECIATION` voucher type) and Income Tax Act WDV block (the real `<180`-days-in-year half-rate rule, memo-only, never GL-posted) — both rate-driven via two new `core-rules-engine` rule types (`FIXED_ASSET.SCHEDULE2_RATE.<category>` / `FIXED_ASSET.IT_WDV_BLOCK_RATE.<category>`), never hardcoded. New `ASSET_ACQUISITION`/`DEPRECIATION`/`ASSET_DISPOSAL` voucher types; each asset CLASS (not each physical unit) gets its own dedicated gross-block and accumulated-depreciation ledgers, same "own dedicated ledger" pattern as parties/bank accounts/employees. Verified end-to-end (27 checks, throwaway tsx script against a real encrypted company/system DB pair, deleted after) — including the literal dual-depreciation exit criterion (the two books compute genuinely different amounts for the same asset), a rate-change simulation (zero code change), GL balancing on acquisition/depreciation/disposal, and idempotent re-running of a depreciation period. Full workspace `nx run-many -t build -t lint` clean. Not yet merged — on branch `phase8/fixed-assets-cost-centres-budgets`, pending user review. **Increment 2 (Multi-currency + Multi-branch) is now also done**, same branch. Two more scope forks surfaced via AskUserQuestion before planning (both resolved toward the more involved option): branches get their own dedicated "Inter-Branch Current Account" ledger (a real branch-accounting current-account mechanism, not a bare dimension tag), and ALL voucher types get FX support (Journal/Payment/Receipt/Contra as well as Sales/Purchase invoices), not just invoices. The FX primitive (`foreignCurrency`/`foreignAmount`/`exchangeRateMicros`, all-or-nothing) lives directly on `voucher_line` in `core-accounting` (not a new package) since every voucher type needs it, validated via a new `convertForeignToBase` (BigInt, half-up rounding — plain `Number` multiplication of a paise-scale amount by a micros-scale rate can exceed `Number.MAX_SAFE_INTEGER`) and its exact inverse `foreignAmountForBase` (used to tag a single aggregate line, e.g. an invoice's party-ledger line, with a foreign amount that round-trips exactly). Exchange rates reuse `core-rules-engine`'s existing RuleSet mechanism as-is — zero changes to that package — via a new pure-TS package `core-multi-currency` (`FX_RATE.<CCY>` rule type), which also owns period-end revaluation (`previewFxRevaluation`/`postFxRevaluation`, new `FX_REVALUATION` voucher type, new `fx_revaluation_run`/`fx_revaluation_line` tables) and two new ledgers ("Realized Forex Gain/Loss", "Unrealized Forex Gain/Loss" — kept separate, a real CA-relevant distinction). Realized gain/loss at invoice settlement extends `core-sales-purchase`'s existing bill-wise settlement functions in place (not forked): the party ledger clears at the invoice's ORIGINAL booked value while the deposit/payment ledger moves the ACTUAL settlement-day amount, the difference posting as an extra line to Realized Forex Gain/Loss on the same settlement voucher. Branches (`branches.ts`/`branchProfitAndLoss.ts`/`branchBalanceSheet.ts`/`interBranchTransfer.ts`) stay inside `core-accounting` alongside cost centres/budgets (same size/shape of addition, unlike multi-currency's genuinely larger surface); a new `INTER_BRANCH_TRANSFER` voucher type posts one balanced 4-line voucher per transfer (each branch's own Inter-Branch Current Account ledger debited/credited against its own Cash/Bank), which needs no elimination logic anywhere — the two branches' Inter-Branch ledgers always net to exactly zero in aggregate by construction, so the existing whole-company `balanceSheet.ts`/`profitAndLoss.ts` (unchanged) is already the correct consolidated report. A new branch-wise Balance Sheet (`computeBranchBalanceSheet`) handles the one real subtlety branch-wise P&L doesn't have: `ledger_account.opening_balance` predates branch tagging entirely, so it's carried in an explicit "Head Office / Unassigned" bucket rather than dropped or guessed — the literal, honest form of the Blueprint's "consolidated multi-branch reports tie out" exit criterion. Two new migrations (015 multi-currency, 016 multi-branch). Full IPC/preload/renderer wiring: 5 new screens (BranchesScreen, InterBranchTransferScreen, BranchReportsScreen, ManageExchangeRatesScreen — the fifth instance of the still-unsolved generic-rate-editor gap, RunFxRevaluationScreen), branch selectors added to Journal/Payment/Receipt/Contra (branches apply to Contra too, unlike cost centres, since a branch is a balance-sheet dimension as well as a P&L one) plus per-line FX fields on Journal/Payment/Receipt (Contra's single-amount-both-sides shape doesn't map cleanly onto per-line FX — deliberately out of scope), header currency/rate + branch fields on the Sales/Purchase invoice screens, and FX settlement fields on Customer Receipt/Supplier Payment. Verified end-to-end (24 checks, throwaway tsx script against a real encrypted company/system DB pair, deleted after) — including the BigInt precision path on a large amount, a rate-change simulation (zero code change, same shape as GST/TDS/Payroll/Fixed-Assets), realized gain/loss with the party ledger clearing to exactly zero, idempotent re-running of a revaluation, and branch-wise BS/P&L summing exactly to the whole-company reports. **Verification caught and fixed two real bugs**, both before commit: (1) a settlement voucher's party-ledger line wasn't tagged with the invoice's own foreign currency/rate, so a fully-settled FX invoice's foreign exposure kept showing as open to period-end revaluation — fixed by splitting the party-ledger settlement line per-FX-invoice (each tagged with that invoice's own booking rate) instead of one combined base-currency-only line; (2) a revaluation run's own adjustment line intentionally can't carry FX tags (a valuation change of an unchanged foreign balance, not a new FX transaction), which meant a second run forgot the first run's effect and re-applied it — fixed by having `findFxExposures` fold in the durable `fx_revaluation_line` audit trail's prior adjustments rather than relying solely on voucher_line's own FX tags. Full workspace `nx run-many -t build -t lint` (18 projects) clean; `tsc --noEmit` clean on both the renderer and main-process TS projects (only the pre-existing, already-documented `licenseHandlers.ts` latent error remains, untouched). Not yet merged — same branch, pending user review. **Increment 3 (Manufacturing) is now also done**, same branch: user's exact scope was "core BOM + a single consume/produce voucher." New pure-TS package `core-manufacturing` (depends on `core-accounting` + `core-inventory`, same `type:core` boundary): `bill_of_material`/`bill_of_material_line` (one active BOM version per output item, append-only supersede-on-new-version — same pattern as salary_structure/asset_class) and a `manufacturing_journal` register header. The consume/produce operation scales every BOM line to the quantity actually produced, consumes each component exactly like a sales issue (FIFO layer consumption or weighted-average lookup, reusing `core-inventory`'s existing functions as-is — two new movement types `MANUFACTURING_CONSUME`/`MANUFACTURING_PRODUCE`), then produces the output at cost = sum of components consumed (no overhead/conversion-cost or wastage absorption this pass — a deliberate simplification). Posts one real `MANUFACTURING_JOURNAL` voucher, Dr/Cr the same Stock-in-Hand ledger for that amount — net GL/TB impact is zero by construction, the same precedent `transferStockInTransaction` already established for a warehouse-to-warehouse transfer, but still gets its own voucher number/audit entry as a distinct financial event. One migration (017). Full IPC/preload/renderer wiring: 3 new screens (BillOfMaterialsScreen, ManufacturingJournalScreen, ManufacturingJournalRegisterScreen). Verified end-to-end (25 checks, throwaway tsx script against a real encrypted company DB, deleted after) — mixed FIFO/weighted-average/batch-tracked components in one journal, proportional quantity scaling, BOM versioning (supersede-on-new-version), the produced item valued at exactly the components' cost, the voucher balancing and netting to zero on Stock-in-Hand, trial balance still balancing, stock positions correct on both sides, an insufficient-stock over-consumption attempt throwing and leaving no partial journal/voucher behind (atomic rollback), and a BOM-recipe-change simulation (zero code change, same shape as every other RuleSet-style rate-change test in this codebase). Full workspace `nx run-many -t build -t lint` (19 projects) clean. Not yet merged — same branch, pending user review. **Phase 8 is now functionally complete against the Blueprint's one-line scope.** |
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
| 2026-09-05 (amended) | `electron.vite.config.ts`'s bundle-instead-of-externalize list for `@mhts/*` is now **computed automatically** by reading `packages/*/package.json` names at config-eval time, instead of a hand-maintained array. Only true ESM-only npm deps (currently just `kysely`) stay a short explicit list. | A hand-maintained array is exactly the kind of thing that silently goes stale — a new `core-*` package (there will be several: accounting, GST, payroll, inventory) would hit the identical `ERR_REQUIRE_ESM`-shaped crash (this time a `require()` of unbuildable `.ts` source) the moment something actually imports it into `desktop-shell`, and nothing would catch it except another manual relaunch test. Reading the workspace's own `packages/*` directory makes it structurally impossible to forget. There is no equally reliable generic way to auto-detect "ESM-only npm dependency," so that half is still a short explicit list — extend it if another dependency shows this same failure mode. Re-verified: rebuilt, `grep`-confirmed no bundled `require("@mhts/...")`/`require("kysely")` remained, then actually relaunched the packaged app (`electron .` against a real built `out/`, isolated `--user-data-dir`) — it created and correctly encrypted a real `system.db` and stayed running with no crash, not just a passing build. | 0 |
| 2026-09-05 | Company-DEK recovery mechanism: a 256-bit **recovery key** is generated at company creation (alongside the DEK), AES-256-GCM-wraps the DEK directly (no password/KDF — the key is already full-entropy random bytes), is stored in a new `company_recovery_key` system-DB table, and is shown to the user **exactly once** on a dedicated screen they must acknowledge saving. `resetPassword` unwraps the DEK with it, re-hashes the password, and re-wraps the DEK under the new password — the recovery key itself is reusable (not single-use), since a solo-admin company has no other way back in if a single reset attempt fails partway. | Considered and rejected an "another admin re-grants access" mechanism as the *only* path: the Blueprint's own `EntityType` enum includes `PROPRIETORSHIP`/`OPC` — a huge share of MHTS's actual target market is a single admin user, so any recovery design that depends on a second already-logged-in user is not a real recovery path for most customers, only a convenience for multi-user companies (worth adding later, doesn't need its own migration). Zero-knowledge trade-off, stated explicitly to the user in the UI copy: if both the password AND the recovery key are lost, the data is unrecoverable by design — no vendor master key exists, because anything that could recover it would also be exploitable by anyone with filesystem access to the encrypted DB, defeating the point of encrypting it at all. Verified end-to-end against real encrypted files: wrong recovery key rejected (GCM auth-tag failure), correct key resets the password and logs in, the OLD password is rejected afterward, the NEW password works, and the same recovery key still works for a second reset. | 0 |
| 2026-09-05 | Email/SMS OTP-based password reset is **deliberately deferred**, not abandoned — it is out of scope for v1 and will be revisited in a later phase (candidate: alongside Phase 10 Commercialization/setup-wizard work, or whenever the app first needs *any* internet-dependent notification path). | Reasoning: (1) it would be the app's first hard dependency on a third-party service (Resend for email and/or MSG91 for SMS were the candidates evaluated) and on internet connectivity at all, which cuts directly against the "offline-first" architecture principle; (2) it adds real ongoing cost and a vendor relationship to maintain; (3) SMS OTP in India specifically requires DLT (Distributed Ledger Technology) template registration with telecom operators, which has a multi-week lead time and its own compliance overhead — not something to block Phase 0 Foundation on; (4) the offline Super Admin reset (within-app, permission-gated) plus the existing recovery-key mechanism together cover the actual failure modes (forgot password with an admin present; forgot password with no admin present) without needing connectivity at all. If any Resend/Cloudflare/MSG91 accounts were already created during exploration, they are **on hold, not in use** — no code depends on them and no credentials should be wired in until this is revisited. | 0 |
| 2026-09-05 | **Passwords moved off `AppUserTable` onto `CompanyAccessTable`** (migration 004) — each company a person has access to now has its own independent password, on the same row as the DEK wrap it unlocks. `AppUserTable` is now a bare identity anchor (name + globally-unique email), nothing else. | Directly requested during design review of the offline Super Admin reset feature: with the old single global password, an admin resetting a user's password for Company A would silently break that same user's login to Company B (their B-access was still wrapped under the old password). Confirmed with the user rather than assumed — the alternative (document as a known limitation) was explicitly offered and declined in favor of fixing it properly now, before anything ships. Verified end-to-end: the same email/identity was granted access to two companies, an admin reset their password in Company A, and Company B's login was proven completely unaffected. | 0 |
| 2026-09-05 | **Offline Super Admin password reset**: any role holding the new `SYSTEM.RESET_USER_PASSWORD` permission can, while logged in, reset another user's password for *that* company — no internet, no recovery key needed. Mechanically: the acting session now also holds the raw unwrapped Company DEK in main-process memory (`SessionManager.dek`, never sent over IPC), which is used to re-wrap the DEK for the target user under a freshly server-generated temporary password (never admin-typed, to avoid weak/reused temp passwords). The target's `must_change_password` flag forces them through a real password change (`changePassword` IPC) before a session is established — `login` still verifies the temp password and unwraps the DEK either way, so it never leaks "this account needs a reset" for free to a wrong guess. | Holding the raw DEK in session memory doesn't weaken anything: SQLCipher already keeps the derived key resident for the life of the open `companyDb` connection, so this isn't exposing key material that wasn't already effectively live. A `RESET_USER_PASSWORD` holder is explicitly barred from targeting their own account (must use "Change password" or the recovery key instead) — resetting your own password via your own still-valid session would be a confusing, unnecessary code path. Verified end-to-end: temp password forces `mustChangePassword`, old temp password stops working the moment `changePassword` completes, new self-chosen password works, and the guard against self-targeting is enforced. | 0 |
| 2026-09-05 | **Account lockout**: configurable via a new singleton `security_policy` row (system DB) — `max_failed_attempts` (default 5), `lockout_duration_seconds` (default 900), `backoff_base_seconds` (default 2, doubling per attempt: 2s/4s/8s/16s...). Lockout *state* (`failed_login_count`, `locked_until`, `last_failed_attempt_at`) lives per `company_access` row, not globally — consistent with passwords now being per-company. No CAPTCHA. | CAPTCHA is both inappropriate for an offline desktop app's UX and, per the user, typically requires internet to verify anyway — defeating the point. Thresholds are DB-configurable specifically so they never need a code change to retune (mirrors the "rules as data" instinct from Rule #2, applied here to a security policy rather than GST/payroll). Verified end-to-end (with the test tuning `max_failed_attempts`/`backoff_base_seconds` down via the *same* configurable row, not a separate code path): repeated wrong passwords lock the account (even the correct password is then refused), and a successful login after the lockout window clears all lockout state. | 0 |
| 2026-09-05 | Solo-admin "forgot password" routing shows **both** recovery options unconditionally (ask an admin / use the recovery key), rather than trying to detect whether another admin exists before login. | Originally proposed a pre-auth `hasResetCapableAdmins` check; caught before implementing that it can't work — role/permission data lives inside the encrypted Company DB, which nothing can open pre-login. Rather than build a denormalized permission-mirror into the System DB (real sync-maintenance debt once role editing exists in a later phase, for a minor UX nicety), the "ask an admin" instruction panel itself carries an explicit "use your recovery key instead" escape hatch — simpler, no new schema, and still never dead-ends the user, which was the actual requirement. | 0 |
| 2026-09-05 | **Phase 1 kicked off**, scoped to a first increment (not the full 8–10-week phase): default Chart of Accounts seeded per company (`account_group`/`ledger_account`, migration 002), a double-entry `voucher`/`voucher_line` engine (migration 003), and a Trial Balance report. All amounts are stored as **integers in paise**, never REAL/float, everywhere in the schema and in `@mhts/core-accounting` — the standard fix for floating-point rounding bugs in financial software, decided once before any ledger data existed rather than migrated later. | Matches the Blueprint's Phase 1 exit criterion verbatim: "Assets = Liabilities + Equity enforced; unbalanced entries impossible" is now a real, tested code path (`createVoucher` validates every line has exactly one of a debit/credit, requires ≥2 lines, and requires total debits = total credits, inside one Kysely transaction — Rule #4 atomicity), not an aspiration. Deferred to a later Phase 1 pass, not this one: P&L/BS reports (need the same group-hierarchy rollup, better proven against real voucher data first), Payment/Receipt/Contra-specific UX (one generic double-entry form covers all four voucher types for now), and voucher edit/cancellation (correcting a mistake means posting a reversal voucher for now, consistent with the append-only audit philosophy already established in Phase 0 — a proper edit/cancel workflow is a fast-follow, not skipped). | 1 |
| 2026-09-05 | New `@mhts/core-audit` package: the first real implementation of the "audit-writing service" that `company/types.ts`'s `AuditLogTable` comment anticipated in Phase 0 but never built (nothing had mutated business data yet). `writeAuditLog(companyDb, entry)` computes the SHA-256 hash chain in application code (reads the previous row's hash, hashes payload+prevHash+an explicitly-generated timestamp, inserts) and is designed to be called from inside the SAME Kysely transaction as the business write it's recording — `createVoucher` is the first caller. | Pulled out as its own `type:core` package rather than folded into `core-accounting` because every future business module (GST, payroll, inventory, sales/purchase) will need the identical write path — this is cross-cutting infra, not accounting-specific logic, and matches the existing pattern of one package per service boundary. The timestamp is generated in code and inserted explicitly rather than left to the column's `CURRENT_TIMESTAMP` default, because it has to be part of the hashed payload — a value the DB hasn't decided yet can't be hashed. Verified end-to-end: every successfully-posted voucher wrote exactly one real `audit_log` row (rejected/unbalanced attempts never reach the transaction, so they correctly write none), and the existing append-only trigger from Phase 0 still blocks `UPDATE`/`DELETE` on those rows. | 1 |
| 2026-09-05 | Each business module (starting with `core-accounting`) **owns and grants its own RBAC permission codes** (e.g. `ACCOUNTING.MANAGE_CHART_OF_ACCOUNTS`, `ACCOUNTING.CREATE_VOUCHER`, `ACCOUNTING.VIEW_REPORTS`, via a `grantAccountingPermissions(companyDb, roleId)` called alongside `@mhts/core-identity`'s `seedAdminRole` at company creation) rather than `core-identity` maintaining one growing list for every module. | `core-identity`'s `FOUNDATION_PERMISSIONS` is explicitly scoped to Phase 0 system-level permissions (user/role/audit management) — piling every future module's permission codes into that one list would make `core-identity` a dependency magnet for every other `core-*` package, inverting the intended module boundary (identity/RBAC primitives should be upstream of business modules, not entangled with their specific permission sets). `resolvePermissions` already works generically (joins `role_permission`+`permission` by role id) regardless of which module inserted the rows, so no changes were needed there. | 1 |
| 2026-09-05 | **Phase 1 completed**: Profit & Loss and Balance Sheet, built on a new shared `computeLedgerBalances` helper (`ledgerBalances.ts`) that Trial Balance was refactored onto as well, rather than three separate ad hoc balance queries. | All three reports are really the same query — "sum this ledger's movements within some date bound, signed debit-positive" — with different nature filters and date bounds layered on top (Trial Balance: all natures, all-time, opening included; P&L: INCOME/EXPENSE only, a date range, opening excluded since income/expense don't carry a balance across periods; Balance Sheet: ASSET/LIABILITY/EQUITY only, up to a date, opening included). Building one correct, tested helper and layering three thin views on it is safer than three independent implementations that could each get the sign conventions subtly wrong in different ways. Since this phase has no period-closing entries into a real retained-earnings ledger, the Balance Sheet adds net profit/loss since inception as a synthetic "Current Earnings" equity line — the standard mechanic for an interim (unclosed) balance sheet to actually balance. Verified end-to-end against real posted vouchers: P&L for a date range matches expected income/expense/net-profit exactly, a period with no vouchers correctly shows zero, and the Balance Sheet's Assets exactly equals Liabilities + Equity (including Current Earnings) both with and without posted activity. | 1 |
| 2026-09-05 | **Voucher cancellation modeled as an auto-generated reversal voucher, never a destructive edit or delete.** Migration 004 adds `cancelled_at`/`cancelled_by_voucher_id` to the original and `reverses_voucher_id` to the reversal, cross-linking them. A reversal voucher cannot itself be cancelled (no unbounded reversal chains), and an already-cancelled voucher cannot be cancelled again. New Voucher Register screen (with a new `listVouchers`) is the first general voucher-listing UI in the app — needed as a real prerequisite for "find and cancel a voucher," not built as a side effect. | Consistent with the append-only audit philosophy already established for `audit_log` (Rule #5) — once a voucher exists, history isn't rewritten, it's corrected going forward. This also means Trial Balance/P&L/BS needed **zero** changes to support cancellation: a reversal's mirror-image lines net to exactly zero in every existing balance computation automatically, since they all just sum `voucher_line` rows regardless of any voucher's cancelled status. Verified end-to-end: cancelling posts a reversal with the same voucher type and a linked narration, the original and reversal are correctly cross-linked and reflected in the register, Trial Balance nets the cancelled voucher's effect to exactly zero, and both the double-cancellation guard and the cancel-a-reversal guard are enforced. | 1 |
| 2026-09-05 | **Phase 2 kicked off and completed in one pass** (all three of: base scope, vendor TDS, and Sales/Purchase Orders — user explicitly chose to include all three rather than defer any). Customers/suppliers share one `business_party` table (`party_type` CUSTOMER/SUPPLIER/BOTH) rather than two separate tables, since a real counterparty is often both. | A business's own customer/supplier list very often overlaps (a company that buys raw material from a vendor who is also a retail customer); forcing two disjoint tables would mean duplicating the same real-world entity, with no clean way to represent "this is the same party." One table with a type discriminant, mirroring the existing VOUCHER_TYPES-style closed-vocabulary convention, avoided that without adding real complexity. | 2 |
| 2026-09-05 | **No new default chart-of-accounts groups for Phase 2** — Sundry Debtors/Sundry Creditors/Duties & Taxes/Sales Accounts/Purchase Accounts were already seeded by Phase 1's `seedChartOfAccounts`. Each party gets its own dedicated ledger sub-account under Sundry Debtors/Creditors at creation time (one atomic transaction, ledger + party row together), so a party's outstanding balance IS that ledger's balance — `computeLedgerBalances` needed zero changes to support receivables/payables. | Re-verified before building anything: Phase 1's default groups already exactly matched what Phase 2 needed, so building new ones would have been pure duplication. Discovering and reusing existing infrastructure instead of assuming it needs building is the same instinct that resolved the account-group-hierarchy question in Phase 1 session 6. | 2 |
| 2026-09-05 | **Sales/Purchase invoices don't store their own `financial_year` or invoice number** — each invoice posts a real voucher (new voucher types `SALES_INVOICE`/`PURCHASE_INVOICE`) via `core-accounting`'s existing engine, and `voucher.voucher_number` (already sequential per type+year, from Phase 1) IS the invoice number, joined via `voucher_id` wherever displayed. Orders, which have no ledger impact until converted, DO get their own sequential numbering (`sales_order`/`purchase_order` tables), since there's no voucher to borrow numbering from yet. | Avoids maintaining two numbering sources that could drift out of sync. Matches the project's general instinct (see Phase 1's `computeLedgerBalances`) of building one correct mechanism and reusing it rather than parallel near-duplicates. | 2 |
| 2026-09-05 | **`core-accounting`'s `createVoucher` was refactored into a thin wrapper around a new exported `createVoucherInTransaction(trx, input, actorUserId)`**, and the same split was applied to `core-sales-purchase`'s `createSalesInvoice`/`createPurchaseInvoice` (→ `...InTransaction` variants). Order-to-invoice conversion (`convertSalesOrderToInvoice`/`convertPurchaseOrderToInvoice`) uses the `...InTransaction` variants directly so the invoice-and-its-voucher AND the source order's status update commit or roll back as ONE transaction. | The Blueprint's literal Phase 2 exit criterion is "full invoice-to-ledger-to-report chain, **atomic**." An earlier draft called the already-transactional `createSalesInvoice` (its own transaction) and then updated the order's status in a second, separate transaction — a crash in between would leave a posted, ledger-correct invoice with its source order still reading CONFIRMED, inviting an accidental duplicate invoice on retry. Rule #4 applies to the whole conversion operation, not just the invoice-posting half of it. Not needed for TDS-threshold cumulative-sum reads: this app's Electron main process is single-threaded with a synchronous SQLite driver, so there is no real read/write race to guard against there the way there is for the two-write conversion case. | 2 |
| 2026-09-05 | **Vendor TDS rate/threshold resolution reuses the existing (until now unbuilt) `rule_set` system-DB table** via a new, real `@mhts/core-rules-engine` implementation (`createRuleSetVersion`/`resolveEffectiveRule`/`listRuleSetVersions` — date-effective lookup + versioning, a superseded rate is closed off with an end date, never edited in place). TDS *section codes* (194C/194J/194Q/194I) are a small fixed vocabulary in `core-sales-purchase` (like `VOUCHER_TYPES`); the *rate and threshold* for each are `rule_set` rows, resolved at invoice time, never a JS constant. | Direct application of Rule #2 to TDS, which the Blueprint didn't originally call out alongside GST/payroll but changes on the same kind of schedule (Finance Act amendments). `core-rules-engine` had been left a deliberate stub in Phase 0 ("resolution logic... out of scope for this pass... consumed by core-gst-engine and core-payroll-engine"); building real resolution logic now, driven by TDS's actual need, means Phase 4/7's GST and payroll engines inherit a proven mechanism instead of building their own from scratch. | 2 |
| 2026-09-05 | **TDS is threshold-aware, not flat-rate-on-the-whole-invoice**: `computeTdsAmount` sums a party's prior cumulative taxable value under that section this financial year, and only taxes the portion of THIS invoice that falls above the section's threshold — correctly giving ₹0 while under threshold, a partial amount on the invoice that crosses it, and the full rate on every invoice after. Default seeded rates (2% §194C/₹1,00,000 threshold, 10% §194J/₹30,000, 0.1% §194Q/₹50,00,000, 10% §194I/₹2,40,000, all effective 2025-04-01) are explicitly flagged in their `source_reference` as simplified defaults pending CA review — several real sub-cases are collapsed to one representative rate (194C's individual/HUF-vs-other split, 194I's plant/machinery-vs-land/building split, 194Q's buyer-turnover eligibility gate). | This is the actual statutory mechanism (194C/194Q especially), not an approximation invented for convenience — computing it properly was no harder than a flat rate once the cumulative-lookup query existed, so there was no reason to ship the less correct version. The CA-review flag follows CLAUDE.md's own standing disclaimer ("not exhaustive — defer to a CA review before shipping any tax/payroll logic") rather than presenting a simplified number as authoritative. | 2 |
| 2026-09-05 | **Section 43B(h) MSME due date**: simplified to `min(party's credit period, 45 days)` for a flagged MSME vendor, `due_date` stamped on the purchase invoice at creation time (a snapshot, along with `is_msme_vendor`, so a later edit to the party record can't rewrite a past invoice's ageing). The real rule's 15-day fallback (when no written agreement exists) is not modeled — this pass has no concept of "agreement exists," so it always assumes one and applies the 45-day cap. | Recorded as a known, explicit simplification (see Open Questions) rather than silently treating 45 days as universally correct — a business without a supplier agreement is legally on a stricter 15-day clock, and the ageing report would currently under-flag that case. | 2 |
| 2026-09-05 | **Receivables/Payables/MSME-ageing reports have no bill-wise (invoice-level) payment allocation** — a generic Payment voucher still just credits whichever ledger the user picks, with no link back to a specific invoice (unchanged from Phase 1). Party-level outstanding balance (receivables/payables) is exact, since it's just that party's own ledger balance. MSME ageing, which needs to know WHICH invoices are still open, estimates this with a FIFO settlement assumption: a supplier's current outstanding balance is assumed to cover their most recent invoices, walking oldest-to-newest up to that balance. | Full bill-wise allocation (matching a specific payment to a specific invoice) is a real, substantial feature in its own right — building it wasn't asked for and would have doubled this increment's scope for a report-accuracy refinement, not a new capability. FIFO-assumed ageing is a standard, defensible approximation used by simpler accounting tools without bill-wise tracking, but it IS an approximation — flagged honestly in code comments and here rather than presented as certain. | 2 |
| 2026-09-05 | **Dedicated Payment/Receipt/Contra voucher screens**, alongside the existing generic Journal form (renamed `JournalVoucherScreen` for clarity) — no backend changes needed, since `createVoucher` already accepts arbitrary lines for any voucher type. Payment: pick one "paid from" ledger (auto-credited for the total) + one or more "paid to" lines (debited). Receipt: the mirror image. Contra: a plain two-ledger transfer, one amount. | The whole point is auto-balancing: previously every voucher, regardless of type, required manually entering both a debit and a credit that summed to the same total — easy to get wrong by hand. These forms compute the counter-ledger's amount automatically, so the user only ever enters one side. Server-side validation in `createVoucher` (debits must equal credits) is unchanged and still the actual authority — the auto-balancing is a UX convenience, not a weakening of the correctness guarantee. Verified end-to-end: Payment and Contra vouchers built exactly the way their screens construct lines post correctly and the resulting Trial Balance ties out to the paisa. | 1 |

---

| 2026-09-06 | **Invite-a-new-user flow** (resolves the Phase 0 gap flagged since session 4): new `inviteUser` reuses the exact same DEK-rewrap mechanics as the existing offline admin password reset (the acting session's already-unwrapped DEK re-wraps under a fresh server-generated temp password), and a new minimal `listRoles` lets the invite form pick a role. | Deliberately did NOT build role creation/editing in the same pass — today's only role is the seeded "Admin," and building a full custom-roles UI wasn't asked for; the invite form just lists whatever roles already exist, so it generalizes for free once role management exists later (tracked in Open Questions, not silently worked around). | 0 |
| 2026-09-06 | **Theme engine**: every screen already used plain inline styles with no explicit background/text color, so a single global stylesheet (`styles.css`, CSS custom properties for light/dark, toggled via a `data-theme` attribute on `<html>`) themes the whole app with ZERO per-screen changes. Preference persists in a new singleton `app_preference` system-DB table (same pattern as `security_policy`), not per-viewer browser storage, so it survives across app restarts. White-labeling is a separate, build-time mechanism: `brand.config.json` (app name, accent color) is read once at renderer startup — a reseller build only needs to edit that JSON and rebuild, no component or stylesheet touched. | Checked before building anything: since no screen sets its own background/text color, they all inherit from `<body>`, so theming the DOCUMENT root was sufficient — a large per-screen retrofit (the kind of mechanical, error-prone change usually needed to retrofit theming onto ad hoc inline styles) turned out unnecessary. A dedicated typed preference table (not a generic key-value settings blob) matches this codebase's existing convention (`security_policy`) rather than introducing a new pattern for one setting. | 0 |
| 2026-09-06 | **Backup/restore**: backup copies the company's encrypted DB file byte-for-byte (never decrypted to disk) to a user-chosen location via the native save dialog. Restore is deliberately cautious given how hard-to-reverse a bad one would be: it captures the session's already-unwrapped DEK and closes the live connection BEFORE touching the file, makes its own pre-restore safety copy, copies the chosen backup into place, and immediately tries to open-and-query it with the captured DEK — any failure rolls the safety copy back over the file so the user's real data is never left broken. Restore is scoped to the SAME company (its system-DB entry/DEK-wrap is untouched) — a same-company rollback to an earlier snapshot, not a cross-install migration (which would also need the system DB backed up, out of scope here). | This is exactly the kind of action CLAUDE.md's safety guidance calls hard-to-reverse — worth the extra rollback-on-failure engineering rather than a bare `copyFileSync`. Verified end-to-end (since the native file-picker dialogs can't be driven headlessly, this exercised the same copy-verify-rollback steps directly): a snapshot taken earlier really does restore the company back to that point, and a corrupt/wrong backup file is correctly rejected with the pre-attempt data restored intact, never partially overwritten. | 0 |
| 2026-09-06 | **Licensing/white-label plumbing**: Ed25519 keypair generated for real; the PRIVATE key is deliberately NOT in this repo (see the user's own secure storage — handed off outside version control) and a new standalone `scripts/generate-license.mjs` (never imported by the shipped app) is the only thing that can sign a license file. The shipped app only embeds the PUBLIC key (`@mhts/core-licensing`) to verify. Hardware binding doesn't live inside the signed license payload (the app never holds the private key to re-sign one with a machine id baked in) — instead a local-only `license_activation` system-DB row records the first machine a given `licenseId` verified on; a later check for the SAME licenseId on a DIFFERENT machine id is rejected, while loading a genuinely different (still-valid) license overwrites the record (a real upgrade path, not a bypass). **Soft-gated, per explicit user choice**: only NEW company creation requires a valid license — opening/using an already-existing company is never blocked by a missing/expired license, so a lapsed license can't lock a customer out of their own data. A real signed dev/test license was generated and handed to the user so this could never lock out their own testing. | The alternative (hard-gating the whole app) was explicitly offered and declined — soft-gating matches the Blueprint's stated Phase 0 exit criterion ("license gating works") without the risk of a licensing bug bricking the app for existing customers, which fully-fledged enforcement UX is Phase 10's job anyway. Verified end-to-end: company creation is blocked with zero license activated, a real Ed25519-signed license verifies and activates (binding to this machine), the SAME license reports invalid once its bound machine id is tampered with (simulating a copy to a second machine), and company creation succeeds again once restored to the correct machine id. | 0 |
| 2026-09-06 | **Bill-wise (invoice-level) payment allocation** — closes the gap flagged at the end of the last Phase 2 session. New `sales_invoice_settlement`/`purchase_invoice_settlement` tables link a Receipt/Payment voucher to the specific invoice(s) it settles (partial settlement allowed); a settlement's amount is validated against that invoice's CURRENT remaining outstanding, and a settlement's contribution automatically stops counting if its voucher is later cancelled (a plain `WHERE voucher.cancelled_at IS NULL` filter at query time — no special-case cancellation logic needed). New Customer Receipt/Supplier Payment screens are additive alongside the existing generic Receipt/Payment screens (which still work, for anything not tied to a specific invoice, e.g. an advance). | This directly upgrades MSME ageing from FIFO-estimated to exact wherever a supplier's invoices were paid through the new bill-wise flow: each invoice's own settlement-reduced remaining balance is now the FIFO unit consumed against the party's (always-exact) ledger balance, instead of each invoice's full original amount — identical to the old behavior when no settlement data exists yet (a pure improvement, not a behavior change for existing data), exact once it does. A real bug was caught and fixed while verifying this: `listOutstandingSalesInvoices`'s query originally LEFT JOINed both `sales_invoice_line` AND `sales_invoice_settlement` in the same query, which fans out (each line row duplicated once per settlement row) and silently inflated the computed taxable amount — caught only by the end-to-end assertion that a fully-settled invoice actually disappears from the outstanding list, not by `tsc`/lint. Fixed by computing settled amounts via a separate, correctly-grouped query (which the code already had) instead of joining it into the same one. | 2 |

| 2026-09-06 | **Custom role creation/editing** lives in `@mhts/core-identity` (not a new package) — `listAllPermissions` just reads the company DB's shared `permission` table (already populated by every module's own `grant*Permissions` at company creation, so it's always complete with zero extra bookkeeping), and `createRole`/`updateRolePermissions` are plain transactional inserts/replaces into `role`/`role_permission`. The built-in Admin role (`is_system_role = 1`) is hard-blocked from having its permissions edited through this path. | Kept in `core-identity` rather than a new package since it's the existing home of `Role`/`Permission` logic (`seedAdminRole`, `resolvePermissions`) — a new package would just be an arbitrary split of the same concern. Blocking edits to the system Admin role is a deliberate safety rail: accidentally stripping `SYSTEM.MANAGE_USERS`/`SYSTEM.MANAGE_ROLES` from the only role that has them would lock every user in a company out of managing it, with no recovery path short of restoring a backup. Role DELETION was deliberately not built in this pass — a role's id is referenced from `company_access` in the SYSTEM DB, invisible to a company-DB-only safety check, so deleting one safely needs cross-database validation not built yet (flagged in Open Questions, not silently worked around). Verified end-to-end: a custom "Accountant" role with a narrow permission set is created correctly, duplicate names and non-existent permission codes are rejected, editing replaces (not merges) the permission set, and editing the built-in Admin role is rejected. | 0 |
| 2026-09-06 | **License expiry reminder**: `LicenseStatus` gained `expiresInDays` (null for a perpetual license), computed purely for the UI's "renew soon" banner (≤30 days) — it plays no role in the actual pass/fail validity check, which `checkLicenseStatus` already enforces correctly via `expiresAt` regardless of this field. | A separate, additive field rather than folding the reminder logic into validity checking, so a bug in the reminder threshold could never accidentally affect whether a license is treated as valid. Verified end-to-end: a perpetual (no-expiry) license correctly reports `expiresInDays: null` with no false warning, and a second license signed 10 days from expiry correctly reports `expiresInDays: 10`. | 0 |

| 2026-09-06 | **Phase 3 kicked off and completed in one pass**, scoped via a plan-mode design review before any code was written (per CLAUDE.md's financial-logic gate). Quantities are stored as integers in **thousandths of a unit** everywhere in the schema and in `@mhts/core-inventory`, mirroring the existing paise-not-float rule for money — same class of rounding bug, same fix. New tables: `unit_of_measure`, `warehouse`, `item`, `item_batch`, `stock_movement` (append-only, no UPDATE/DELETE — same convention as `audit_log`/`voucher_line`), `stock_receipt_layer` (the one genuinely stateful piece — FIFO cost-of-goods-sold is an ordered-consumption algorithm, not a derivable aggregate), and `stock_movement_layer_consumption` (records exactly which layer(s) a sale/transfer drew from, so a *future* reversal pass has the data to reverse precisely, without a backfill). Everything else (on-hand position, weighted-average cost) is derived on the fly, mirroring `computeLedgerBalances` — no cached balance table. | The Blueprint's Phase 3 line is one sentence with no further detail ("Items, units, warehouses, batches, valuation (FIFO/weighted avg)", exit criterion "Stock reports reconcile to accounting COGS") — the full design here is this session's own, built from how Phase 1/2 actually work (verified via code exploration) and pressure-tested by a dedicated design-review pass that caught two real defects before any code was written: a rounding bug (naive `qty*rate` exact-equality validation would reject ordinary fractional-quantity lines) and a data-integrity gap (invoice cancellation would silently desync stock from the ledger — see the cancellation-guard decision below). | 3 |
| 2026-09-06 | **FIFO layer consumption absorbs its own rounding remainder**: `stock_receipt_layer.value_remaining_paise` is decremented by the *actual* rounded cost charged to each partial draw, but the draw that fully drains a layer charges whatever `value_remaining_paise` is left on it rather than a freshly-rounded `qty*rate` — verified end-to-end (a layer received at a non-round rate, drawn down across two separate issues, ends at exactly zero remaining value, never a stray paisa of drift). Weighted-average valuation needs no equivalent trick: it recomputes the average from full movement history on every issue rather than feeding a rounded average back into itself, so only one bounded rounding step happens per issue — verified not to compound across repeated partial issues. | Caught in design review before implementation: an exact-equality or naive-recompute approach would either reject legitimate fractional-quantity/fractional-rate lines (e.g. 0.333 kg at ₹1.50/kg = ₹49.95) or let a FIFO layer's total issued cost silently drift from what it actually cost to receive over many partial draws — both are real correctness bugs a manual click-through would be unlikely to catch. | 3 |
| 2026-09-06 | **One-directional new package dependency: `core-sales-purchase` → `core-inventory`** (added to `core-sales-purchase/package.json`; no Nx boundary rule restricts core-to-core dependencies, confirmed before adding it). `DocumentLineInput` gained four optional fields (`itemId`, `warehouseId`, `quantityThousandths`, `ratePaise`, all-or-nothing together) plus batch fields — a line with no `itemId` validates and posts exactly as it did before this phase. A stockable purchase line's `ledgerId` is now REQUIRED to equal the well-known Stock-in-Hand ledger (new `seedInventoryLedgers`, called at company creation like `seedChartOfAccounts`) — enforced in `createPurchaseInvoiceInTransaction`, not left to user discipline. A stockable sales line leaves the user's chosen income ledger untouched (revenue recognition doesn't change) and instead appends ONE extra self-balancing `Dr Cost of Goods Sold / Cr Stock-in-Hand` voucher-line pair to the SAME voucher as the sale — invoice, stock movement, and COGS posting are one atomic transaction (Rule #4), never separate steps that could disagree if one failed partway. `convertSalesOrderToInvoice`/`convertPurchaseOrderToInvoice`'s hand-written line-mapper functions were updated to forward the four new fields — caught explicitly in design review as an easy-to-miss spot, since that mapper does not forward unknown fields, so a converted order would otherwise post its invoice successfully on the GL side while silently never moving stock or posting COGS. | This is the direction that made sense structurally (Sales/Purchase is a downstream consumer of the Inventory master + stock-posting functions, same relationship `core-sales-purchase` already has with `core-accounting`), and keeping the ledger-lock server-side (not just a UI convention) prevents a stockable purchase from ever accidentally posting to "Purchase Accounts" and silently breaking stock-to-GL reconciliation. Verified end-to-end: a stockable purchase line to the wrong ledger is rejected; a stockable sale posts one voucher containing the AR/Sales/tax lines AND the COGS pair, with the Stock-in-Hand ledger balance, COGS ledger balance, and item-level stock position all matching hand-calculated expected values; converting a sales order with an item line into an invoice correctly moves stock (proving the mapper fix). | 2, 3 |
| 2026-09-06 | **Cancellation guard instead of full stock reversal**: cancelling a SALES_INVOICE/PURCHASE_INVOICE voucher that has any linked `stock_movement` row is now rejected outright (new `cancelSalesInvoice`/`cancelPurchaseInvoice` in `core-sales-purchase`, checking a new `hasStockMovementsForReference` in `core-inventory` before delegating to `core-accounting`'s existing generic `cancelVoucher`) — the Sales/Purchase Invoice Register screens now call these instead of the generic `cancelVoucher` IPC path. A plain (non-stockable) invoice cancels exactly as it always has. | Caught in design review as the single biggest gap in an earlier draft of this plan: `core-accounting`'s generic `cancelVoucher` knows nothing about stock — it would correctly reverse every GL line (including the COGS pair, since it's just more voucher lines) but has no way to un-consume FIFO layers or re-credit the stock position, silently leaving stock and the ledger disagreeing on the very first cancelled stockable invoice. Building full automatic reversal correctly (un-consuming layers, handling a purchase receipt that's already been partly issued to a customer) is a real, independently-testable piece of work — building it half-right would be worse than not building it, so this pass adds a hard, loud guard instead and tracks full reversal as an explicit Open Question. The schema already carries `stock_movement_layer_consumption` (which layer(s) a sale drew from) specifically so a future reversal pass won't need a data backfill. Verified end-to-end: cancelling a stock-linked sales invoice is rejected with a clear message; cancelling a plain invoice still works exactly as before. | 2, 3 |
| 2026-09-06 | **Full stock-movement reversal built** (follow-up session, same day) — replacing the hard cancellation guard above. Design was reviewed in plan mode before implementation (per CLAUDE.md's financial-logic gate) and the review, reading the actual shipped code rather than a summary, found two blocking prerequisite bugs fixed as part of this work: (1) `postStockAdjustmentInTransaction`'s `ADJUSTMENT_OUT`/FIFO branch discarded `consumeFifoLayersInTransaction`'s `.consumptions`, never writing `stock_movement_layer_consumption` rows — fixed to match `postSalesIssueInTransaction`'s pattern; (2) `VoucherRegisterScreen.tsx`'s generic "Cancel" button called the plain unguarded `cancelVoucher` for EVERY voucher type, including `SALES_INVOICE`/`PURCHASE_INVOICE`/`STOCK_ADJUSTMENT` — a live bypass of the entire guard architecture (old hard-block and new reversal alike), closed by dispatching on `voucher.voucherType`. **Core mechanism**: reversing an OUTBOUND movement (`SALES_ISSUE`, `ADJUSTMENT_OUT`) is always safe regardless of chronology — it credits stock back to the exact FIFO layer(s) originally drawn from (via `stock_movement_layer_consumption`, replayed as plain increments — new `restoreFifoLayerInTransaction`) or, for weighted-average, inserts a plain compensating inbound movement with the original quantity/value (the pooled sum is order-independent). Reversing an INBOUND movement (`PURCHASE_RECEIPT`, `ADJUSTMENT_IN`) is NOT always safe: FIFO checks the layer's `quantity_remaining_thousandths` still equals the original movement's own `quantity_thousandths` (nothing drawn from it yet); weighted-average checks this is the MOST RECENT `stock_movement` for that exact scope, using SQLite's implicit `rowid` (zero migration — none of these tables are `WITHOUT ROWID`) rather than a random-UUID `id` or 1-second-resolution `created_at`. New `packages/core-inventory/src/stockReversals.ts` (`reverseOutboundMovementInTransaction`/`reverseInboundMovementInTransaction`/`reverseStockMovementsForReferenceInTransaction`) never mutates an original `stock_movement` row (append-only, same convention as `audit_log`) — it inserts one of four new dedicated `MOVEMENT_TYPES` (`SALES_ISSUE_REVERSAL`/`PURCHASE_RECEIPT_REVERSAL`/`ADJUSTMENT_IN_REVERSAL`/`ADJUSTMENT_OUT_REVERSAL` — dedicated rather than doubled-up, since the Stock Movement Register shows `movementType` as a raw string with no join back to the original) with `reference_type: 'STOCK_MOVEMENT_REVERSAL'`, `reference_id` = the original movement's own id. `core-accounting`'s `cancelVoucher` was split into `cancelVoucherInTransaction`/`cancelVoucher` (same pattern as `createVoucher`/`createVoucherInTransaction`) so `cancelSalesInvoice`/`cancelPurchaseInvoice`/new `cancelStockAdjustment` can reverse stock AND the voucher in ONE transaction. `cancelSalesInvoice`/`cancelPurchaseInvoice`'s public parameter changed from the invoice's own id to its `voucherId` (looking up the invoice internally), so the generic Voucher Register can route to them using the only identifier it has. | Verified end-to-end across 8 scenarios against a real encrypted company DB: full round-trip via sales invoice cancellation (stock AND all three affected ledgers — Stock-in-Hand, COGS, Sales — restored to exact pre-sale values, not just approximately); double-cancellation rejected; purchase invoice cancellation blocked once any of its stock has been sold, with the WHOLE cancellation (not just the stock half) rolling back atomically on that rejection; a genuinely untouched purchase receipt cancels cleanly; weighted-average's deliberately-conservative rule blocks a receipt cancellation even when a later movement is merely inbound (not just outbound), and allows it when nothing follows; `ADJUSTMENT_OUT`/`ADJUSTMENT_IN` cancellation for stock adjustments (validating prerequisite fix #1); a latent, unrelated same-day FIFO consumption-order bug in `stockLayers.ts` (UUID-lexicographic tiebreak instead of insertion order) found and fixed alongside this work, using the same `rowid` mechanism; a sale reversed correctly restores into a layer that was originally created by a `TRANSFER_IN` rather than a `PURCHASE_RECEIPT`, with no special-casing needed; and the `cancelVoucher`/`cancelVoucherInTransaction` split doesn't change behavior for plain JOURNAL/PAYMENT/RECEIPT/CONTRA vouchers. | 3 |
| 2026-09-06 | **Phase 4 kicked off, scoped to Increment 1** (rate engine + invoice auto-computation) via an explicit user choice among three offered scopes — the full Blueprint Phase 4 line (rate engine + ITC + GSTR-1/3B/9/9C) was NOT attempted in one pass, unlike Phase 2/3, since it's real tax logic across several independently-sized sub-systems. GST rates reuse `core-rules-engine` exactly like vendor TDS: new `ruleType` = `GST_RATE_<hsnSacCode>`, `jurisdiction: null` (rates don't vary by state), versioned so a rate change is a new dated row, never an edit in place. New `core-gst-engine` package (filled the Phase 0 stub) owns rate resolution/admin CRUD (`resolveGstRate`/`createOrUpdateGstRate`/`listGstRates`/`listActiveGstRates`), the pure place-of-supply split function `computeGstSplit`, its own ledger seeding (`seedGstLedgers`/`getGstLedgerIds`), permissions (`GST.MANAGE_RATES`/`GST.VIEW_REPORTS`), and a `computeGstSummary` report built on the existing `computeLedgerBalances` helper (same "one correct shared helper, thin views on top" pattern as Trial Balance/P&L/BS). | 4 |
| 2026-09-06 | **Place-of-supply split: intra-state (company state_code == party state_code, OR either is null — the conservative default) → CGST+SGST 50/50; otherwise → IGST.** CGST is rounded first, SGST takes the remainder (`total - cgst`), same "absorb rounding on the last split" discipline as Phase 3's FIFO layer draws — the two halves always sum back to the exact total tax, never a paisa apart. A null company/party state code is treated as intra-state rather than erroring, since a real export/SEZ case (which genuinely should be zero-rated/IGST regardless of a missing state code) isn't modeled this pass — flagged as a known simplification, not silently assumed correct. | Verified end-to-end: an intra-state sale splits 18% into exactly 9%+9% with no rounding drift; an inter-state sale posts the full rate as IGST only; a rate change via the admin function leaves a prior invoice's posted amounts untouched while the next invoice picks up the new rate with zero code changes (the Blueprint's literal Phase 4 exit criterion). | 4 |
| 2026-09-06 | **Input GST needed a brand-new "Input Tax Credit" account group under Current Assets** (`seedGstLedgers`, `core-gst-engine`) — NOT lumped into the existing "Duties & Taxes" group (Current Liabilities) that output GST (`CGST/SGST/IGST/Cess Payable`) and vendor TDS both already use. | Input tax (paid on purchases, recoverable as future credit) is economically an asset, not a liability — posting it into a LIABILITY-nature group would misclassify recoverable GST on the Balance Sheet the moment a purchase used it, a real correctness bug, not a cosmetic one. No existing Current Assets sub-group (Cash-in-Hand/Bank Accounts/Sundry Debtors) fit, so this is a genuinely new group rather than a reuse. Full ITC eligibility/reversal (Section 17(5) blocked credits, matching against GSTR-2B) is explicitly NOT built this pass — these ledgers just correctly capture and classify the amounts; using them to net against output liability at return time is tracked as an Open Question. | 4 |
| 2026-09-06 | **`DocumentLineInput` gained an optional `hsnSacCode` field, mutually exclusive with the existing manual `taxLedgerId`/`taxAmount` pair** (enforced in `lineValidation.ts` — supplying both throws). A line with neither posts with no tax, exactly as before this phase (regression-safe). `createSalesInvoiceInTransaction` gained a `systemDb` parameter it didn't need before (sales never needed a system-DB lookup pre-Phase-4; purchase already had one for TDS) — its signature, `createSalesInvoice`'s, and `convertSalesOrderToInvoice`'s all changed to match, mirroring the purchase side exactly. Both `sales_invoice_line`/`purchase_invoice_line` gained four new amount columns (`cgst_amount`/`sgst_amount`/`igst_amount`/`cess_amount`, all `NOT NULL DEFAULT 0`) rather than reusing the existing single `tax_ledger_id`/`tax_amount` pair, since one line can generate up to three simultaneous postings (CGST+SGST, or IGST, plus cess) that the old single pair can't represent; `hsn_sac_code`/`gst_rate_basis_points`/`cess_rate_basis_points` are also stored on the line for audit/display (rate as basis-points integers, not a float — same "integers, never REAL" discipline as money/quantity elsewhere in this schema). New migration `008_gst.ts` — schema-only, no ledger seeding (that stays in `core-gst-engine`, called at company creation, same pattern as every other module). | A caught-and-fixed correctness gap during implementation, not found by testing afterward: `listSalesInvoices`/`listPurchaseInvoices`'s `taxAmount` aggregate originally summed only the old `tax_amount` column, which would have silently UNDER-reported the tax total (missing the new GST columns entirely) for any GST-computed invoice — fixed to `SUM(tax_amount + cgst_amount + sgst_amount + igst_amount + cess_amount)`, safe precisely because the two paths are mutually exclusive per line. `hsnSacCode` was also added to `sales_order_line`/`purchase_order_line` and threaded through both order-to-invoice mapper functions — the exact spot Phase 3's design review flagged as easy to miss (a mapper that doesn't forward unknown fields silently drops them) — verified by converting an order with an HSN/SAC line and confirming the resulting invoice line carries the correct GST split. | 2, 4 |
| 2026-09-06 | **GST reversal needed zero new code** — cancelling a GST-computed invoice already works correctly through `core-accounting`'s existing generic `cancelVoucherInTransaction`, which reverses every `voucher_line` row (mirror-image debit/credit) regardless of which ledgers they touch. | Confirmed rather than assumed: verified end-to-end that cancelling an intra-state sale credits CGST/SGST Payable back to exactly zero and cancelling a purchase debits CGST/SGST Input back to exactly zero, with no GST-specific reversal logic needed — the same "Trial Balance needed zero changes to support cancellation" pattern already seen in Phase 1's voucher cancellation. | 1, 4 |
| 2026-09-06 | **Same-day follow-up, user-requested**: the 5-example GST rate seed expanded into a ~54-code, 14-category general-purpose starter catalog (Groceries & Staples, Hardware & Tools, Electrical & Electronics, Food & Bakery, Textiles & Apparel, Furniture, Stationery & Books, Pharma & Healthcare, Agriculture Inputs, Automobiles & Parts, Services (general), Hotel & Restaurant, Sin/Luxury Goods, Precious Metals) — user's own framing was "so if I sell to different businesses they can add their own rate instead of keeping all as 18%." `category`/`description` are new **optional** fields on `GstRatePayload` (no migration — they just ride inside the existing JSON payload already stored in `rule_set`) — pure browsing metadata with zero compliance meaning; the HSN/SAC code + rate are still the only things ever posted to an invoice. New `GstHsnPicker.tsx` (category dropdown → filtered code dropdown, showing "code — description (rate%)", with a "type manually" escape hatch) replaces the bare HSN/SAC text field in Manage Items and the invoice line editor. User explicitly required rates stay editable for future tax changes — unchanged: `createOrUpdateGstRate` still versions by effective date (a rate change is a new dated row, old ones stay on record for historical invoices), and `ManageGstRatesScreen` gained an "Edit" button per row that pre-fills the form (including category/description) so a future change is a quick edit, not a from-scratch re-entry. | Deliberately used 4-digit HSN/SAC *headings* rather than guessing precise 8-digit sub-codes — broader and lower error risk, still fully overridable to a more specific code later. A real bug was caught before it shipped: two draft entries (plain bread / cakes) both used HSN heading 1905, which would have silently overwritten one with the other (`ruleTypeFor` keys purely on the code, and `createRuleSetVersion` supersedes any existing open-ended row for the same key) — merged into one "Bakery products" entry with a note flagging the plain-bread-is-often-Nil nuance, verified with an explicit duplicate-code regression check. Several catalog entries are flagged with an inline note where the real GST rule has a threshold/scheme nuance this single flat rate collapses (restaurant/hotel ITC-dependent slabs, apparel per-piece value bands, GTA's ITC-option-dependent rate) — same "collapsed to one representative rate, CA review required" disclaimer pattern as the original TDS/GST examples, not silently presented as exact. Verified end-to-end (12 checks): catalog breadth (≥50 codes, ≥10 categories), zero duplicate-code collisions, category/description round-tripping through `listActiveGstRates`, a category-picked code resolving correctly through the unchanged `resolveGstRate`/`computeGstSplit` engine, and editing an existing catalog rate correctly creating a new version (old rate still queryable) while preserving category/description — plus a full re-run of the original Phase 4 end-to-end suite (18 checks) confirming zero regression to invoice posting/cancellation/rate-change-simulation. | 4 |

| 2026-09-06 | **Phase 4 Increment 2 (same session): user asked to "complete Phase 4" before moving to Phase 5.** Offered a scope choice (ITC+GSTR-1/3B only, vs. everything including GSTR-9/9C+composition+reverse charge, vs. just ITC) — user chose everything in one pass. Scoped and designed in plan mode (financial-logic gate) before writing code, given the size (comparable to a full Phase 2/3 build, not a small follow-up). | Recorded rather than assumed: the Blueprint's one-line Phase 4 scope literally lists ITC and GSTR-1/3B/9/9C, so "complete Phase 4" was read as building all of it — but GSTR-9/9C's annual-reconciliation shape genuinely differs from a period return, so this was confirmed explicitly rather than silently expanded. | 4 |
| 2026-09-06 | **ITC eligibility decides WHERE a purchase line's GST lands, never WHETHER it's owed to the supplier.** New `purchase_invoice_line.itc_eligible` (default true) + `itc_ineligibility_reason` (migration `009_gst_itc_rcm.ts`). Eligible → existing behavior (Input GST ledger, recoverable asset). Ineligible (Section 17(5), or the company itself is on the composition scheme) → the same GST amount folds into the line's own expense/stock ledger debit instead — becomes cost, the correct accounting treatment for blocked credit. Either way it still counts toward the invoice's `taxAmount`/what's credited to the supplier, since they charged it regardless of whether it's later claimable. | The alternative (still posting to Input GST but excluding it from the ITC/set-off calculation) would leave a permanently-unreconciled balance sitting in an asset ledger with no real path to zero — folding it into cost is what actually happens to blocked credit in real bookkeeping. Verified end-to-end: an eligible and a blocked line on the SAME invoice route to different ledgers for the identical resolved GST amount, and the party's payable total is unaffected by which path was used. | 4 |
| 2026-09-06 | **Reverse charge (RCM) is modeled as a self-balancing pair excluded from the party's payable, not as a modification to the invoice total.** New `is_reverse_charge` on both `sales_invoice_line` and `purchase_invoice_line`. Seller side: zero output tax posted (the recipient self-assesses), but the line still resolves and stores its GST split for HSN/GSTR-1 "reverse charge" reporting. Buyer side: the resolved GST posts Dr Input GST (or the line's own ledger, if ineligible) / Cr new RCM Liability ledger (4 new ledgers — `seedGstLedgers` extended, kept separate from the existing output Payable ledgers so "collected from customers" and "self-assessed under RCM" don't conflate in GSTR-3B, which reports them in different table rows) — for the SAME amount, so it never touches `taxAmount`/the supplier's payable balance, since they never charged it. | This was the trickiest design point, caught in plan-mode review before coding: a naive implementation would either inflate what's owed to the supplier (wrong — they didn't collect this) or skip posting the self-assessment entirely (wrong — the liability and credit are both real GL events). Verified end-to-end: an RCM purchase's supplier ledger balance equals EXACTLY the taxable value (GST fully excluded), while Input GST and RCM Payable both move by the identical amount; an RCM sale posts zero to any Payable ledger while still storing the informational tax split on the line. | 4 |
| 2026-09-06 | **Composition scheme is a company-level setting** (new system-DB migration `008_gst_registration_type.ts`, `company.gst_registration_type` — `'REGULAR' \| 'COMPOSITION'`, closed vocabulary validated in application code). Set only at company creation (`CreateCompanyScreen`); changing it afterward is explicitly out of scope this pass. On the sales side, `resolveLineGstList`'s output is zeroed (CGST/SGST/IGST/Cess all forced to 0) rather than skipped — the HSN/SAC code and resolved rate are still stored (real composition returns are HSN-wise too), only the tax amounts collapse to zero. On the purchase side, ITC eligibility is forced false for every line regardless of what the line itself requests, since a composition dealer can never claim input credit. | A composition dealer legally cannot collect GST from customers or claim ITC — this is a fundamentally different tax treatment, not a rate variation, so it's modeled as a company-wide override applied at the two existing decision points (GST computation, ITC eligibility) rather than a parallel posting path. Deliberately NOT built: the composition dealer's own flat-rate liability on turnover (a separate quarterly CMP-08-style self-payment) — flagged as an Open Question, same treatment as vendor-TDS-form-generation in Phase 2. Verified end-to-end: a composition company's sales line posts zero tax despite a configured non-zero catalog rate (HSN still recorded), and a composition company's purchase line is forced ITC-ineligible even when the line itself requests `itcEligible: true`. | 4 |
| 2026-09-06 | **`computeGstSetOff` (new, pure function in `core-gst-engine`) implements the standard textbook GST credit set-off order**: IGST credit → IGST liability, then spills into CGST, then SGST; CGST credit → CGST liability first, spillover into IGST; SGST credit → SGST liability first, spillover into IGST; Cess never cross-utilizes. Explicitly NOT the fully optimal cash-minimizing algorithm the real rule allows some discretion for (how IGST credit splits between CGST/SGST) — flagged in its own doc comment as "verify against an actual GSTR-3B before relying on this for a real filing," same disclaimer pattern as every other simplified tax rule in this codebase. RCM's self-assessed liability is deliberately NOT run through this set-off — it's reported as a separate "must be paid in cash, not eligible for set-off this period" figure, a real statutory restriction, not an oversight. | Verified end-to-end with a hand-computed scenario (IGST credit exceeding IGST liability, spilling into both CGST and SGST liability with an exact carry-forward remainder) and cross-checked that GSTR-3B's own `netPayable` field matches calling `computeGstSetOff` independently with the same period's figures. | 4 |
| 2026-09-06 | **GSTR-1/3B/9/9C prep implemented as `core-sales-purchase/src/gstReturns.ts`** (not `core-gst-engine`, since it needs to join `sales_invoice_line`/`purchase_invoice_line`/`business_party`, which `core-gst-engine` has no knowledge of) — modeled on `settlements.ts`'s existing join shape. Only invoice lines with an `hsn_sac_code` (the GST-computed path) are included; a line still using the pre-Phase-4 manual `tax_ledger_id`/`tax_amount` path has no resolved rate/HSN to classify by and is excluded — a real, explicitly flagged scoping limit. GSTR-1: B2B (party has a GSTIN) invoice-wise, B2C (no GSTIN) state+rate summary, HSN-wise summary across both — mirrors the real return's own structure rather than one flat invoice list. GSTR-9 reuses GSTR-3B's exact aggregation logic over a full financial year (`computeFinancialYearDateBounds`, new inverse of the existing `computeFinancialYearLabel` in `core-accounting`) instead of a parallel implementation; Part V (prior-year amendments declared in a later year's return) is not modeled since this app has no return-period concept separate from an invoice's own date. GSTR-9C compares turnover per audited books (`computeProfitAndLoss`'s total income) against turnover per GST returns (GSTR-1's taxable value sum) — a genuine reconciliation, since the two are drawn from independently-sourced aggregations and a gap is expected (non-GST income like interest has no HSN/SAC). The tax-side of GSTR-9C is explicitly informational only, NOT a two-source reconciliation — this app has no bookkeeping source for "tax as per books" independent of the return data itself, and presenting a fake second figure that would always trivially match was rejected as dishonest output. | User confirmed (after being offered the alternative) that these should be CA-facing reference reports — on-screen tables plus a plain CSV export via the same native-save-dialog pattern as `backupCompany` — not an attempt to match the GST portal's exact upload-ready JSON schema, which is separate, precision-heavy work with real downside risk if a field is subtly wrong and someone trusts it as upload-ready. Verified end-to-end: B2B/B2C classification splits correctly on GSTIN presence, HSN summary aggregates correctly across both, GSTR-9's FY aggregation matches an independent direct GSTR-3B call over the same computed date bounds, and GSTR-9C's reconciliation gap correctly reflects a real non-GST "Interest Income" journal entry with no corresponding sales invoice. | 4 |

| 2026-09-06 | **Phase 5 (Banking) kicked off and completed in one pass.** The Blueprint's entire spec for this phase is one line ("Bank accounts, reconciliation, cheque/UTR tracking," exit criterion "Bank rec matches ledger to the paisa") — this plan was designed against standard Indian-SME bank-rec practice and confirmed with the user before coding (financial-logic gate). The user was explicitly asked whether bank-statement CSV import should be in scope for this pass (vs. manual tick-off only) and chose **both** — the importer described below was built as real, working functionality as a result, not deferred. | 5 |
| 2026-09-06 | **New `bank_account` master, own dedicated ledger under the pre-existing "Bank Accounts" group (seeded since Phase 1), created atomically** — same pattern as Phase 2's `createParty` (one `companyDb.transaction()` inserting `ledger_account` + `bank_account` + an audit-log entry). No new default account groups needed. New pure-TS `core-banking` package (Nx `type:core` tag, zero Electron/UI dependency, same boundary as every other module) owns this plus everything else in this phase. | 5 |
| 2026-09-06 | **Cheque/UTR tracking is an optional 1:1 attachment on a voucher** (`voucher_payment_instrument`), not a new voucher type — `VOUCHER_TYPES` is unchanged. New `recordVoucherWithInstrument` (wraps `core-accounting`'s existing `createVoucherInTransaction` + the instrument insert in ONE transaction, Rule #4) is the single entry point the Payment/Receipt/Contra screens now call, degrading to a plain voucher post when no instrument is given — one code path regardless of whether a bank ledger is involved, rather than two parallel ones. | 5 |
| 2026-09-06 | **Bank reconciliation is a pure metadata/tracking layer** (`bank_reconciliation`, keyed by `voucher_line_id`, rows created lazily only when first ticked) — marking a line reconciled NEVER touches `voucher`/`voucher_line`; the reconciliation statement is a read-only reconstruction on top of `core-accounting`'s existing `computeLedgerBalances` (Book Balance → + uncleared payments (unreconciled credit lines) → − uncleared receipts (unreconciled debit lines) → = Calculated Bank Balance). **Every voucher_line on the bank ledger is reconcilable, regardless of voucher type** — a plain JOURNAL entry (bank charges, interest) moves the bank ledger just as much as a Payment/Receipt does, and the exit criterion's literal wording ("bank rec matches ledger") covers all of it, not just instrument-carrying vouchers. Verified: the sign convention (bank ledger `credit_amount > 0` = money out, `debit_amount > 0` = money in) was confirmed by reading the Payment/Receipt/Contra screens' own line construction, not assumed. | 5 |
| 2026-09-06 | **CSV bank-statement import**: new `bank_statement_import`/`bank_statement_line` tables; a small dependency-free RFC4180 CSV parser (`parseBankStatementCsv`) plus user-driven column mapping (`mapStatementRows` — handles both common Indian-bank CSV shapes: a single Amount+Dr/Cr column, or separate Withdrawal/Deposit columns) live in `core-banking` as pure functions; file reading and the native open-file dialog stay in the Electron main process (`bankingHandlers.ts`), matching the existing `backupCompany` dialog pattern — Rule #1's Electron-free boundary applies to the parsing/matching logic, not file I/O. Matching (`suggestMatches`) is **exact-amount-in-paise** (never fuzzy — "to the paisa" is the whole point of this phase) and direction-aware within a ±7-day window; exactly one candidate auto-reconciles, multiple candidates are left for manual pick, zero candidates are surfaced as a genuine unmatched diagnostic (e.g. an uncaptured bank charge) rather than hidden. A likely-duplicate re-import (same account/date/amount/description as an existing line) is flagged, never silently blocked, since legitimate repeats can occur. | 5 |
| 2026-09-06 | **Bank-statement direction terminology is the OPPOSITE sense of the ledger's own debit/credit convention, and this is encoded explicitly everywhere it matters, not left implicit.** A bank's own CSV/statement calls a deposit into the account a "CREDIT" and a withdrawal a "DEBIT" (the bank's point of view) — this maps to OUR ledger's `debit_amount` (money in) and `credit_amount` (money out) respectively, the reverse pairing from what the words might suggest. Every function that crosses this boundary (`mapStatementRows`, `findMatchCandidates`) carries an explicit code comment cross-referencing this, since it is the single easiest place to introduce a silent, hard-to-notice reversal bug in a reconciliation feature. | 5 |
| 2026-09-06 | **`better-sqlite3` boolean-column comparison in a WHERE clause** needed the same `1 as unknown as boolean` / `0 as unknown as boolean` typed-constant workaround already established in `core-sales-purchase`'s `gstReturns.ts`/`receivablesPayables.ts` (better-sqlite3 cannot bind a raw JS boolean as a query parameter, but Kysely's generated `ColumnType` Select-side type for these int-backed boolean columns is `boolean`) — applied to `bank_reconciliation.is_reconciled` in `reconciliation.ts`/`statementImport.ts`'s unreconciled-line queries. Not a new pattern, just a new call site for an existing one. | 5 |

| 2026-09-06 | **Phase 6 (Expenses, Travel, Documents) kicked off and completed in one pass.** The Blueprint's entire spec is one line ("Expense/travel workflows, reimbursements, document attachment + search," exit criterion "Every transaction type can carry an attached document") — same one-liner situation as Phase 5. Three design forks were resolved with the user via `AskUserQuestion` before coding (financial-logic gate): (1) build a new lightweight `employee` master now rather than wait for Phase 7 Payroll — Phase 7 will extend this same table with CTC/salary fields later rather than building a parallel concept; (2) store attached files as BLOBs inside the encrypted company DB rather than separate on-disk files — inherits SQLCipher's encryption for free and needs zero changes to `backupCompany`'s existing whole-file backup; (3) travel is just another expense-claim line category this pass, no separate pre-trip advance/disbursement workflow. | 6 |
| 2026-09-06 | **`employee` gets its own dedicated ledger, created atomically** — same pattern as Phase 2's `createParty`/Phase 5's `createBankAccount`. Its ledger sits under a brand-new "Employee Reimbursements Payable" account_group (LIABILITY nature, under Current Liabilities) — an employee reimbursement is a liability (the company owes the employee) until paid, the opposite economic direction from an expense, so it can't be lumped into an EXPENSE-nature group. Seeding this new group directly mirrors `core-gst-engine`'s `seedGstLedgers`, which already established the precedent (its own "Input Tax Credit" group under Current Assets) of a later-phase package inserting a brand-new `account_group` row — confirmed by reading that code before assuming it was acceptable, not asserted. | 6 |
| 2026-09-06 | **No new "expense category" concept was built** — an expense claim line just picks an existing EXPENSE-nature `ledger_account`, exactly like `purchase_invoice_line.expense_ledger_id` already does. Since `chartOfAccounts.ts`'s default groups seeded zero default EXPENSE ledgers, a new `seedExpenseLedgers` (required, not optional, called at company creation) adds five common ones (Travel & Conveyance, Staff Welfare, Office Supplies, Communication Expenses, Miscellaneous Expenses) under the pre-existing "Indirect Expenses" group. | 6 |
| 2026-09-06 | **Expense claim lifecycle mirrors `core-sales-purchase`'s order state-machine pattern almost exactly** (`transitionStatus` helper validating legal `from`/`to` transitions, same as `confirmSalesOrder`/`cancelSalesOrder`): DRAFT→SUBMITTED (no GL impact) →APPROVED (posts a real new `EXPENSE_CLAIM` voucher — added to `core-accounting`'s `VOUCHER_TYPES`, no other change needed since its validation is already generic against the array — `Dr` each line's expense ledger, `Cr` the employee's ledger for the total: this is the accrual, mirroring exactly how a Purchase Invoice creates a payable) →REIMBURSED (a separate `PAYMENT` voucher via a new `expense_claim_settlement` table, an exact mirror of the existing `sales_invoice_settlement`/`purchase_invoice_settlement` bill-wise settlement tables, partial reimbursement supported). REJECTED is only reachable pre-approval (nothing was posted yet, so nothing needs reversing). | 6 |
| 2026-09-06 | **New settlement-aware cancellation guard for expense claims** (`cancelExpenseClaim`: an APPROVED claim can be cancelled — reversing its voucher via the existing `cancelVoucherInTransaction` — only if it has ZERO `expense_claim_settlement` rows; any reimbursement recorded blocks cancellation outright). This is genuinely new logic with no existing precedent in this codebase to mirror (`cancelSalesInvoice`/`cancelPurchaseInvoice` only guard against stock movement, not prior settlements) — consistent with, but not copied from, Phase 3's "guard, don't half-build reversal" philosophy for stock-linked invoice cancellation. Flagged as a known inconsistency with the older Phase 2 cancellation functions, not retrofitted onto them in this pass (out of scope). | 6 |
| 2026-09-06 | **Reimbursement composes `core-accounting`'s `createVoucherInTransaction` + `core-banking`'s `attachPaymentInstrumentInTransaction` directly inside its own transaction, NOT via `core-banking`'s `recordVoucherWithInstrument`** — that function opens its own transaction and has no hook for inserting the `expense_claim_settlement` row, which must commit atomically with the voucher and the status flip (Rule #4). A Plan agent caught this during design validation (the original sketch assumed `recordVoucherWithInstrument` was directly reusable); confirmed by reading its actual implementation before building against it. | 6 |
| 2026-09-06 | **Generic, entity-agnostic document attachment — new `core-documents` package, deliberately with zero dependency on `core-accounting`.** `document_attachment` has a free-string `entity_type`/`entity_id` pair (same convention as `audit_log.entity_type`), so any current or future record is attachable with zero schema changes — this is what actually satisfies "every transaction type can carry an attached document," not pre-wiring the UI onto every existing screen. Files are stored as BLOBs (`file_data`, the first `'blob'`-typed column in this schema) — confirmed working via a real byte-for-byte round-trip in the verification script, not assumed from general `better-sqlite3` knowledge. A generic `AttachmentsPanel` React component was wired into a representative set of screens (Expense Claim register, Voucher Register, both invoice registers, Parties, Bank Accounts) as an expandable per-row section; extending it to any further screen is the same few-line addition, tracked as a UI-completeness gap in Open Questions, not a missing capability. Search (`searchDocuments`) is a plain `LIKE` match over filename/description — explicitly NOT full-text content extraction or OCR. | 6 |

| 2026-09-07 | **Phase 7 (Payroll) built in full scope in one pass — the user explicitly chose this over the GST-style Increment-1/Increment-2 split** offered as a recommended alternative. All of employee payroll profile, CTC/salary structure, statutory deductions (PF/ESI/PT/salary-TDS), attendance, leave, payroll runs, and gratuity shipped together. | 7 |
| 2026-09-07 | **`employee` (Phase 6) is extended with payroll fields rather than duplicated** — resolves the gap Phase 6's own handoff flagged ("revisit once Phase 7's employee model exists"). A SECOND dedicated ledger, `salary_payable_ledger_id`, was added rather than reusing Phase 6's `ledger_account_id` (which stays scoped to expense reimbursements) — net salary payable and expense reimbursement are different economic obligations and would otherwise blend on one account. | 7 |
| 2026-09-07 | **Statutory applicability (PF/ESI/Gratuity) is headcount-driven and RuleSet-configurable, not assumed-always-on** — directly answers a real user question mid-session ("do shops under 5 employees fall under this?"): no, PF needs 20+ employees, ESI/Gratuity need 10+ (both real EPF/ESI/Gratuity Act thresholds), and neither PT nor salary TDS has a headcount gate at all. New `company_payroll_settings` (AUTO/ALWAYS/NEVER per scheme) — AUTO compares live headcount against the RuleSet threshold; Gratuity's AUTO is sticky (flips to ALWAYS permanently once crossed, encoding the Payment of Gratuity Act's own "once covered, stays covered" rule) so a later headcount drop can't silently turn it back off. | 7 |
| 2026-09-07 | **Salary TDS (Section 192): new-regime slabs are auto-computed from a RuleSet table; old regime is deliberately manual-entry-only, not auto-computed with a wrong number.** The user asked for "both" regimes supported — new regime has almost no exemptions to model, so a slab computation from gross salary alone stays meaningfully accurate; old regime depends on HRA actually paid, 80C/80D investments, home-loan interest, none of which this schema collects, so inventing a number would be actively misleading rather than a reasonable simplification (unlike GST's simplifications, which stay directionally correct). Either way the figure is user-overridable per payslip (`overridePayslipTdsAmount`). | 7 |
| 2026-09-07 | **Gratuity: both a monthly formula-based provisioning accrual AND a separation eligibility/formula calculator were built (user's explicit "do both")** — clearly labeled everywhere as a formula estimate (15/26 × last-drawn statutory wage base × rounded years of service), NOT an actuarial AS-15/Ind AS-19 valuation. Settlement pays directly out of the Gratuity Provision ledger (Dr Provision, Cr payment ledger) rather than through the employee's salary-payable ledger, since `recordSeparation`'s true-up adjustment voucher already reconciles the provision to exactly the formula amount owed before settlement runs. | 7 |
| 2026-09-07 | **Real deadlock bug found and fixed during verification**: `gratuityRecords.ts` called back into the outer `companyDb` handle from inside its own `companyDb.transaction()` callback (should have used `trx`) — this silently deadlocks Kysely's single-connection queue (the transaction holds the only connection; the nested query waits forever for one that will never free up). The awaiting promise never resolves, and since nothing else keeps Node's event loop alive, the process just exits silently — no crash, no error, no stack trace, exit code 0 — which is exactly why it wasn't caught by `build`/`lint` and needed a real end-to-end run to surface. Fixed by resolving ledger IDs before opening the transaction, the same pattern `postPayrollRun` already used correctly; grepped the rest of the codebase for the same anti-pattern and found no other occurrence. Worth remembering as a class of bug for future core-* work: never call the outer `Kysely` handle from inside its own open transaction's callback. | 7 |
| 2026-09-07 | **Phase 8 split into three increments** (user's explicit choice, offered as the recommended alternative to a Phase-7-style single pass, given six largely-independent sub-areas): Increment 1 = Fixed Assets + Cost Centres + Budgets (accounting-core extensions); Increment 2 = Multi-currency (full, including period-end revaluation and forex gain/loss — user's choice over entry-only) + Multi-branch; Increment 3 = Manufacturing (core BOM + a single consume-then-produce voucher, no work-order/WIP tracking — user's choice, explicitly deferrable to fuller tracking later if wanted). | 8 |
| 2026-09-07 | **Cost centres are a dimension tag on `voucher_line` (`cost_centre_id`, nullable), not a parallel ledger hierarchy.** A voucher still posts to the same `ledger_account` it always did; a cost centre is an optional second axis for reporting (a new cost-centre-wise P&L, `computeCostCentreSummary`) and for budgeting. Wired into Journal/Payment/Receipt voucher-entry screens; deliberately left off Contra, since a transfer between the business's own Cash/Bank ledgers isn't an expense/income event a department would own. | 8 |
| 2026-09-07 | **Budgets compare against actuals by re-querying `voucher_line` directly (`computeBudgetVsActual`), no separate "actual" table to keep in sync** — same "derive, don't duplicate" principle every other report in `core-accounting` already follows (Trial Balance/P&L/BS all re-derive from `voucher_line` too). A budget scoped to a specific ledger compares that ledger's own monthly movement (flipped positive for an INCOME-nature ledger so a revenue budget and its actual both read positive); a cost-centre-only budget (the more common department-budget case) compares that cost centre's total EXPENSE-nature spend for the month, not its own revenue attribution — deliberately not attempted this pass. | 8 |
| 2026-09-07 | **Fixed Assets: two genuinely independent depreciation books, both resolved via `core-rules-engine`, never hardcoded** — Companies Act Schedule II (`FIXED_ASSET.SCHEDULE2_RATE.<category>`: SLM or WDV method, strict day-count pro-ration from the date put to use, no `<180`-day threshold — that rule is IT-Act-specific) and Income Tax Act WDV block (`FIXED_ASSET.IT_WDV_BLOCK_RATE.<category>`: the real `<180`-days-in-year half-rate rule, applied only in an asset's own first year). SCHEDULE2 entries post a real `DEPRECIATION` voucher (Dr a shared "Depreciation" expense ledger, Cr that asset class's own accumulated-depreciation ledger); IT_WDV entries are memo-only (`voucher_id` stays null) — real WDV blocks are pooled by category, not GL-posted per asset, and this pass tracks each `fixed_asset` unit's IT_WDV book independently as a documented simplification rather than building true block-pooling. | 8 |
| 2026-09-07 | **Asset classes, not individual physical units, get their own dedicated gross-block and accumulated-depreciation ledgers** (`asset_class.gross_block_ledger_id` / `accumulated_depreciation_ledger_id`, created atomically with the class — same "own dedicated ledger" pattern as `business_party`/`bank_account`/`employee`). The individual-unit register lives in `fixed_asset` instead, keyed to its class. A ledger-per-physical-unit design (e.g. a separate ledger per laptop) would explode the chart of accounts for any business with many like-kind assets; a Balance Sheet showing "Computers — Rs 5,00,000" as one line, not fifty, matches real Indian accounting practice. Disposal correctly removes only that ONE asset's own share of the shared ledgers (its own accumulated depreciation total from `asset_depreciation_entry`, its own original cost), not the whole class balance. | 8 |
| 2026-09-07 | **New `ASSET_ACQUISITION`/`DEPRECIATION`/`ASSET_DISPOSAL` voucher types added to the existing shared `VOUCHER_TYPES` list** — same mechanism as every prior phase's additions (`EXPENSE_CLAIM`, `PAYROLL`, `GRATUITY_PROVISION`), a plain `as const` array validated in application code, not a DB CHECK. Disposal computes a Profit/Loss on Sale of Assets plug line (Dr for a loss, Cr for a gain) so the voucher always balances by construction — Sale proceeds + Accumulated depreciation removed vs. Gross block removed, with the residual being the gain/loss, standard fixed-asset-disposal accounting mechanics. | 8 |
| 2026-09-07 | **Phase 8 Increment 2 kicked off same session as Increment 1's handoff — two more real scope forks surfaced via AskUserQuestion before planning, both resolved toward the more involved option**: (1) branches get their own dedicated "Inter-Branch Current Account" ledger, not a bare dimension tag — a real branch-accounting current-account mechanism (over the simpler "dimension tag only, no new transfer mechanism" alternative); (2) ALL voucher types get FX support (Journal/Payment/Receipt/Contra as well as Sales/Purchase invoices), not just invoices (over "invoices + FX bank accounts only"). Both decisions materially increased the increment's size versus the minimum viable version. | 8 |
| 2026-09-07 | **The FX primitive (`foreignCurrency`/`foreignAmount`/`exchangeRateMicros`) lives directly on `voucher_line` inside `core-accounting`, not in a new package** — because every voucher type needs it (per the scope decision above), it has to live in the shared engine itself, the same relationship `cost_centre_id` has to the voucher engine. `convertForeignToBase` (BigInt, half-up rounding) is the ONLY place a foreign amount becomes a base-currency amount — a plain `Number` multiplication of a paise-scale amount by a micros-scale rate can exceed `Number.MAX_SAFE_INTEGER` for large real invoices, which is exactly the class of float bug CLAUDE.md's "paise, never REAL/float" rule exists to prevent. Its exact inverse, `foreignAmountForBase`, exists specifically so a single aggregate voucher_line (e.g. an invoice's own party-ledger line, which represents the WHOLE invoice total rather than one entered foreign amount) can still carry a foreign-amount tag that round-trips exactly through the same validation. | 8 |
| 2026-09-07 | **Exchange rates reuse `core-rules-engine`'s existing RuleSet mechanism as-is — zero changes to that package** (`rule_type = 'FX_RATE.<CCY>'`, jurisdiction always null). The same date-effective versioned lookup GST/TDS/Payroll rates already use is exactly "what was the USD rate on this historical date" — no new mechanism was needed, only a new payload shape and a thin wrapper package. `core-multi-currency` (new, parallel to `core-fixed-assets`) owns that wrapper plus period-end revaluation and realized/unrealized gain-loss math — genuinely large/independent enough to warrant its own package, unlike branches (below). | 8 |
| 2026-09-07 | **Branches stay inside `core-accounting`, alongside cost centres/budgets — NOT a new package**, despite getting a dedicated ledger (unlike cost centres). The addition is the same size/shape as cost centres/budgets (a dimension + a report + one transaction-recording function), just with one extra atomic-ledger-creation step — architecturally nothing like Fixed Assets' or Multi-Currency's independent surface. Branch tagging applies to Contra vouchers too (unlike cost centres, which are deliberately P&L-only and skip Contra) — a branch is a balance-sheet dimension as well as a P&L one, so a branch's own Cash/Bank movement still matters even on a pure internal transfer. | 8 |
| 2026-09-07 | **Inter-branch transfers need no elimination logic anywhere for the whole-company consolidated report to be correct** — `recordInterBranchTransfer` posts one balanced 4-line voucher per transfer (Dr source branch's Inter-Branch Current A/c / Cr source ledger, Dr destination ledger / Cr destination branch's Inter-Branch Current A/c). Because every such voucher is balanced by construction, the two branches' Inter-Branch ledger balances always net to exactly zero in aggregate — the existing whole-company `balanceSheet.ts`/`profitAndLoss.ts` (completely unchanged) is already the correct consolidated report, the same "ties out because it's the same underlying voucher_line sum" property cost-centre reports already relied on. | 8 |
| 2026-09-07 | **A new branch-wise Balance Sheet (`computeBranchBalanceSheet`) carries every ledger's opening balance in an explicit "Head Office / Unassigned" bucket, rather than dropping it or guessing an attribution** — `ledger_account.opening_balance` predates branch tagging entirely, so it genuinely can't belong to any one branch. Summing every branch's totals plus the HO/Unassigned bucket reproduces the exact same figures as the whole-company Balance Sheet — the literal, honest form of the Blueprint's "consolidated multi-branch reports tie out" exit criterion for Phase 8, not a hand-wave. Branch-wise P&L needed no equivalent bucket, since P&L never carries an opening balance across periods in the first place. | 8 |
| 2026-09-07 | **Realized gain/loss at invoice settlement extends `core-sales-purchase`'s existing `recordSalesReceipt`/`recordPurchasePayment` in place, rather than forking new FX-aware functions** — consistent with those functions' own existing doc comment ("additive, not a parallel path"). The party ledger clears at the invoice's ORIGINAL booked base-currency value (so AR/AP is unaffected by rate movement); the deposit/payment ledger moves the ACTUAL settlement-day base-currency amount; the difference posts as one extra line to a new "Realized Forex Gain/Loss" ledger on the SAME settlement voucher — no new voucher type needed. Kept separate from "Unrealized Forex Gain/Loss" (period-end revaluation's ledger) since realized-vs-unrealized is a real CA-relevant distinction for the financial statements. | 8 |
| 2026-09-07 | **Verification caught and fixed two real correctness bugs in the FX mechanism, both before commit** (throwaway tsx script, 24 checks): (1) a settlement voucher's party-ledger line wasn't tagged with the settled invoice's own foreign currency/booking rate — a base-currency-only credit/debit line — so a fully-settled FX invoice's foreign exposure kept showing as still-open to a later period-end revaluation. Fixed by splitting the party-ledger settlement line per-FX-invoice (each one tagged with that invoice's own booking rate, satisfying the same round-trip validation) instead of one combined base-currency-only line, in a new shared `buildPartyLedgerLines` helper used by both settlement functions. (2) A revaluation run's own adjustment line deliberately CANNOT carry FX tags (it's a pure valuation change of an unchanged foreign balance, not a new FX transaction, so it can't satisfy voucher_line's "debit/credit must equal foreignAmount x rate" invariant) — which meant a second run on the same date forgot the first run's effect entirely and reapplied the same adjustment (breaking the depreciation-style idempotency requirement). Fixed by having `findFxExposures` fold in the durable `fx_revaluation_line` audit trail's cumulative prior adjustments per (ledger, currency), rather than relying solely on voucher_line's own FX tags for `baseBalanceBefore`. | 8 |
| 2026-09-07 | **Phase 8 Increment 3 (Manufacturing) scope taken literally from the user's own words: "core BOM + a single consume/produce voucher."** New pure-TS package `core-manufacturing` (depends on `core-accounting` + `core-inventory`, same `type:core` boundary as `core-fixed-assets`/`core-multi-currency`) — not folded into `core-inventory`, since it's a genuinely separate concept (a recipe + a compound stock+GL transaction) even though it leans entirely on inventory's existing valuation machinery. No work-order/WIP-tracking layer, no multi-level BOM explosion, no overhead/conversion-cost absorption, no cancellation/reversal — all explicitly out of scope for this pass, not oversights (see Open Questions). | 8 |
| 2026-09-07 | **A BOM (`bill_of_material`) carries exactly one ACTIVE version per output item — append-only supersede-on-new-version, same pattern as `salary_structure`/`asset_class`.** Creating a new BOM for an item that already has an active one deactivates the old one atomically, in the same transaction — never edited in place, and never DB-constrained (no partial unique index), since the single write path (`createBillOfMaterial`) is the only place a BOM is ever created. No multi-level explosion: a component that is itself the output of another BOM is not auto-expanded into ITS components — a deliberate simplification consistent with "core BOM," not full multi-level manufacturing. | 8 |
| 2026-09-07 | **The consume/produce operation reuses `core-inventory`'s existing FIFO-layer and weighted-average functions as-is (`consumeFifoLayersInTransaction`/`createFifoLayerInTransaction`/`computeWeightedAverageIssueCost`), not a parallel manufacturing-specific valuation path.** Each BOM component is consumed exactly like a sales issue — real historical cost, never a re-estimated "current" cost — with two new movement types (`MANUFACTURING_CONSUME`/`MANUFACTURING_PRODUCE`) added to the existing `MOVEMENT_TYPES`/`INBOUND_MOVEMENT_TYPES`/`OUTBOUND_MOVEMENT_TYPES` lists in `core-inventory/types.ts`, the same mechanism every prior movement type already uses — so `computeStockPosition`/`computeCumulativePosition` (weighted-average's own on-the-fly cost basis) pick the two new types up automatically, with no per-report special-casing anywhere. | 8 |
| 2026-09-07 | **The produced output is valued at exactly the sum of its components' consumed cost — no overhead/conversion-cost or wastage/scrap absorption this pass** — a deliberate, explicitly-flagged simplification (not silently dropped), consistent with "core" scope. A future pass wanting labour/overhead absorption or a yield-loss allowance would extend this same total-cost computation, not restructure it. | 8 |
| 2026-09-07 | **The `MANUFACTURING_JOURNAL` voucher Drs and Crs the SAME Stock-in-Hand ledger for the produced amount — net GL/TB impact is zero by construction, the identical precedent `transferStockInTransaction` already established for a warehouse-to-warehouse stock transfer (which posts no voucher at all, since it's the same ledger, same value).** The difference here: manufacturing still gets a REAL voucher (its own number, in the Voucher Register/Day Book), because it's a distinct financial event — a recipe was consumed and a different item was produced — worth its own audit trail entry, unlike a mere relocation. This mirrors Tally's own "Manufacturing Journal" concept: a real voucher type, but a self-canceling GL entry in its basic (no-additional-cost) form. | 8 |
| 2026-09-07 | **Cancellation/reversal of a posted manufacturing journal is deliberately out of scope this pass** — unlike every other stock-affecting transaction in this codebase (Stock Adjustment, Sales/Purchase issues, Transfers), which all support a reversal path via `stockReversals.ts`'s existing 4 reversal movement types. Adding it here would need two more reversal movement types (`MANUFACTURING_CONSUME_REVERSAL`/`MANUFACTURING_PRODUCE_REVERSAL`) plus real changes to `stockReversals.ts` itself — genuine additional work, not a one-line addition, so it's flagged rather than attempted in the same pass as "core BOM + a single voucher." | 8 |

## 3. Open Questions / Blockers

Track anything unresolved so it surfaces automatically in the next session instead of being forgotten.

- [x] Prisma + SQLCipher compatibility spike — **done 2026-09-05, resolved: not compatible, Kysely fallback adopted** (see Key Decisions Log)
- [x] System/Company DB key management — **done 2026-09-05, resolved: safeStorage + per-user AES-256-GCM key wrap** (see Key Decisions Log)
- [ ] Team allocation (internal vs. KoodaldigiXS trainees vs. hire) — pending
- [ ] White-label/reseller legal agreement — pending
- [ ] CA/compliance advisor retained on standing basis — pending
- [ ] `safeStorage.isEncryptionAvailable()` was only exercised on this Windows dev machine (DPAPI). Linux without a keyring daemon (headless/CI, some minimal desktop environments) will make it return false, and the shell currently just refuses to start rather than offering a fallback — revisit before targeting Linux.
- [x] Password-reset / recovery gap — **done 2026-09-05, resolved in two parts: (1) company-wide recovery key at company creation, (2) offline Super Admin reset via a new `SYSTEM.RESET_USER_PASSWORD` permission** (see Key Decisions Log). Both paths now exist and are routed to from the login screen with no dead end either way.
- [ ] Email/SMS OTP-based password reset — **deliberately deferred to a later phase, not abandoned** (see Key Decisions Log for the offline-first / cost / DLT-lead-time reasoning). Any Resend/Cloudflare/MSG91 accounts already created are on hold, unused.
- [x] "Invite a new user" flow — **done 2026-09-06**, new `inviteUser` + `listRoles` (see Key Decisions Log). Manage Users can now onboard a second real person, not just reset an existing one.
- [x] Custom-role creation/editing UI — **done 2026-09-06**, new ManageRolesScreen + `listAllPermissions`/`listRolesWithPermissions`/`createRole`/`updateRolePermissions` (see Key Decisions Log). The built-in Admin role is protected from being edited.
- [ ] No role DELETION — a role's id is referenced from `company_access` in the SYSTEM DB (cross-database, invisible to a company-DB-only check), so safely deleting one (without silently orphaning a user's access) needs a cross-database check not built yet. A business that creates a role by mistake today has no way to remove it, only to edit its permissions down to nothing.
- [ ] Backup/restore is same-company-same-install only — there's no disaster-recovery path for "the whole install/machine is gone" (which would need the system DB, not just one company DB, backed up and restorable elsewhere). Worth a future pass once real customers exist.
- [x] License renewal/expiry in-app reminder — **done 2026-09-06**, `LicenseStatus` now carries `expiresInDays`; the Company List screen shows a "renew soon" warning once a license is within 30 days of expiry.
- [ ] The Ed25519 PRIVATE signing key exists only in the hands of whoever ran this session's key generation — it needs to move to real secured, backed-up storage (a password manager or hardware key), and a process for who at MHTSdigiXR is authorized to run `scripts/generate-license.mjs` needs to be decided. Losing this key means no new licenses can ever be issued; leaking it means anyone could forge one.
- [x] Phase 1: P&L and Balance Sheet reports — **done 2026-09-05**, built on a new shared `computeLedgerBalances` helper alongside a refactored Trial Balance (see Key Decisions Log). Turned out not to need a recursive group-hierarchy rollup after all — every `account_group` row (including sub-groups) already carries its own `nature` directly, so a flat `WHERE nature IN (...)` join was sufficient; the anticipated complexity wasn't actually there.
- [x] Phase 1: voucher cancellation and Payment/Receipt/Contra-specific UX — **done 2026-09-05** (see Key Decisions Log). Cancellation posts an automatic, cross-linked reversal voucher (never a destructive edit); a new Voucher Register screen lists vouchers and is where cancellation is triggered from. Payment/Receipt/Contra now have dedicated auto-balancing forms; Journal (renamed `JournalVoucherScreen`) remains the generic multi-line form for anything else. Direct in-place voucher *editing* (as opposed to cancellation) is still not offered — intentionally: real accounting practice favors correction-by-reversal over rewriting posted history, so this isn't tracked as a gap.
- [ ] Phase 1: `computeTrialBalance` does not require opening balances to net to zero across ledgers (only vouchers are forced to balance, via `createVoucher`). A business entering ad hoc opening balances that don't net out will see a Trial Balance that doesn't balance either — real accounting software absorbs this via an opening "Suspense"/equity adjustment ledger, which this pass doesn't build.
- [x] Phase 2: Sales + Purchase — **done 2026-09-05**, including vendor TDS and Sales/Purchase Orders (user chose to include all three in one pass rather than defer any). See Key Decisions Log for the full design (unified `business_party`, invoices posting through the unchanged voucher engine, threshold-aware TDS resolved from a new real `core-rules-engine`, 43B(h) due-date snapshotting). The items below are genuine simplifications within that delivered scope, not oversights.
- [x] Phase 2: **Bill-wise (invoice-level) payment allocation** — **done 2026-09-06** (see Key Decisions Log). New Customer Receipt/Supplier Payment screens link a settlement to specific invoices; MSME ageing is now exact for any invoice paid through them, still FIFO-estimated only for the remainder paid through the older generic Payment/Receipt screens.
- [ ] Phase 2: **TDS rates have no admin/editing UI yet** — `@mhts/core-rules-engine`'s `createRuleSetVersion`/`resolveEffectiveRule` are real and used (seeded defaults for 194C/194J/194Q/194I), but there's no screen for a user or CA to add a new dated rate version when the Finance Act changes one. Same gap will apply to GST (Phase 4) and payroll (Phase 7) rule sets, which share this same mechanism — probably worth solving once, generically, rather than three times per-module.
- [ ] Phase 2: **194Q's buyer-turnover eligibility gate is not enforced** — the section only actually applies when the buyer's own preceding-year turnover exceeds Rs 10 crore, which isn't tracked anywhere on the Company record. Today the app will let a company apply 194Q regardless; the user must know not to select it if ineligible.
- [ ] Phase 2: **Section 43B(h) MSME due date always assumes a 45-day cap**, never the 15-day fallback that applies when no written supplier agreement exists (this pass has no "agreement exists" flag on a party). A business without agreements in place will be under-flagged by the ageing report for invoices between day 16 and day 45.
- [ ] Phase 2: **No vendor TDS Form 26Q/16A generation** — `purchase_invoice.tds_section`/`tds_amount` capture what's needed to build these later, but the actual quarterly-return/certificate generation isn't built. Natural to pair with GST's own GSTR prep work in Phase 4, or its own small pass once real invoice volume exists to test against.
- [x] Phase 3: **Inventory** — **done 2026-09-06**, full Item/Unit/Warehouse/Batch master data, FIFO/weighted-average stock valuation, and Sales/Purchase invoice integration with COGS auto-posting (see Key Decisions Log for the full design). The items below are genuine, explicitly-scoped simplifications within that delivered scope, not oversights.
- [x] Phase 3: **No automatic stock reversal on invoice cancellation** — **done 2026-09-06**, real reversal built (see Key Decisions Log): `cancelSalesInvoice`/`cancelPurchaseInvoice`/`cancelStockAdjustment` now un-consume FIFO layers or credit back the weighted-average pool, atomically alongside the voucher's own GL reversal. A purchase receipt (or ADJUSTMENT_IN) is still refused if any of its quantity has already moved on — that's now an explicit, checked eligibility rule, not a silent gap.
- [ ] Phase 3: **No alternate unit-of-measure conversion** — one base unit per item (e.g. no "1 box = 12 pieces"). A business that buys in one unit and sells in another must currently pick one unit and convert manually outside the app.
- [ ] Phase 3: **No automatic batch selection on issue** — a sale/adjustment/transfer of a batch-tracked item requires the user (or caller) to explicitly pick which existing batch to draw from; there's no FIFO-by-expiry or FIFO-by-receipt-date auto-selection across batches. `postSalesIssueInTransaction` throws if a batch-tracked item's line omits a `batchId`.
- [ ] Phase 3: **Sales/Purchase Order lines carry item/quantity/rate but not batch fields** — `sales_order_line`/`purchase_order_line` gained `item_id`/`warehouse_id`/`quantity_thousandths`/`rate_paise` in migration 007, but no batch columns. Converting an order with a batch-tracked item line into an invoice will fail loudly at posting time (`postSalesIssueInTransaction`'s missing-batchId error) rather than silently — a real gap, but one that fails safely; a batch-tracked item is best sold via a direct invoice for now, not via order conversion.
- [ ] Phase 3: **No automated test harness** — this phase introduced the first genuinely stateful, order-dependent algorithm in the codebase (FIFO layer consumption across partial issues, warehouse transfers, and now reversal). Both the original valuation logic and the reversal follow-up were verified thoroughly via real end-to-end handler calls against a real encrypted company DB — but manual end-to-end verification is poorly suited to catching a future regression in this specific math. A minimal `node:test`/`vitest` harness scoped to `core-inventory`'s FIFO/weighted-average/reversal functions would be a good investment before this logic is touched again.
- [ ] Phase 3: **Item/unit/warehouse list permissions are scoped to their own MANAGE_* permission** (`INVENTORY.MANAGE_ITEMS` etc.), not something broader like a dedicated "pick items for a document" permission — a custom role with only `SALES.CREATE_INVOICE` (no inventory permissions) cannot currently list items to put a stock line on an invoice. Not a problem for the seeded Admin role (which holds every permission), but worth revisiting once custom roles for non-admin staff (e.g. a sales-only role) become a real use case.
- [ ] Incidental discovery, unrelated to Phase 3: `apps/desktop-shell/src/main/licenseHandlers.ts:49` fails `tsc --noEmit` (`Type 'string' is not assignable to type 'ValueExpression<SystemDatabase, "license_activation", never> | undefined'`) — confirmed via `git diff main` to be a pre-existing latent type error, not something this session's changes touched or introduced. The project's existing verification method (Vite/esbuild build + `eslint` + real end-to-end handler calls) never runs `tsc --noEmit` directly, so this was never caught before. Left unfixed since it's out of scope for this phase; worth a dedicated look next session.
- [x] Phase 3 follow-up: **Stock-movement reversal (invoice/adjustment cancellation)** — **done 2026-09-06** (see Key Decisions Log for the full design). The items below are genuine, explicitly-scoped simplifications within that delivered scope.
- [ ] Phase 3 follow-up: **Weighted-average receipt-cancellation eligibility is deliberately conservative** — it blocks cancelling a receipt if ANY later `stock_movement` exists for that item/warehouse/batch scope, not just a later *outbound* one (the only kind that actually bakes a corrupted average into an already-posted, immutable COGS figure). This will refuse some receipt cancellations that are theoretically safe (e.g. a second, unrelated receipt posted afterward with no sale in between) — a correctness-first choice for this pass, not tightened further. Loosening it later means proving no *outbound* movement (not just no movement at all) exists after the target receipt.
- [ ] Phase 3 follow-up: **`stockLayers.ts`'s FIFO consumption order had a latent same-day tiebreak bug**, found and fixed while building this feature (unrelated to reversal itself): two layers received on the same calendar date were consumed in UUID-lexicographic order (`ORDER BY id`) rather than insertion order, since `received_at` is only day-granularity and `id` is a random UUID. Fixed by ordering on SQLite's implicit `rowid` instead — the same ordering signal this feature's weighted-average eligibility check relies on. No migration; verified with a same-day multi-layer scenario.
- [ ] Phase 3 follow-up: **Sales Invoice/Purchase Invoice/Voucher Register cancel buttons are now keyed by voucher id, not the invoice's own id** — `cancelSalesInvoice`/`cancelPurchaseInvoice`'s public parameter changed meaning (was `invoiceId`, now `voucherId`, looking up the invoice internally) so the generic Voucher Register — which only ever has a voucher's id, for any voucher type — could route a stock-touching voucher to its guarded cancel path exactly like the dedicated registers do. This was a live, already-merged bypass before this fix: a user could cancel a stock-linked invoice through the generic Voucher Register's unguarded `cancelVoucher`, posting a correct GL reversal while leaving stock completely out of sync. Closed for all three stock-touching voucher types (SALES_INVOICE, PURCHASE_INVOICE, STOCK_ADJUSTMENT), not just the one initially suspected.
- [x] Phase 4 kicked off (Increment 1: GST rate engine + invoice auto-computation) — **done 2026-09-06** (see Key Decisions Log for the full design: `core-rules-engine`-based versioned rates, CGST/SGST/IGST place-of-supply split, new "Input Tax Credit" asset group, Manage GST Rates admin screen, GST Summary report). Verified end-to-end (18 checks) including the Blueprint's literal exit criterion. The items below are genuine, explicitly-scoped deferrals within Increment 1, not oversights.
- [x] Phase 4: **Input Tax Credit (ITC) eligibility/reversal** — **done 2026-09-06** (Increment 2, see Key Decisions Log). Per-line `itc_eligible`/`itc_ineligibility_reason`, blocked credit folds into cost instead of an Input ledger, and `computeGstSetOff` nets eligible input credit against output liability using the standard set-off order. Genuinely still not built: matching against a supplier's actual GSTR-2B (would need real GSTN connectivity, out of scope for an offline-first app) — eligibility today is a business's own self-declared flag, not externally verified.
- [x] Phase 4: **GSTR-1/3B/9/9C prep** — **done 2026-09-06** (Increment 2, see Key Decisions Log). All four as CA-facing reference reports (on-screen tables + CSV export) — a deliberate, user-confirmed scope choice, NOT the GST portal's exact upload-ready JSON schema (tracked as its own open item below). Only lines with an HSN/SAC code are reflected; a business relying entirely on the pre-Phase-4 manual tax-ledger path won't see anything in these reports — a real, flagged scoping limit, not a silent gap.
- [x] Phase 4: **Composition scheme and reverse-charge handling** — **done 2026-09-06** (Increment 2, see Key Decisions Log). Composition is a company-level setting fixed at creation (see the next item for the one real gap this leaves); reverse charge is a per-line flag on both sales and purchase lines.
- [ ] Phase 4: **A null company or party state code defaults to intra-state (CGST+SGST)**, not the more nuanced treatment a real export/SEZ transaction needs (which should typically be zero-rated or IGST regardless of a missing state code). This pass has no "export"/"SEZ" concept on a party — a business with such customers must currently either enter a state code that produces the desired split or override the line's tax manually (no `hsnSacCode`, use the pre-existing manual tax path instead).
- [ ] Phase 4: **Cess is a single flat rate per HSN/SAC code**, not the tiered/per-unit structure real compensation cess sometimes uses (e.g. a fixed rupee amount per cigarette rather than a percentage) — fine for illustrative/percentage-based cess, not a complete cess engine.
- [ ] Phase 4: **Existing (pre-Phase-4) companies don't get GST permissions/ledgers/registration-type retroactively** — `grantGstPermissions`/`seedGstLedgers` only run at NEW company creation, same as every prior module's permissions/ledgers (Phase 3's inventory ledgers had the identical characteristic), and the new `company.gst_registration_type` column defaults every existing row to `'REGULAR'` via the migration, which is a safe default but not necessarily correct for a real composition dealer who happened to be on an older schema. Not a real gap yet since no paying customers exist on an older schema version.
- [ ] Phase 4: **Composition scheme is fixed at company creation, with no path to change it afterward** — a real mid-year switch (either direction) has its own statutory transition rules (ITC reversal on closing stock when moving TO composition, availing credit on opening stock when moving FROM it) that aren't modeled. A business that mis-selects at setup, or that genuinely changes scheme, has no in-app path today — would need a dedicated, carefully-designed migration flow, not a simple field edit.
- [ ] Phase 4: **No CMP-08 auto-posting for a composition dealer's own flat-rate liability** — composition dealers pay a flat rate on turnover quarterly (a real, separate self-assessment, not netted against any ITC since they have none); this pass doesn't compute or post that liability automatically. A composition company would need to calculate and record this manually via a plain Payment voucher for now.
- [ ] Phase 4: **GSTR-1/3B/9/9C prep reports don't match the GST portal's offline-utility JSON schema** — deliberate, confirmed scope choice (see Key Decisions Log): CSV export for manual reference/CA handoff, not an upload-ready file. Building real schema conformance is separate, precision-heavy work with real downside risk (a subtly wrong field presented as upload-ready could mislead a real filing) — would need dedicated research against the actual current GSTN offline-utility spec before attempting.
- [ ] Phase 4: **`computeGstSetOff`'s credit utilization order is the standard textbook rule, not the fully cash-minimizing algorithm** the actual law permits some discretion for (exactly how IGST credit splits between CGST and SGST liability when both are open) — correct and usable as a "roughly how much do I owe" figure, but verify against an actual GSTR-3B computation before relying on it for a real filing.
- [ ] Phase 4: **GSTR-9's Part V (prior-year amendments declared in a later financial year's returns) is not modeled** — this app has no return-period concept separate from an invoice's own date, so there's no data source for "an invoice dated in FY24-25 but amended in an FY25-26 return." Flagged in the GSTR-9 screen itself, not silently omitted.
- [ ] Phase 5: **Existing (pre-Phase-5) companies don't get Banking permissions retroactively** — `grantBankingPermissions` only runs at NEW company creation, same characteristic every prior module's permissions have had (Phase 3/4 noted the identical gap). Not a real problem yet since no paying customers exist on an older schema version.
- [ ] Phase 5: **CC/OD (cash credit/overdraft) bank accounts get no special treatment** — modeled identically to SAVINGS/CURRENT (same `ledger_account` under the same ASSET group). A CC/OD account can legitimately run a credit balance (overdrawn), which the reconciliation math handles correctly (the signed balance just goes negative), but there's no drawing-limit tracking or any UI distinction beyond the stored `account_type` label.
- [ ] Phase 5: **No bank-statement format beyond CSV, and column mapping is manual per import** — the importer handles the two common Indian-bank CSV shapes (single Amount+Dr/Cr column, or separate Withdrawal/Deposit columns) via a user-driven mapping step, but doesn't remember a bank's mapping between imports or auto-detect known formats. A future pass could save a mapping per bank account.
- [ ] Phase 5: **A CONTRA voucher between two bank ledgers reconciles each side completely independently** — no linkage recorded between the two `voucher_line` rows it produces, so reconciling one side against its bank statement has no bearing on the other. This matches how the two sides genuinely appear on two separate real bank statements, so it's not considered a gap, just worth noting.
- [ ] Phase 6: **No settlement-cancellation guard on the older Phase 2 `cancelSalesInvoice`/`cancelPurchaseInvoice`** — only expense claims got this guard (see Key Decisions Log). A real, disclosed inconsistency, not retrofitted onto Phase 2 in this pass since it was out of scope.
- [ ] Phase 6: **Existing (pre-Phase-6) companies don't get Expense/Documents permissions or the new default expense ledgers retroactively** — same characteristic every prior module's additions have had.
- [ ] Phase 6: **Travel has no separate pre-trip advance/disbursement workflow** (confirmed scope choice) — a future pass would need its own "advance to employee" ledger and a settle-against-advance mechanism, materially different from the after-the-fact reimbursement flow built here.
- [ ] Phase 6: **Document search is filename/description substring match only** — no OCR or full-text content extraction from the attached files themselves (confirmed out of scope).
- [ ] Phase 6: **`AttachmentsPanel` is wired into a representative set of screens (Expense Claim register, Voucher Register, both invoice registers, Parties, Bank Accounts), not literally every transaction-type screen** — the generic capability (any `entity_type`/`entity_id` pair is attachable with zero schema changes) satisfies the exit criterion; extending the UI to remaining screens is the same few-line addition, tracked as incremental follow-up, not a missing capability.
- [x] Phase 6: **No employee self-service / login concept** — Phase 7's employee model is now built (payroll profile extends the same `employee` table), but employee self-service login itself was NOT in Phase 7's Blueprint one-liner and remains genuinely out of scope — still no `AppUser` link for an employee; every payroll action (leave application included) is filed by an already-logged-in staff member on the employee's behalf, not by the employee themselves.
- [ ] Phase 7: **PCT_OF_BASIC resolves against "the sum of already-flagged-wage-base FLAT/PCT_OF_CTC components,"** not a specifically-designated "Basic" component — this schema has no separate "designate this one component as Basic" concept. Works correctly as long as a company's actual Basic component is flagged `isStatutoryWageBase` and defined as FLAT or PCT_OF_CTC (the normal case), but a company that defines Basic itself as PCT_OF_BASIC of something else would get an unexpected result. Documented in `salaryStructure.ts`, not silently assumed.
- [ ] Phase 7: **No admin UI for editing/deleting a salary component once created**, and no way to remove a component from an employee's structure individually — only a full re-`assignSalaryStructure` (which reapplies every active component) revises anything. A company that mis-configures a component must deactivate it (no deactivate toggle exists either yet) rather than fix it in place.
- [ ] Phase 7: **Leave entitlement is a flat annual number granted upfront each financial year**, not accrued month-by-month and not pro-rated for a mid-year joiner. A company with a strict monthly-accrual leave policy will see a new joiner's balance over-stated until their first full year.
- [ ] Phase 7: **No half-day leave applications** — `leave_application.days` is always a whole-day count; only attendance's own HALF_DAY status (a direct attendance mark, not a leave application) introduces a fractional (tenths-of-a-day) LOP adjustment.
- [ ] Phase 7: **TDS regime is a company-wide setting, not per-employee** — a company where some employees choose the old regime and others the new (allowed under current law, employee's own annual choice) isn't modeled; today one regime setting applies to everyone on that company's payroll.
- [ ] Phase 7: **194Q-style buyer/company-level eligibility gates don't exist for payroll** (unlike Phase 2's flagged 194Q gap) — PF/ESI/Gratuity applicability is headcount-only; a business exempted for some OTHER statutory reason (e.g. specific industry carve-outs) has no override beyond the existing ALWAYS/NEVER company settings, which do cover that case manually.
- [ ] Phase 7: **No Form 16/Form 24Q generation** — same deliberate deferral pattern as Phase 2's vendor 26Q/16A gap; `payslip`/`payslip_line` capture what's needed to build these later, but the actual annual TDS certificate/return generation isn't built.
- [ ] Phase 7: **No PF/ESI government e-filing (ECR/challan) integration** — PF/ESI/PT amounts are correctly computed and posted to their own payable ledgers, but remitting them to the actual government portal and recording the challan reference is a manual step outside the app today, same scoping as GST's own "prep reports, not upload-ready files" deferral.
- [ ] Phase 7: **Existing (pre-Phase-7) companies don't get Payroll permissions/ledgers/settings retroactively** — `grantPayrollPermissions`/`seedPayrollLedgers`/`seedDefaultCompanyPayrollSettings` only run at NEW company creation, the same characteristic every prior module's additions have had.
- [ ] Phase 7: **`ManagePayrollRulesScreen` uses a raw JSON payload editor** rather than six bespoke forms for the six different rule-payload shapes (PF/ESI/PT/wage-cap/gratuity-eligibility/TDS-slab) — a deliberate scope choice for an admin-only screen (amounts must be entered in paise), same underlying gap Phase 2 flagged ("no admin UI for rate versions... worth solving once, generically, rather than three times per-module") — still not solved generically, now present a third time (TDS/GST/Payroll).
- [x] Phase 8 Increment 1: **Fixed Assets + Cost Centres + Budgets** — **done 2026-09-07** (see Key Decisions Log for the full design). The items below are genuine, explicitly-scoped simplifications within that delivered scope, not oversights.
- [ ] Phase 8: **`ManageFixedAssetRatesScreen` is a fourth instance of the same raw-JSON rate-editor gap** flagged since Phase 2 ("no admin UI for rate versions... worth solving once, generically") — now present for TDS/GST/Payroll/Fixed-Assets. Genuinely worth solving generically before a fifth module needs it.
- [ ] Phase 8: **IT WDV block depreciation tracks each `fixed_asset` unit independently, not a true pooled block** — real Income Tax Act WDV blocks merge every asset of a category into one shared WDV figure per block (additions/deletions net against the block as a whole, and the `<180`-day half-rate rule is evaluated at the block level for that year's net additions, not per-asset). This pass applies the `<180`-day rule per-asset in that asset's own first year only, which is directionally correct for a single acquisition but would diverge from a real filing once a class sees multiple part-year additions/disposals within one FY. A dedicated pooled-block redesign would be needed before this is filing-accurate.
- [ ] Phase 8: **Disposal doesn't compute a stub partial-year depreciation top-up for the disposal FY itself** — `disposeFixedAsset` only removes accumulated depreciation from `asset_depreciation_entry` rows that already exist (i.e. from `postDepreciationRun` having been run for that FY already). A business that disposes an asset mid-year without first running that year's depreciation will see a slightly overstated gain/understated loss on disposal. The natural real-world workflow (run depreciation for the current period, then dispose) avoids this, but the app doesn't force or warn about the ordering.
- [ ] Phase 8: **No admin UI to edit an asset class or a fixed asset once created**, beyond the class's own `is_active` flag (no UI exposes toggling it yet either) — same "append/deactivate, don't edit in place" pattern as Phase 7's salary components, not yet given its own screen control for asset classes.
- [ ] Phase 8: **Cost centres and budgets have no permission granted to pre-Phase-8 companies retroactively** — `grantAccountingPermissions` (which now includes `ACCOUNTING.MANAGE_COST_CENTRES`/`ACCOUNTING.MANAGE_BUDGETS`) and `grantFixedAssetsPermissions`/`seedFixedAssetLedgers` only run at NEW company creation, the same characteristic every prior module's additions have had since Phase 3.
- [ ] Phase 8: **Budgets have no hierarchical roll-up** — a cost centre with children doesn't aggregate its children's budgets/actuals into a parent total; `parent_cost_centre_id` exists on `cost_centre` (added for future-proofing) but nothing in Increment 1 reads it yet.
- [ ] Phase 8: **Depreciation runs are annual only** (once per financial year per asset), not monthly-provisioning like Phase 7's gratuity — a company wanting a monthly depreciation P&L impact would need to estimate it manually between annual runs. A deliberate scope choice: the Blueprint's literal ask was "two separate depreciation calculations," not a specific posting frequency, and annual is standard practice for Schedule II/IT-Act books.
- [x] Phase 8 Increment 2: **Multi-Currency + Multi-Branch** — **done 2026-09-07** (see Key Decisions Log for the full design). The items below are genuine, explicitly-scoped simplifications within that delivered scope, not oversights.
- [ ] Phase 8: **`ManageExchangeRatesScreen` is a fifth instance of the same raw-JSON rate-editor gap** flagged since Phase 2 — now present for TDS/GST/Payroll/Fixed-Assets/Exchange-Rates. Genuinely overdue for a generic solution.
- [ ] Phase 8: **FX and branch tagging are wired into Journal/Payment/Receipt/Contra vouchers and Sales/Purchase invoices only** — Payroll runs, Expense Claims, and Fixed Asset acquisition/disposal stay base-currency and branch-untagged this pass. The underlying primitives (`voucher_line`'s FX fields, `branch_id`) are generic enough to extend to them later with no rework, but wiring every module's own screens wasn't attempted in one pass.
- [ ] Phase 8: **Contra vouchers get a branch selector but deliberately no FX fields** — Contra's single-amount-both-sides shape (one amount, mirrored debit/credit) doesn't map cleanly onto per-line FX the way Journal/Payment/Receipt's independent line amounts do; a currency-conversion-flavored Contra (e.g. moving money between an INR and a USD bank account) isn't supported as a distinct flow.
- [ ] Phase 8: **A foreign currency's minor-unit scale is assumed to always be 100 (cents), the same as the base currency's paise** — correct for USD/EUR/GBP and most real currencies, but wrong for a currency with a different subdivision (e.g. a 3-decimal or zero-decimal currency). No currency-metadata table exists to look this up; the IPC boundary's `rupeesToPaise`-style ×100 conversion is reused uniformly for whatever `foreignAmountUnits` a screen collects.
- [ ] Phase 8: **A foreign-currency invoice line's own `foreignAmount` (display-only, in the invoice's own currency) is captured in the core type but never actually populated by the Sales/Purchase invoice screens** — only the invoice HEADER's currency/rate and the aggregate party-ledger FX tag are wired end-to-end; a genuinely multi-line FX invoice shows each line's amount in base currency only, not also in the foreign currency, on screen (the underlying voucher/settlement math is unaffected either way — this is a display gap, not a correctness one).
- [ ] Phase 8: **Exchange rates have no live/API source** — `resolveExchangeRate` is pure versioned-data lookup (by design, offline-first); a company must manually add a new dated rate whenever the real market rate moves, the same manual-entry expectation as every other RuleSet-driven value in this codebase (GST/TDS/Payroll/Fixed-Asset rates).
- [ ] Phase 8: **Branches have no hierarchy** (unlike cost centres, which have `parent_cost_centre_id`) and Multi-Currency/Multi-Branch permissions have no retroactive grant for pre-Phase-8-Increment-2 companies — same two characteristics every prior module's additions have had since Phase 3.
- [x] Phase 8 Increment 3: **Manufacturing (core BOM + a single consume/produce voucher)** — **done 2026-09-07** (see Key Decisions Log for the full design). The items below are genuine, explicitly-scoped simplifications within that delivered scope, not oversights. **Phase 8 is now functionally complete.**
- [ ] Phase 8: **No cancellation/reversal for a posted manufacturing journal** — every other stock-affecting transaction (Stock Adjustment, Sales/Purchase issues, Transfers) supports a reversal path via `stockReversals.ts`'s existing movement-type mechanism; manufacturing would need two more reversal movement types plus real changes to that file. Genuinely deferred, not attempted this pass.
- [ ] Phase 8: **No multi-level BOM explosion** — a component that is itself the output of another BOM is not auto-expanded into its own sub-components. Only single-level "core BOM" recipes are supported.
- [ ] Phase 8: **No overhead/labour/conversion-cost absorption or wastage/scrap allowance** — the produced output is valued at exactly the sum of its components' consumed cost. A real manufacturing operation with meaningful conversion cost or process loss would need this extended.
- [ ] Phase 8: **A manufacturing journal is single-warehouse** — all components are consumed from, and the output is produced into, the same one warehouse. No per-component warehouse split (e.g. drawing different raw materials from different stores) is supported.
- [ ] Phase 8: **No admin UI to edit a BOM once created, beyond superseding it with a new version** — same "append/deactivate, don't edit in place" pattern as Phase 7's salary components and Phase 8's asset classes.
- [ ] Phase 8: **Manufacturing permissions have no retroactive grant for pre-Phase-8-Increment-3 companies** — `grantManufacturingPermissions` only runs at NEW company creation, the same characteristic every prior module's additions have had since Phase 3.

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
Date: 2026-09-07 (session 21)
Phase: 8 (Advanced ERP), Increment 3 — Manufacturing (core BOM + a single
  consume/produce voucher)
What was completed:
  - User said "Start Phase 8 Increment 3 (Manufacturing: core BOM + a single
    consume/produce voucher)" — read the Phase Status Board (Increments 1
    and 2 done, same branch, not yet merged/PR'd) and session 20's own
    handoff naming this exact scope as the pre-agreed Increment 3 boundary.
  - Explored core-inventory (item/warehouse/batch master data, FIFO layer
    consumption, weighted-average costing, the stock_movement ledger and
    its INBOUND/OUTBOUND movement-type lists), core-accounting's voucher
    engine and VOUCHER_TYPES, and core-fixed-assets as the most recent
    "new module" scaffold (package.json/project.json/tsconfig, permissions
    pattern, own-ledger-per-record precedent) before drafting a plan, per
    CLAUDE.md's financial-logic plan-and-confirm gate. Also confirmed via
    stockTransfers.ts's own doc comment that a same-ledger, same-value stock
    movement (a warehouse transfer) posts NO voucher at all today — used
    this as the precedent for manufacturing's own GL treatment.
  - Presented a plan (BOM schema, consume/produce mechanics, GL treatment,
    explicit list of deferred items) and got the user's go-ahead ("Proceed
    with you best recommendations") to make the remaining implementation
    calls without a further round of questions.
  - Built Increment 3 in full: new pure-TS package `core-manufacturing`
    (depends on core-accounting + core-inventory, same type:core Nx
    boundary as core-fixed-assets/core-multi-currency). `bill_of_material`/
    `bill_of_material_line` (one ACTIVE version per output item at a time —
    append-only supersede-on-new-version, same pattern as salary_structure/
    asset_class, enforced in the single write path rather than a DB
    constraint) and `manufacturing_journal` (the register header, linking
    to a real voucher). The consume/produce operation scales every BOM
    line's quantity to whatever is actually being produced, then consumes
    each component exactly like a sales issue (FIFO layer consumption or
    weighted-average lookup, reusing core-inventory's existing functions
    as-is — two new movement types MANUFACTURING_CONSUME/
    MANUFACTURING_PRODUCE added to the existing MOVEMENT_TYPES/INBOUND/
    OUTBOUND lists, so stock position/valuation reports pick them up with
    zero special-casing). The output is produced at cost = sum of
    components consumed (no overhead/wastage absorption this pass — flagged,
    not hidden). Posts one real MANUFACTURING_JOURNAL voucher, Dr/Cr the
    SAME Stock-in-Hand ledger for that amount — net GL/TB impact zero by
    construction, the same precedent transferStockInTransaction already
    established, but still a real voucher number/audit entry since it's a
    distinct financial event (matches Tally's own "Manufacturing Journal"
    concept). One migration (017). Full IPC/preload/renderer wiring: new
    manufacturingHandlers.ts (rupees/units unit-conversion boundary, same
    convention as every other handler file), 3 new screens
    (BillOfMaterialsScreen — list + create/version BOMs,
    ManufacturingJournalScreen — post an entry with live scaled-quantity
    preview and per-component/output batch selection,
    ManufacturingJournalRegisterScreen — register with a drill-down into
    each journal's consumed/produced stock_movement rows), a new dashboard
    nav section gated on MANUFACTURING.MANAGE_BOM/POST_JOURNAL.
  - Verified end-to-end (25 checks, throwaway tsx script against a real
    encrypted company DB, deleted after): BOM creation/versioning
    (supersede-on-new-version), a 3-component journal mixing FIFO (screws),
    weighted-average (planks, blended across two receipts at different
    rates), and a batch-tracked FIFO item (varnish) in one posting,
    proportional quantity scaling (BOM lines x3 for 3 units produced), the
    produced item valued at exactly the sum of components' cost, the
    MANUFACTURING_JOURNAL voucher balancing and its net effect on
    Stock-in-Hand being exactly zero, the trial balance still balancing,
    both raw-material and finished-good stock positions correct, an
    insufficient-stock over-consumption attempt throwing and leaving no
    partial journal/voucher behind (atomic rollback — proving the
    transaction boundary), and a BOM-recipe-change simulation (a new BOM
    version changes future output cost with zero code changes, the same
    "rate-change" shape as every other RuleSet-driven module's test in this
    codebase, even though a BOM itself isn't RuleSet-driven — recipes are
    ordinary versioned rows, not date-effective rules). One test-authoring
    mistake caught and fixed during verification (not a product bug): the
    first draft asserted Stock-in-Hand's GL balance should equal the total
    opening-stock value after manufacturing — wrong, because
    recordOpeningStock deliberately never posts to GL (a documented
    pre-existing gap), so the ledger's real starting balance was 0, and the
    correct assertion is that it STAYS 0 after a self-canceling
    manufacturing entry. Full workspace `nx run-many -t build -t lint` (19
    projects) clean (one transient ESLint ENOENT on a mid-build temp
    electron.vite.config file, confirmed flaky/unrelated by re-running
    desktop-shell:lint alone successfully).
What's still pending in this phase:
  - Phase 8 is now functionally complete against the Blueprint's one-line
    scope. Everything listed under the new Phase 8 Increment 3 items in
    Section 3 (Open Questions): no cancellation/reversal for a posted
    manufacturing journal, no multi-level BOM explosion, no overhead/
    wastage absorption, single-warehouse-only journals, no admin UI to
    edit a BOM beyond superseding it, no retroactive permission grant for
    pre-existing companies. Plus every item already listed under Increments
    1 and 2 (unchanged, not re-attempted this session).
Any decisions made (also add to Section 2): see the six new 2026-09-07
  Phase 8 Increment 3 rows in the Key Decisions Log — the literal scope
  quote, the BOM-versioning pattern, reusing core-inventory's valuation
  functions as-is, the no-overhead-absorption simplification, the
  same-ledger GL treatment (and why it still gets a real voucher), and the
  deliberately-deferred cancellation/reversal path.
Any blockers (also add to Section 3): none.
Next concrete step: user review of branch
  `phase8/fixed-assets-cost-centres-budgets` (now carries all three
  increments), then open a PR (not merged by Claude). Phase 8 is complete;
  Phase 9 (Print + Templates) is next per the Blueprint's phase ordering,
  unless the user wants to resequence.
```

```
Date: 2026-09-07 (session 20)
Phase: 8 (Advanced ERP), Increment 2 — Multi-Currency, Multi-Branch
What was completed:
  - User said "Continue Phase 8 Increment 2" — read the Phase Status Board
    (Increment 1 done, pushed, not yet merged/PR'd) and session 19's own
    handoff (multi-currency depth pre-decided as "full": entry-time
    conversion + period-end revaluation + forex gain/loss).
  - Explored the current schema (voucher/voucher_line, CompanyTable's
    existing base_currency field, the cost-centre dimension-tag pattern,
    core-rules-engine's date-effective RuleSet mechanism, core-fixed-assets'
    own-dedicated-ledger pattern) before drafting a plan, per CLAUDE.md's
    financial-logic plan-and-confirm gate.
  - Surfaced two real scope forks via AskUserQuestion before planning —
    branch modeling (dimension tag only vs. + inter-branch current account)
    and FX scope (invoices + FX bank accounts only vs. all voucher types) —
    user chose the more involved option both times. Used plan mode; user
    approved the plan as drafted with no changes.
  - Built Increment 2 in full: the FX primitive (foreignCurrency/
    foreignAmount/exchangeRateMicros, all-or-nothing) added directly to
    voucher_line inside core-accounting (not a new package, since every
    voucher type needs it), validated via a new convertForeignToBase
    (BigInt, half-up rounding) and its exact inverse foreignAmountForBase.
    New pure-TS package core-multi-currency (exchange rates via
    core-rules-engine's existing RuleSet mechanism reused as-is — zero
    changes to that package — plus period-end revaluation and two new
    ledgers, Realized/Unrealized Forex Gain/Loss). Realized gain/loss at
    settlement extends core-sales-purchase's existing recordSalesReceipt/
    recordPurchasePayment in place. Branches (own dedicated "Inter-Branch
    Current Account" ledger per branch, same own-ledger pattern as parties/
    bank accounts/asset classes) stay inside core-accounting alongside cost
    centres/budgets; a new INTER_BRANCH_TRANSFER voucher type posts one
    balanced 4-line voucher per transfer, needing no elimination logic for
    the whole-company consolidated report to already be correct. A new
    branch-wise Balance Sheet handles the one real subtlety (opening
    balances predate branch tagging) via an explicit "Head Office /
    Unassigned" bucket. Two new migrations (015, 016). Full IPC/preload/
    renderer wiring: 5 new screens (Branches, InterBranchTransfer,
    BranchReports, ManageExchangeRates, RunFxRevaluation — the fifth
    instance of the still-unsolved generic-rate-editor gap), branch
    selectors on Journal/Payment/Receipt/Contra plus per-line FX fields on
    Journal/Payment/Receipt (Contra deliberately skips FX — its
    single-amount-both-sides shape doesn't map onto per-line FX), header
    currency/rate + branch fields on the Sales/Purchase invoice screens,
    and FX settlement fields on Customer Receipt/Supplier Payment.
  - Verified end-to-end (24 checks, throwaway tsx script against a real
    encrypted company/system DB pair, deleted after): the BigInt precision
    path on a large amount, a rate-change simulation (new RuleSet version,
    zero code change, same shape as GST/TDS/Payroll/Fixed-Assets), an FX
    invoice's voucher/outstanding-row correctness, realized gain/loss at
    settlement with the party ledger clearing to EXACTLY zero, idempotent
    re-running of a period-end revaluation, an inter-branch transfer's
    balanced 4-line voucher, and branch-wise P&L/BS summing exactly to the
    whole-company reports (the literal Phase 8 exit criterion). Verification
    caught and fixed two real bugs before commit: (1) a settlement voucher's
    party-ledger line wasn't FX-tagged, so a fully-settled FX invoice kept
    showing as open exposure to revaluation — fixed by splitting the
    party-ledger settlement line per-FX-invoice in a new buildPartyLedgerLines
    helper; (2) a revaluation run's own adjustment line can't carry FX tags
    (a valuation change, not a new FX transaction), so a second run forgot
    the first run's effect — fixed by having findFxExposures fold in the
    durable fx_revaluation_line audit trail's prior adjustments. Full
    workspace `nx run-many -t build -t lint` (18 projects) clean; `tsc
    --noEmit` clean on both the renderer and main-process TS projects (only
    the pre-existing, already-documented licenseHandlers.ts latent error
    remains, untouched).
What's still pending in this phase:
  - Phase 8 Increment 3 (Manufacturing) — not started.
  - Everything listed under the new Phase 8 items in Section 3 (Open
    Questions): the fifth raw-JSON rate-editor instance, FX/branch tagging
    not extended to Payroll/Expense-Claims/Fixed-Assets, Contra's FX
    exclusion, the assumed-100-minor-units-per-currency simplification, FX
    invoice lines' own foreignAmount not populated by the invoice screens
    (header/aggregate-only), no live exchange-rate source, no branch
    hierarchy, no retroactive permission grant for pre-existing companies.
Any decisions made (also add to Section 2): see the nine new 2026-09-07 /
  Phase 8 Increment 2 rows in the Key Decisions Log — the two scope forks,
  the FX primitive living on voucher_line, exchange rates reusing
  core-rules-engine as-is, branches staying in core-accounting, inter-branch
  transfers needing no elimination logic, the branch-wise BS's HO/Unassigned
  bucket, realized gain/loss extending the existing settlement functions,
  and the two bugs verification caught and fixed.
Any blockers (also add to Section 3): none.
Next concrete step: user review of branch
  `phase8/fixed-assets-cost-centres-budgets` (now carries both increments),
  then open a PR (not merged by Claude); after that, Phase 8 Increment 3
  (Manufacturing) per the user's choice of sequencing next session.
```

```
Date: 2026-09-07 (session 19)
Phase: 8 (Advanced ERP), Increment 1 — Fixed Assets, Cost Centres, Budgets
What was completed:
  - User said "Start Phase 8" — read the Phase Status Board (Phase 7 merged
    via PR #15) and the Blueprint's one-line Phase 8 scope: "Fixed assets
    (dual depreciation), cost centres, budgets, manufacturing,
    multi-currency, multi-branch" — the broadest single phase in the
    roadmap, six largely-independent sub-areas.
  - Before drafting a plan, surfaced the real scope forks via
    AskUserQuestion: (1) one full pass vs. splitting into increments — user
    chose to split (recommended); (2) Manufacturing depth — user deferred to
    the recommendation (core BOM + a single consume/produce voucher, no
    work-order/WIP tracking, explicitly open to "both" i.e. fuller tracking
    later if wanted); (3) Multi-currency depth — user chose full (entry-time
    conversion + period-end revaluation + forex gain/loss), not basic
    entry-only.
  - Landed on three increments: Inc.1 Fixed Assets + Cost Centres + Budgets
    (this session), Inc.2 Multi-currency + Multi-branch, Inc.3 Manufacturing.
  - Explored the existing voucher engine, chart-of-accounts seeding, and
    core-rules-engine's RuleSet mechanism (confirmed still fully generic —
    GST/TDS/Payroll all already prove the pattern) before planning, per
    CLAUDE.md's financial-logic plan-and-confirm gate. Used plan mode; user
    approved the plan as drafted with no changes.
  - Built Increment 1 in full: `cost_centre` table + `voucher_line.cost_centre_id`
    (nullable dimension tag) + a cost-centre-wise P&L report, all in
    `core-accounting` (not a new package — a dimension on the existing
    voucher engine, not a standalone module); `budget`/`budget_line` (12
    monthly lines, scoped to a ledger and/or cost centre) + a
    budget-vs-actual report that re-queries `voucher_line` directly, no
    separate actuals table; a brand-new pure-TS package `core-fixed-assets`
    (same `type:core` Nx boundary, depends on `core-accounting` +
    `core-rules-engine`) implementing genuinely independent Companies Act
    Schedule II (SLM/WDV, strict day-count pro-ration, GL-posted) and Income
    Tax Act WDV block (the real <180-days half-rate rule, memo-only, never
    posted) depreciation, both rate-driven via two new `core-rules-engine`
    rule types, never hardcoded. Three new voucher types
    (ASSET_ACQUISITION/DEPRECIATION/ASSET_DISPOSAL); each asset CLASS (not
    each physical unit) gets its own dedicated gross-block and
    accumulated-depreciation ledgers, same "own dedicated ledger" pattern as
    parties/bank accounts/employees, so the chart of accounts doesn't
    explode per physical unit.
  - Two new company-DB migrations (013 cost centres/budgets, 014 fixed
    assets). Full IPC/preload/renderer wiring: 6 new screens
    (CostCentresScreen, BudgetsScreen, FixedAssetClassesScreen,
    FixedAssetRegisterScreen, RunDepreciationScreen,
    ManageFixedAssetRatesScreen — the last reusing the existing generic
    raw-JSON RuleSet-editor pattern from ManagePayrollRulesScreen, a known,
    now-fourth instance of the still-unsolved "generic rate editor" gap
    flagged since Phase 2), a cost-centre selector added to the
    Journal/Payment/Receipt voucher-entry screens (Contra deliberately
    excluded — a pure internal Cash/Bank transfer, not an expense/income
    event), and new dashboard nav entries gated by the three new
    `FIXED_ASSETS.*` permissions plus the two new `ACCOUNTING.*` ones.
  - Verified end-to-end (27 checks, throwaway tsx script against a real
    encrypted company/system DB pair, deleted after): cost-centre-tagged
    vouchers and the resulting P&L split; a budget's monthly variance
    against real posted actuals; an asset class's two dedicated ledgers;
    acquisition balancing the gross-block ledger; a depreciation run where
    the two books compute genuinely DIFFERENT amounts for the same asset
    (the literal Blueprint exit criterion) with only SCHEDULE2 getting a
    real `voucher_id` and IT_WDV staying memo-only; idempotent re-running of
    an already-processed FY; a rate-change simulation (new RuleSet version,
    zero code change, matching the same test pattern GST/Payroll used); and
    a full disposal (gross block and accumulated depreciation both correctly
    zeroed for that one asset without disturbing the shared class ledgers,
    and a correctly-signed loss posted to the Profit/Loss on Sale of Assets
    ledger). Full workspace `nx run-many -t build -t lint` clean
    (desktop-shell's lint flagged once as "flaky" — a real ENOENT race
    against electron-vite's temp config file when build and lint run
    concurrently in the same `nx run-many`, confirmed transient by
    re-running lint alone immediately after); `tsc --noEmit` clean on both
    the renderer and main-process TS projects (only the pre-existing,
    already-documented `licenseHandlers.ts` latent error remains, untouched).
What's still pending in this phase:
  - Phase 8 Increment 2 (Multi-currency + Multi-branch) and Increment 3
    (Manufacturing) — not started.
  - Everything listed under the new Phase 8 items in Section 3 (Open
    Questions): the fourth raw-JSON rate-editor instance, IT WDV block being
    per-asset rather than truly pooled, no disposal-year partial-depreciation
    top-up, no asset-class/asset edit UI, no retroactive permission grant for
    pre-Phase-8 companies, no cost-centre hierarchy roll-up, annual-only
    depreciation runs.
Any decisions made (also add to Section 2): see the seven new 2026-09-07 /
  Phase 8 rows in the Key Decisions Log — increment split, cost centres as a
  dimension tag (not a new module), budgets re-deriving actuals (not a
  stored table), the two independent rate-driven depreciation books, asset
  classes (not units) owning the dedicated ledgers, and the three new
  voucher types.
Any blockers (also add to Section 3): none.
Next concrete step: user review of branch
  `phase8/fixed-assets-cost-centres-budgets`, then open a PR (not merged by
  Claude); after that, either Phase 8 Increment 2 (Multi-currency +
  Multi-branch) or Increment 3 (Manufacturing) per the user's choice of
  sequencing next session.
```

```
Date: 2026-09-07 (session 18)
Phase: 7 (Payroll) — kicked off and completed in one pass
What was completed:
  - User said "Start Phase 7" — read this file's Phase Status Board (Phase 6
    merged via PR #14, Phase 7 next per the Blueprint sequence) and the
    Blueprint's Phase 7 one-liner + Section 3.2 (the rules-as-data
    requirement for the salary/wage formula layer).
  - Explored the existing employee model (Phase 6's `employee` table — bare
    code/name/department/ledger, flagged by that session's own handoff as
    needing revisit once Payroll's model exists), core-rules-engine's
    RuleSet mechanism (already generic — GST rates and vendor TDS both
    already consume it, so Payroll needed zero new mechanism, only new
    payloads), and confirmed `core-payroll-engine` existed only as an empty
    Phase-0 stub.
  - Used plan mode (financial-logic gate): surfaced three real scope forks
    via AskUserQuestion before drafting a plan — (1) split into GST-style
    Increment-1/Increment-2 vs. build the full scope in one pass — user
    chose the full pass (not the recommended split); (2) gratuity scope
    (eligibility/formula calculator only vs. also monthly provisioning) —
    user chose "do both"; (3) salary TDS scope (new-regime slab estimator
    only vs. also old-regime, vs. manual-only) — user chose "create both",
    while also asking directly whether shops under 5 employees are even
    subject to these schemes. Answered that directly in the plan's Context
    section (PF needs 20+ employees, ESI/Gratuity need 10+, PT/TDS have no
    headcount gate at all — all real EPF/ESI/Gratuity Act thresholds) and
    built it into the design as RuleSet-configurable, headcount-compared
    applicability rather than assuming payroll always applies.
  - Built (see Key Decisions Log for the full design): `employee` extended
    in-place with payroll fields + a second `salary_payable_ledger_id`
    (kept separate from Phase 6's reimbursement ledger); new
    `core-payroll-engine` package (types, permissions, ledgers,
    company-payroll-settings, applicability, wage classification — the
    literal 50%-allowance-cap-reclassification implementation, PF/ESI/PT/
    salary-TDS pure compute functions, gratuity eligibility/formula/
    provisioning math, employees/salaryComponents/salaryStructure/leave/
    attendance/payrollRun/gratuityRecords DB-facing modules); new company-DB
    migration 012_payroll.ts (15 new tables + the employee ALTER); two new
    `VOUCHER_TYPES` (`PAYROLL`, `GRATUITY_PROVISION`); ~30 new IPC channels
    (`payrollHandlers.ts`, `ipc.ts`, `main/index.ts`, `preload/index.ts`,
    all following the established requireSessionWithCompanyDb + paise<->
    rupee-at-the-boundary pattern exactly); 9 new renderer screens
    (EmployeePayrollProfileScreen, SalaryComponentsScreen,
    SalaryStructureScreen, PayrollSettingsScreen, ManagePayrollRulesScreen,
    AttendanceScreen, LeaveScreen, PayrollRunScreen, GratuityScreen), wired
    into App.tsx/DashboardScreen.tsx behind new PAYROLL.* permissions.
  - Verified end-to-end (76 checks, throwaway tsx script run from repo root
    against a real encrypted system+company DB pair, deleted after): every
    pure compute function against hand-verified numbers (including a full
    progressive-slab TDS calculation with cess), a rate-change simulation
    for PF (zero code change), the wage-cap reclassification's literal
    Section 3.2 test, applicability at headcount 1/10/20 plus the
    sticky-gratuity-survives-a-headcount-drop case, LOP-prorated payroll
    with a zero-deduction payslip, a two-employee run with PF/ESI/PT/TDS
    all live where the posted voucher's Dr and Cr totals were independently
    hand-computed and matched to the paise, salary-structure revision being
    append-only (2 rows, one ACTIVE one SUPERSEDED), and the full gratuity
    lifecycle (fixed-term-eligible vs. permanent-ineligible at identical
    400-days tenure, a provisioning run, a same-tenure separation correctly
    producing a zero true-up adjustment, settlement, and settlement
    correctly refused for an ineligible employee).
  - **Verification caught and fixed a real deadlock bug** (not a logic bug —
    a hang): `gratuityRecords.ts`'s `runGratuityProvisioning` and
    `recordSeparation` both called `getPayrollLedgerIds(companyDb)` — the
    OUTER handle — from inside their own `companyDb.transaction()`
    callback, instead of using `trx`. This deadlocks Kysely's
    single-connection queue (the transaction holds the only connection; the
    nested call waits forever for one that will never free up) — and
    because nothing else was keeping Node's event loop alive, the process
    just exited silently with no crash, no thrown error, no stack trace,
    exit code 0, right after printing the section header and before any of
    that section's checks ran. This is exactly why `build`/`lint` never
    caught it and a real end-to-end run was needed. Fixed by resolving
    ledger IDs before opening the transaction (the pattern `postPayrollRun`
    already used correctly); grepped every other `companyDb.transaction()`
    block in every core-* package for the same anti-pattern and found no
    other occurrence.
  - Full workspace `nx run-many -t build` and `-t lint` (16 projects) clean
    with the Nx cache bypassed on both. Additionally ran `tsc --noEmit`
    directly against both the desktop-shell renderer and main-process TS
    projects (something this codebase's own verification method normally
    skips, per a standing Open Question since Phase 3) — clean except the
    already-documented, pre-existing `licenseHandlers.ts` latent error,
    confirmed untouched by this session's diff.
What's still pending in this phase: functionally complete against the
  Blueprint's one-line scope, full pass as the user chose. Explicit, flagged
  (not silent) simplifications — see Open Questions: PCT_OF_BASIC resolves
  against flagged-wage-base components rather than a designated "Basic"
  component; no salary-component edit/delete UI; leave entitlement is a flat
  annual grant, not accrued or pro-rated; no half-day leave applications; TDS
  regime is company-wide, not per-employee; no Form 16/24Q generation; no
  PF/ESI e-filing integration; no retroactive permissions/ledgers for
  pre-existing companies (same characteristic every prior module has had);
  the payroll-rules admin screen uses a raw JSON payload editor (the
  generic-rule-admin-UI gap Phase 2 first flagged, now present a third time).
Any decisions made (also add to Section 2): see Key Decisions Log entries
  dated 2026-09-07 — full-scope-in-one-pass, employee-table extension +
  second ledger, headcount-driven RuleSet-configurable applicability with
  sticky gratuity, new-regime-auto/old-regime-manual TDS, both gratuity
  calculators, and the deadlock bug/fix.
Any blockers (also add to Section 3): none. All Open Questions added this
  session are flagged simplifications, not blockers.
Next concrete step: this session's work is on a new branch
  (phase7/payroll, off `main` which already has Phase 6 fully merged), not
  yet committed/PR'd as of end of session, pending the user's go-ahead to
  commit and open the PR. Phase 8 (Advanced ERP: fixed assets with dual
  depreciation, cost centres, budgets, manufacturing, multi-currency,
  multi-branch) is next per the Blueprint sequence once Phase 7 is reviewed
  and merged.
```
Date: 2026-09-06 (session 17)
Phase: 6 (Expenses, Travel, Documents) — kicked off and completed in one pass
What was completed:
  - User confirmed Phase 5's PR (#13) had been merged to main and said "Done
    next?" — pulled main, checked the Phase Tracker's own stated next step
    (Phase 6 per the Blueprint sequence), and read the Blueprint's one-line
    Phase 6 spec (confirmed via full-text search there is nothing else, same
    situation as Phase 5).
  - Used plan mode (financial-logic gate): two Explore agents in parallel
    investigated (a) the identity/user model (confirmed no Employee master
    exists anywhere — AppUser is a bare name+email anchor, and the only
    "who did this" concept in any company-scoped table is a raw
    unenriched AppUser.id string) and the existing order state-machine
    pattern to mirror, and (b) the Blueprint's actual Phase 6 detail (none
    beyond the one-liner) plus existing file-handling precedent (confirmed
    there is zero prior art anywhere in this codebase for storing an
    arbitrary user file, either as a DB blob or on disk).
  - Surfaced three genuine design forks to the user via AskUserQuestion
    before drafting a plan: (1) new Employee master now vs. tying claims to
    the bare logged-in AppUser — user chose the new master (recommended);
    (2) BLOB-in-DB vs. on-disk-with-new-encryption for attachments — user
    chose BLOB-in-DB (recommended); (3) travel-as-category vs. a full
    pre-trip advance workflow — user chose travel-as-category
    (recommended). All three matched the recommended option.
  - A Plan agent then validated the resulting design against the real code
    and caught two real corrections before anything was built: (i) the
    outstanding-invoice-list/settlement-recording functions live in one
    file (`settlements.ts`), not the two-file split the draft assumed; (ii)
    `core-banking`'s `recordVoucherWithInstrument` is NOT directly reusable
    for reimbursement since it opens its own transaction with no hook for
    the settlement insert — `reimburseExpenseClaim` instead composes
    `createVoucherInTransaction` + `attachPaymentInstrumentInTransaction`
    directly inside its own transaction. Also confirmed zero default
    EXPENSE-nature ledgers exist in `chartOfAccounts.ts` (a seed function
    was required, not optional) and that `core-gst-engine`'s `seedGstLedgers`
    already sets the precedent for a later-phase package inserting a
    brand-new `account_group` row.
  - Built: new company-DB migration 011_expenses_documents.ts (employee,
    expense_claim, expense_claim_line, expense_claim_settlement,
    document_attachment — the last with the schema's first `'blob'`
    column); `core-accounting`'s VOUCHER_TYPES gained EXPENSE_CLAIM; two new
    pure-TS packages — `core-expense` (employees, claim lifecycle state
    machine mirroring salesOrders.ts's transitionStatus pattern, settlement/
    reimbursement mirroring recordPurchasePayment's validation) and
    `core-documents` (generic entity-agnostic attach/list/get/delete/search,
    zero dependency on core-accounting); new main-process expenseHandlers.ts/
    documentHandlers.ts (the latter reusing bankingHandlers.ts's native
    open-file-dialog pattern for both upload-pick and download-save); ~20
    new expense:/documents: IPC channels; new renderer screens
    (EmployeesScreen, NewExpenseClaimScreen + a new small ExpenseLinesEditor
    deliberately NOT reusing the GST/stock-coupled DocumentLinesEditor,
    ExpenseClaimRegisterScreen with Submit/Approve/Reject/Reimburse/Cancel
    actions, OutstandingReimbursementsScreen, a generic AttachmentsPanel,
    DocumentSearchScreen); AttachmentsPanel wired as an expandable per-row
    section into VoucherRegisterScreen, both invoice register screens,
    PartiesScreen, and BankAccountsScreen, alongside its primary use in the
    Expense Claim register; Dashboard/App.tsx wiring for all five new
    top-level screens, gated by the new EXPENSE.*/DOCUMENTS.* permissions.
  - Verified end-to-end (29 checks, throwaway tsx script run from repo root
    against a real encrypted company DB, deleted after): atomic employee+
    ledger+audit-log creation; full claim lifecycle DRAFT->SUBMITTED->
    APPROVED (posted voucher's Dr/Cr lines and balance verified)
    ->REIMBURSED via two partial reimbursements; the employee's ledger
    netting back to exactly zero once fully reimbursed; the new settlement
    guard rejecting cancellation of an already-reimbursed claim and
    succeeding on an unsettled one (with the cancelled claim's own expense
    ledger balance verified back to zero via computeLedgerBalances); the
    reject path leaving no voucher ever posted; and — the load-bearing check
    for the first-ever blob column in this schema — a document attached,
    retrieved, and compared BYTE-FOR-BYTE identical to the original buffer,
    plus filename and description search correctness and an audited hard
    delete. Full workspace `nx run-many -t build` (15 projects) and
    `-t lint` (16 projects) both clean when run sequentially — one flaky,
    non-reproducible ENOENT on a `desktop-shell` electron-vite temp config
    file surfaced only when build+lint ran in the same parallel batch (Nx
    itself flagged it as a flaky task); passed clean on immediate retry and
    when run as separate sequential passes, confirmed as a tooling race, not
    a code defect.
What's still pending in this phase: functionally complete against the
  Blueprint's one-line scope. Explicit, flagged (not silent) simplifications
  — see Open Questions: no retroactive Expense/Documents permissions for
  pre-existing companies (same characteristic every prior module has had);
  no settlement-cancellation guard added retroactively to the older Phase 2
  invoice-cancellation functions (a real, disclosed inconsistency); no
  pre-trip travel advance workflow; document search is filename/description
  only, no OCR/full-text extraction; AttachmentsPanel wired into a
  representative screen set, not literally every transaction-type screen;
  no employee self-service/login concept yet (expense claims are filed by an
  already-logged-in user on an employee's behalf).
Any decisions made (also add to Section 2): all seven Phase 6 rows in the
  Key Decisions Log — the three AskUserQuestion-confirmed design forks, the
  new Employee-Reimbursements-Payable account group (mirroring core-gst-
  engine's precedent), the claim lifecycle/voucher-posting design mirroring
  the sales/purchase order state machine, the new settlement-cancellation
  guard (genuinely new logic, no prior precedent), the reimbursement
  composition fix a Plan agent caught (createVoucherInTransaction +
  attachPaymentInstrumentInTransaction directly, not via
  recordVoucherWithInstrument), and the generic entity-agnostic document-
  attachment design (BLOB-in-DB, zero core-accounting dependency).
Any blockers (also add to Section 3): none new. Same standing sandboxed-
  environment limitation as every session (no interactive desktop for a
  real manual click-through — verified via real handler calls against a
  real encrypted DB instead, same as every prior phase).
Next concrete step: this session's work is on a new branch
  (phase6/expenses-travel-documents, off the current `main` which already
  has Phase 5 fully merged), not yet committed/PR'd as of end of session,
  pending the user's go-ahead. After this merges, Phase 7 (Payroll) is next
  per the Blueprint sequence — re-verify Labour Code final rules before
  starting, per the standing note on that row of the Phase Status Board, and
  note that Phase 7 should extend THIS session's new `employee` table with
  CTC/salary fields rather than building a parallel employee concept.
```

Date: 2026-09-06 (session 16)
Phase: 5 (Banking) — kicked off and completed in one pass
What was completed:
  - User said "Start phase 5." The Blueprint's entire spec for this phase is
    one line ("Bank accounts, reconciliation, cheque/UTR tracking," exit
    criterion "Bank rec matches ledger to the paisa") — used plan mode
    (financial-logic gate) to explore existing patterns (business_party's
    atomic ledger+master creation, computeLedgerBalances, per-module RBAC
    grant pattern, IPC/preload/screen wiring) via a background Explore agent,
    then a Plan agent to validate the design against the actual code
    (confirmed the bank-ledger debit/credit sign convention by reading the
    Payment/Receipt/Contra screens directly, not assuming it).
  - Asked the user via AskUserQuestion whether bank-statement CSV import
    should be in scope for this pass vs. manual tick-off only — user chose
    "Both," so the plan (and the build) includes a real CSV importer with
    column mapping and paisa-exact auto-matching, not just manual
    reconciliation.
  - Built: new company-DB migration 010_banking.ts (bank_account,
    voucher_payment_instrument, bank_reconciliation, bank_statement_import,
    bank_statement_line); new pure-TS @mhts/core-banking package (permissions,
    bankAccounts.ts, paymentInstruments.ts, reconciliation.ts,
    statementImport.ts — RFC4180 CSV parser + column-mapping + exact-amount/
    direction-aware/date-windowed matching); grantBankingPermissions wired
    into company creation (apps/desktop-shell/src/main/handlers.ts); new
    bankingHandlers.ts (main process) with the native open-file dialog for
    statement import, mirroring backupCompany's save-dialog pattern; ~15 new
    banking: IPC channels (shared/ipc.ts, main/index.ts, preload/index.ts);
    new renderer screens BankAccountsScreen, BankReconciliationScreen (tick-
    off checklist + reconciliation statement panel with a free-text actual-
    balance tie-out field), BankStatementImportScreen (file pick -> column
    mapping -> import -> per-line manual match resolution -> past-imports
    list), ChequeRegisterScreen, plus a shared PaymentInstrumentFields
    sub-form reused by the updated PaymentVoucherScreen/ReceiptVoucherScreen/
    ContraVoucherScreen (each now routes through one recordBankVoucher IPC
    call that degrades to a plain voucher post when no bank ledger/
    instrument is involved); Dashboard/App.tsx wiring for all four new
    screens, gated by the new BANKING.* permissions.
  - Verified end-to-end (23 checks, throwaway tsx script run from repo root
    against a real encrypted company DB via openCompanyDb/migrateCompanyDb,
    deleted after): atomic bank-account+ledger+audit-log creation; cheque
    instrument attach + status update (PENDING->CLEARED); a bank voucher
    with no instrument creates no instrument row; manual reconciliation;
    CSV parsing/column-mapping correctness (including the bank-statement
    CREDIT/DEBIT direction flip vs. the ledger's own debit/credit); auto-
    match on an exact-amount receipt; a deliberately-off-by-one-paisa line
    correctly staying UNMATCHED (never fuzzy-matched); the reconciliation
    statement's calculatedBankBalance tying to an independently-called
    computeLedgerBalances to the paisa, both mid-reconciliation and once
    fully reconciled. Full workspace `nx run-many -t lint,build
    --skip-nx-cache` across all 14 projects (including every pre-existing
    package) passed clean — no persisted test suite exists in this repo to
    re-run for a formal "regression suite," so this full clean build/lint
    across the whole dependency graph (with core-accounting/core-sales-
    purchase/core-inventory/core-gst-engine completely UNCHANGED — only new
    tables and new consumption of existing exports) is this session's
    regression signal.
What's still pending in this phase: functionally complete against the
  Blueprint's one-line scope. Explicit, flagged (not silent) simplifications
  — see Open Questions: no retroactive Banking permissions for pre-existing
  companies (same characteristic every prior module's additions have had);
  CC/OD account types get no special drawing-limit treatment; CSV column
  mappings aren't remembered/auto-detected per bank; a CONTRA between two
  bank ledgers reconciles each side fully independently (matches how two
  real bank statements would actually behave, not considered a gap).
Any decisions made (also add to Section 2): all seven Phase 5 rows in the
  Key Decisions Log — CSV-import-in-scope confirmation, the atomic bank-
  account creation pattern, cheque/UTR as a voucher attachment (not a new
  voucher type) with one recordVoucherWithInstrument entry point, bank
  reconciliation as a pure metadata layer covering every voucher type on the
  ledger, the CSV importer's parsing/matching design, the bank-statement
  direction-terminology flip (explicitly documented at every call site to
  prevent a silent reversal bug), and the reused `1/0 as unknown as boolean`
  better-sqlite3 workaround for a new call site.
Any blockers (also add to Section 3): none new. Same standing sandboxed-
  environment limitation as every session (no interactive desktop for a
  real manual click-through — verified via real handler calls against a
  real encrypted DB instead, same as every prior phase).
Next concrete step: this session's work is on a new branch
  (phase5/banking, off the current `main` which already has Phase 4 fully
  merged), not yet committed/PR'd as of end of session, pending the user's
  go-ahead. After this merges, Phase 6 (Expenses/Travel/Documents) is next
  per the Blueprint sequence.
```
```
Date: 2026-09-06 (session 15)
Phase: 4 (GST Engine) — Increment 2, "complete Phase 4"
What was completed:
  - User said "Complete Phase 4 then we can go with phase 5." Since this is
    real tax logic, offered a scope choice via AskUserQuestion (ITC+GSTR-1/
    3B only / everything including GSTR-9/9C+composition+reverse-charge /
    just ITC) — user picked "Everything, one pass." Also asked whether
    GSTR-1/3B/9/9C prep should aim for exact GSTN-upload JSON schema
    conformance or a CA-facing reference report — user said "Do your best
    recommendations," so proceeded with the recommended CA-facing-report
    approach (on-screen tables + plain CSV export), explicitly not
    attempting to match the GST portal's exact offline-utility schema.
  - Used plan mode (financial-logic gate, same as every prior GST session)
    given the size — comparable to a full Phase 2/3 build, not a small
    follow-up. Design review before coding caught the trickiest point up
    front: reverse charge must exclude the self-assessed GST from what's
    owed to the supplier (they never charged it) while still posting the
    real Dr Input/Cr RCM-Liability GL entries — designed as a self-
    balancing pair that never touches the party ledger, not a modification
    to the invoice total.
  - Noticed the PR for Increment 1 + the catalog follow-up had already been
    merged to `main` on GitHub since last session (two merge commits, #10
    and #11) — pulled `main` and started a fresh branch
    (phase4/itc-rcm-composition-gstr-returns) instead of continuing on the
    now-stale, fully-merged branch from last time.
  - Built: new company-DB migration 009_gst_itc_rcm.ts (itc_eligible/
    itc_ineligibility_reason/is_reverse_charge on invoice lines); new
    system-DB migration 008_gst_registration_type.ts (company.
    gst_registration_type, REGULAR|COMPOSITION, set once at creation only);
    4 new RCM Liability ledgers (seedGstLedgers extended); new pure
    computeGstSetOff (core-gst-engine) implementing the standard GST credit
    set-off order; ITC-eligibility and RCM branching rewritten into
    buildPurchaseVoucherLines (core-sales-purchase) with a returned
    per-line lineEligibility array so the stored itc_eligible column always
    reflects EFFECTIVE eligibility (accounting for composition-forced
    ineligibility), not just the raw request; composition suppression on
    the sales side (GST split resolved normally for HSN/audit purposes,
    then zeroed for a composition company); new gstReturns.ts
    (computeGstr1Data/computeGstr3bData/computeGstr9Data/computeGstr9cData)
    modeled on settlements.ts's existing join shape; new
    computeFinancialYearDateBounds in core-accounting (the inverse of the
    existing computeFinancialYearLabel) for GSTR-9/9C's full-FY date
    bounds; new csvExport.ts (main process) reusing backupCompany's native-
    save-dialog pattern; full desktop-shell wiring (DocumentLinesEditor
    gained ITC-eligible/reason/RCM controls, CreateCompanyScreen gained a
    GST-registration-type selector, GstSummaryScreen gained Net-Payable/
    Blocked-ITC/RCM sections, new tabbed GstReturnsScreen for all four GSTR
    reports with CSV export).
  - Verified end-to-end (27 new checks, throwaway tsx script against a real
    encrypted company+system DB, deleted after): ITC eligible-vs-blocked
    routing, RCM purchase (Input+RCM-Payable pair, party ledger excludes
    the GST), RCM sale (zero output tax, informational split still
    stored), composition sale (zero tax, HSN still recorded), composition
    purchase (forced ineligible despite the line requesting otherwise),
    computeGstSetOff's IGST-credit-spillover math against a hand-computed
    scenario, GSTR-1's B2B/B2C classification and HSN-summary aggregation,
    GSTR-3B's net payable matching an independent computeGstSetOff call,
    GSTR-9's FY aggregation matching a direct wide-range GSTR-3B call, and
    GSTR-9C's reconciliation gap correctly reflecting a real non-GST
    "Interest Income" journal entry. Also re-ran BOTH earlier Phase 4
    verification suites (18 + 12 = 30 checks) to confirm zero regression —
    caught and fixed a test-script bug of its own along the way (a
    convertSalesOrderToInvoice call had drifted out of position against
    the now-8-parameter signature, silently shifting `null` into the wrong
    slot; tsx's lack of type-checking hadn't caught it).
  - Build/lint clean across every touched package (twice, once with
    --skip-nx-cache for certainty); tsc --noEmit clean on both desktop-
    shell tsconfigs except the same pre-existing unrelated
    licenseHandlers.ts error flagged since session 11.
What's still pending in this phase: Phase 4 is now functionally complete
  against the Blueprint's one-line scope. Genuine, explicitly-flagged
  residual simplifications (see Open Questions, not oversights): no path to
  change composition scheme after company creation; no CMP-08 auto-posting
  for a composition dealer's own turnover-based liability; GSTR reports
  don't match the GST portal's upload JSON schema (confirmed scope choice);
  computeGstSetOff isn't the fully cash-optimal algorithm; GSTR-9 Part V
  (prior-year amendments) isn't modeled; existing companies don't get the
  new GST fields retroactively (same characteristic every prior module's
  additions have had).
Any decisions made (also add to Section 2): all in Key Decisions Log — the
  Increment 2 scope confirmation, the ITC/RCM/composition posting design,
  computeGstSetOff's algorithm choice, and the GSTR prep reports' CA-
  reference-report scope choice.
Any blockers (also add to Section 3): none. Same standing sandboxed-
  environment limitation as every session.
Next concrete step: this session's work is on a new branch
  (phase4/itc-rcm-composition-gstr-returns, off the now-current `main`
  which already has Increment 1 + the catalog follow-up merged), not yet
  committed/PR'd as of end of session, pending the user's go-ahead. After
  this merges, Phase 5 (Banking) is next per the user's own stated
  intent and the Blueprint sequence.
```

Date: 2026-09-06 (session 14)
Phase: 4 (GST Engine) — same-day follow-up on Increment 1
What was completed:
  - User uploaded a "GST HSN Master India September 2026" PDF and asked
    whether it had been added to the app. Read it in full: it turned out to
    be a summary/pointer document, not actual per-code rate data, and
    contained several numbers inconsistent with what this session had
    already verified via web search (e.g. a "Schedule VII at 28%" surviving
    past the 22 Sept 2025 reform, which eliminated 28% at the outset).
    Reported this back to the user plainly — did not import anything from
    it — and explained why (CLAUDE.md's own "verify before hardcoding"
    standard).
  - User then asked for GST rates configurable per product/category (their
    framing: "Hardware Items 18%, General groceries 5%, Electrical Items
    18%... irrespective of business") instead of everything defaulting to
    18%. Restated understanding back to the user per their own requested
    process ("give me your understanding, I'll verify, then say go") rather
    than building immediately — this is tax configuration, same financial-
    logic gate as the rest of Phase 4. Proposed a concrete ~54-code/14-
    category starter catalog + a category-browse HSN picker design; user
    reviewed and said "go, keep it editable so we can edit manually if
    change in future tax."
  - Built on the same branch (phase4/gst-rate-engine-invoice-wiring, not yet
    merged — this is a direct extension of the same increment, not a new
    unit of work): expanded core-gst-engine's DEFAULT_GST_RATE_SEEDS from 5
    examples to ~54 codes across 14 categories; added optional
    category/description fields to GstRatePayload (no migration — they ride
    inside the existing rule_set JSON payload); new GstHsnPicker.tsx
    component (category dropdown -> filtered code dropdown -> fills
    hsnSacCode, with a manual-entry escape hatch) wired into ManageItems and
    the invoice line editor; ManageGstRatesScreen gained category/
    description fields plus a per-row "Edit" button that pre-fills the form
    (satisfies the user's "keep it editable" requirement without adding any
    new editing mechanism — createOrUpdateGstRate's existing versioning
    already covered it).
  - Caught and fixed a real bug before it shipped: two draft catalog entries
    (plain bread / cakes) both used HSN heading 1905, which would have
    silently overwritten one with the other (rates key purely on the code).
    Merged into one "Bakery products" entry with a note on the collapsed
    nuance; added an explicit duplicate-code regression check to the
    verification script.
  - Verified end-to-end (12 new checks, throwaway tsx script against a real
    encrypted system DB, deleted after): catalog breadth (54 codes, 14
    categories), zero duplicate-code collisions, category/description
    round-tripping, a category-picked code resolving correctly through the
    unchanged resolveGstRate/computeGstSplit engine, and editing an existing
    catalog rate correctly versioning (old rate stays queryable) while
    preserving category/description. Also re-ran the full original Phase 4
    suite (18 checks) to confirm zero regression to invoice posting/
    cancellation/rate-change-simulation from the type changes.
  - Build/lint clean across core-gst-engine and desktop-shell; tsc --noEmit
    clean on both desktop-shell tsconfigs except the same pre-existing
    unrelated licenseHandlers.ts error flagged in sessions 11-13.
What's still pending in this phase: same as session 13's handoff — ITC
  eligibility/reversal, GSTR-1/3B/9/9C filing-format prep, composition
  scheme/reverse charge, party GST-registration-type. The catalog is still
  a curated starter (54 codes), not an official master (~21,000 real HSN
  codes exist) — businesses add their own as needed, same mechanism either way.
Any decisions made (also add to Section 2): all in Key Decisions Log — the
  catalog/category design, the optional category/description fields on
  GstRatePayload, and the 1905 duplicate-code bug found and fixed.
Any blockers (also add to Section 3): none. Same standing sandboxed-
  environment limitation as every session.
Next concrete step: this session's work is an additional commit on the
  still-open phase4/gst-rate-engine-invoice-wiring branch/PR, pending the
  user's go-ahead to push. After that: same fork in the road as session 13
  (a further Phase 4 follow-up, or Phase 5 per Blueprint sequence).
```

Date: 2026-09-06 (session 13)
Phase: 4 (GST Engine) — kicked off, scoped to Increment 1
What was completed:
  - User said "Start phase 4". Read CLAUDE.md, Blueprint, and the Phase
    Tracker's latest handoff (session 12) per standing process. Web-searched
    to re-verify current GST slab rules per the Tracker's own flag — confirmed
    the 22 Sept 2025 reform's 0%/5%/18%/40% (3% gold/silver) structure is
    still current as of today, no further change.
  - Explored the existing codebase (two Explore agents) before planning:
    confirmed DocumentLineInput already had manual taxLedgerId/taxAmount
    fields with a comment explicitly deferring GST auto-computation to Phase
    4; business_party/company/item already carry gstin/state_code/
    hsn_sac_code from earlier phases; core-rules-engine (built for TDS in
    Phase 2) is the ready-made mechanism for versioned GST rates; core-gst-
    engine was an empty scaffolded stub.
  - Used plan mode (financial-logic gate). Asked the user to choose Phase
    4's scope for this pass among three options (core rate engine + invoice
    wiring / everything in the Blueprint's Phase 4 line / just the rate
    engine mechanism) — user picked the recommended middle option ("Core
    rate engine + invoice wiring"), deferring ITC eligibility and GSTR-1/3B/
    9/9C prep to a follow-up, same base-scope-then-follow-up pattern as
    Phase 3.
  - Built on branch phase4/gst-rate-engine-invoice-wiring: migration
    008_gst.ts (new amount/hsn columns on invoice/order lines, no new
    tables — GST rates live in the existing system-DB rule_set); new
    core-gst-engine package (gstRates.ts, gstSplit.ts, ledgers.ts,
    permissions.ts, gstSummary.ts); core-sales-purchase wired to resolve
    GST per line (new gstLineResolution.ts) and post CGST/SGST/IGST/Cess
    voucher lines alongside the pre-existing manual-tax path (mutually
    exclusive, enforced in lineValidation); desktop-shell wiring end to end
    (gstHandlers.ts, IPC channels/types, preload, DocumentLinesEditor.tsx
    live preview, new Manage GST Rates + GST Summary screens, Dashboard/App
    routing).
  - A real bug was caught and fixed during implementation (not by testing
    afterward): listSalesInvoices/listPurchaseInvoices's taxAmount SQL
    aggregate only summed the old tax_amount column — would have silently
    under-reported the tax total for any GST-computed invoice. Fixed to sum
    tax_amount + cgst_amount + sgst_amount + igst_amount + cess_amount
    (safe since the two paths are mutually exclusive per line).
  - Verified end-to-end (18 checks, a throwaway tsx script run against a
    real encrypted SQLCipher company+system DB via openSystemDb/
    openCompanyDb with raw keys, then deleted): intra-state CGST+SGST split,
    inter-state IGST, purchase-side Input GST posting, the regression case
    (a line with no hsnSacCode posts exactly as before), mutual-exclusivity
    validation rejecting a line with both manual tax and an HSN/SAC code,
    the rate-change simulation (old invoice untouched, new invoice picks up
    the new rate — the Blueprint's literal exit criterion), cancellation
    reversing both output and input GST back to exactly zero, order-to-
    invoice conversion forwarding hsnSacCode correctly, and the GST Summary
    report reconciling exactly to the underlying ledger balances.
  - `tsc --noEmit` clean on both desktop-shell tsconfigs (node + web) except
    the same pre-existing unrelated licenseHandlers.ts error flagged in
    session 11/12 (confirmed still untouched). Lint and Nx build clean
    across every touched package.
What's still pending in this phase: ITC eligibility/reversal, GSTR-1/3B/9/9C
  filing-format prep, composition scheme/reverse charge, party GST-
  registration-type — all explicitly deferred, see Open Questions (not
  oversights; genuinely separate pieces of work).
Any decisions made (also add to Section 2): all in Key Decisions Log —
  Increment 1 scope choice, the place-of-supply split design, the new Input
  Tax Credit asset group, the DocumentLineInput/schema changes, and the
  "GST reversal needed zero new code" finding.
Any blockers (also add to Section 3): none. Same standing sandboxed-
  environment limitation as every session: no interactive desktop session,
  so this is verified via real handler calls (plus a throwaway end-to-end
  script this session, since core-gst-engine/core-sales-purchase's new code
  paths needed exercising beyond what existing IPC handlers alone could
  reach quickly), not an actual mouse click.
Next concrete step: this session's work is on branch
  phase4/gst-rate-engine-invoice-wiring, not yet committed/PR'd as of end of
  session, pending the user's go-ahead. Next most concrete step after that:
  either a Phase 4 follow-up (ITC eligibility, or GSTR-1/3B prep) or Phase 5
  (Banking) per Blueprint sequence — user's call.
```

Date: 2026-09-06 (session 12)
Phase: 3 follow-up (stock-movement reversal / invoice-cancellation)
What was completed:
  - User asked what to work on next after session 11 shipped Phase 3 base
    scope and its PR; offered Phase 4 (GST Engine) or a Phase 3 follow-up
    (stock reversal / alternate UOM / auto-batch-selection) — user picked
    "Phase 3 follow-ups", then asked for a recommendation among the three;
    recommended stock-aware invoice cancellation as the highest-value gap
    (closes a real data-integrity hole; the other two are pure feature
    gaps, not correctness gaps) and the user agreed.
  - New branch phase3/stock-invoice-cancellation-reversal (off the still-
    unmerged phase3/inventory-items-warehouses-valuation, since this
    depends on that code). Used plan mode again (financial-logic gate) —
    the design-review pass, reading the actual shipped code rather than a
    summary, caught two real BLOCKING prerequisite bugs before writing any
    reversal code: postStockAdjustmentInTransaction's ADJUSTMENT_OUT/FIFO
    branch silently discarded consumeFifoLayersInTransaction's
    .consumptions (never wrote stock_movement_layer_consumption rows,
    unlike the sales-issue/transfer-out code paths); and
    VoucherRegisterScreen.tsx's generic "Cancel" button called the plain
    unguarded cancelVoucher for EVERY voucher type shown there — a LIVE,
    already-merged bypass letting a user cancel a stock-linked invoice via
    the Voucher Register instead of the dedicated register, completely
    sidestepping the guard built in session 11. Both fixed as prerequisites
    before the reversal feature itself, not deferred.
  - Built full reversal: reversing an outbound movement (SALES_ISSUE,
    ADJUSTMENT_OUT) is always safe regardless of chronology (credits back
    to the exact FIFO layer(s) via stock_movement_layer_consumption, or a
    plain compensating movement for weighted-average). Reversing an inbound
    movement (PURCHASE_RECEIPT, ADJUSTMENT_IN) needed a real eligibility
    check: FIFO verifies its layer is untouched since receipt; weighted-
    average verifies it's the most-recent movement for that scope (via
    SQLite's implicit rowid, zero migration). New core-inventory
    stockReversals.ts; core-accounting's cancelVoucher split into
    cancelVoucherInTransaction/cancelVoucher (mirrors createVoucher's
    existing split) so stock reversal and voucher reversal commit
    atomically together; cancelSalesInvoice/cancelPurchaseInvoice's public
    parameter changed from the invoice's own id to voucherId so the generic
    Voucher Register can route to them with the only identifier it has.
  - Verified end-to-end across 8 scenarios against a real encrypted company
    DB (full detail in Key Decisions Log) — full round-trip restoration of
    both stock AND all three affected ledgers, all-or-nothing rollback when
    a reversal is ineligible, the deliberately-conservative weighted-
    average rule, both prerequisite fixes, a latent unrelated same-day FIFO
    tiebreak bug found and fixed alongside (UUID-lexicographic order
    instead of insertion order — same rowid mechanism), reversal working
    correctly through a TRANSFER_IN-sourced layer with no special-casing,
    and the cancelVoucher split not changing behavior for plain vouchers.
  - Build/lint clean across all touched packages; tsc --noEmit clean except
    the same pre-existing unrelated licenseHandlers.ts error flagged last
    session (confirmed still untouched via git diff main).
What's still pending in this phase: nothing blocking. The three Phase 3
  follow-up items from session 11 are now down to two: alternate UOM
  conversion and auto-batch-selection on issue remain undone (stock
  reversal, the one done this session, was the recommended priority).
  Genuine, explicitly-scoped deferrals from THIS follow-up (see Open
  Questions): the weighted-average eligibility rule is deliberately
  conservative (blocks on any later movement, not just a later outbound
  one) rather than the tightest-possible rule; still no automated test
  harness for this math (now covers reversal too, not just valuation).
Any decisions made (also add to Section 2): all in Key Decisions Log — the
  full reversal mechanism design, the two prerequisite fixes, the
  cancelVoucher split, and the voucherId re-keying of the invoice cancel
  functions.
Any blockers (also add to Section 3): none. Same standing sandboxed-
  environment limitation as every session: no interactive desktop session,
  so this is verified via real handler calls, not an actual mouse click.
Next concrete step: Phase 4 (GST Engine, re-verify current slab rules
  first) is next in Blueprint sequence. Remaining Phase 3 follow-ups
  (alternate UOM conversion, auto-batch-selection on issue) are the next
  most concrete Phase-3-adjacent gaps if more inventory work is wanted
  instead. This session's work is on branch
  phase3/stock-invoice-cancellation-reversal, stacked on the still-open
  phase3/inventory-items-warehouses-valuation PR — not yet committed or
  PR'd as of end of session, pending the user's go-ahead.
```

Date: 2026-09-06 (session 11)
Phase: 3 (Inventory) — kicked off AND completed in one session
What was completed:
  - User chose to start Phase 3 (offered alongside role deletion and a
    disaster-recovery backup path as the other live options). Since this
    phase touches financial logic (stock valuation feeding COGS postings),
    used plan mode per CLAUDE.md: 3 parallel Explore agents mapped how
    Phase 1/2 actually work (voucher engine, invoice-line shape, Electron
    IPC/UI wiring conventions), then a dedicated design-review agent
    pressure-tested the draft design BEFORE any code was written. That
    review caught two real defects: (1) a rounding bug — naive exact-
    equality validation of qty*rate vs. a line's amount would reject
    ordinary fractional-quantity lines; (2) a data-integrity gap — invoice
    cancellation would silently desync stock from the ledger, since
    core-accounting's generic cancelVoucher has no idea stock movements
    exist. Both were designed around before implementation, not discovered
    by testing afterward.
  - Built and verified in 4 stages, each checked end-to-end before the
    next: (1) schema (migration 007) + Unit/Warehouse/Item/Batch master
    data + permission/ledger seeding; (2) the standalone FIFO/weighted-
    average stock engine (receipts, issues, opening stock, adjustments,
    transfers, on-hand position reporting) with zero invoice wiring yet;
    (3) Sales/Purchase invoice integration (stockable item lines move
    stock and, on a sale, post a self-balancing COGS voucher-line pair on
    the SAME atomic voucher) plus the cancellation guard; (4) UI — Manage
    Units/Warehouses/Items, Record Opening Stock, Stock Adjustment, Stock
    Transfer, Stock Summary, Stock Movement Register, a Stock Valuation vs
    Ledger reconciliation view, and an item-picker mode added to the
    shared DocumentLinesEditor (used by all 4 sales/purchase invoice/order
    screens).
  - Verified end-to-end at every stage via real throwaway scripts calling
    the actual handler/core functions against a real encrypted company DB
    (same precedent as every prior session) — NOT just build success.
    Specifically checked and passing: multi-layer FIFO consumption with
    exact rounding-remainder absorption (a layer received at a non-round
    rate, drawn down across two issues, ends at precisely zero remaining
    value); weighted-average costing's single bounded rounding step;
    batch isolation (issuing from one batch never touches another);
    insufficient-stock attempts throw and leave zero partial movement
    (transaction rollback verified, not just the throw); stock
    transfers preserving original FIFO received_at across warehouses
    (destination issues drew the older-dated layer first); a stockable
    purchase line rejected when posted to the wrong ledger; a stockable
    sale posting one voucher with the AR/Sales/tax lines AND the COGS
    pair, with Stock-in-Hand/COGS/Sales ledger balances and item-level
    stock position all matching hand-calculated expectations; the
    cancellation guard rejecting a stock-linked invoice while a plain
    invoice still cancels exactly as before (regression check); and order-
    to-invoice conversion correctly carrying item/quantity fields through
    (validating the mapper fix the design review flagged).
  - Also ran `tsc --noEmit` directly against desktop-shell's node and web
    tsconfigs (not previously part of this project's verification routine,
    which relies on Vite/esbuild build success + eslint + real e2e calls —
    Vite does NOT type-check). This caught one real omission (ipc.ts's
    renderer-facing VoucherType didn't include the new STOCK_ADJUSTMENT
    voucher type) and separately surfaced one PRE-EXISTING, unrelated type
    error in licenseHandlers.ts (confirmed via `git diff main` untouched by
    this session) — left unfixed as out of scope, flagged in Open
    Questions rather than silently ignored or silently fixed.
What's still pending in this phase: nothing blocking; Phase 3 is complete
  per the Blueprint's stated scope. Genuine, explicitly-scoped deferrals
  (see Open Questions): no automatic stock reversal on invoice cancellation
  (hard guard instead — the schema already carries what a future reversal
  pass needs, no backfill required later); no alternate-UOM conversion; no
  automatic batch selection on issue (caller must specify); Sales/Purchase
  Order lines don't carry batch fields (converting a batch-tracked order
  line fails loudly, not silently); no automated test harness for the
  FIFO/weighted-average math; item/unit/warehouse list permissions are
  scoped narrowly (fine for the seeded Admin role, a gap for a future
  sales-only custom role).
Any decisions made (also add to Section 2): all in Key Decisions Log —
  quantity-as-thousandths-of-a-unit convention (mirrors paise-not-float for
  money); FIFO remainder-absorption technique; one-directional
  core-sales-purchase → core-inventory package dependency; cancellation-
  guard-instead-of-full-reversal scope decision.
Any blockers (also add to Section 3): none for this phase. The pre-existing
  licenseHandlers.ts type error (unrelated, not introduced this session) is
  noted in Open Questions for a future look. The standing sandboxed-
  environment limitation continues to apply: the new UI screens are
  verified only via real handler calls, not an actual mouse click — same
  caveat as every module built so far.
Next concrete step: Phase 4 (GST Engine) is next in Blueprint sequence —
  the Phase Status Board flags "re-verify current GST slab rules before
  starting." Phase 3's deferred items (stock reversal, alternate UOM,
  auto-batch-selection) are the next most concrete Phase-3-adjacent gaps
  if more inventory work is wanted instead. This session's work is on
  branch `phase3/inventory-items-warehouses-valuation`, uncommitted as of
  end of session — pending the user's go-ahead to commit and open a PR
  (per CLAUDE.md git workflow), not yet requested.
```

```
Date: 2026-09-06 (session 10)
Phase: 0 (Foundation follow-ups)
What was completed:
  - User asked to "complete your recommendations" after session 9; since
    that phrase had more than one plausible referent (the two small
    follow-ups I'd flagged, Phase 3 Inventory, or both), confirmed scope
    before writing code rather than guessing — user chose the two small
    follow-ups: custom role creation/editing, and a license expiry-reminder
    banner. Both built on the still-open session 9 branch
    (phase0/foundation-leftovers-and-bill-wise-allocation), since they're
    small and directly related.
  - Custom role creation/editing: new listAllPermissions (reads the company
    DB's existing shared permission table — already complete since every
    module inserts its own rows there at company creation, so no new
    bookkeeping needed), listRolesWithPermissions, createRole, and
    updateRolePermissions, all added to @mhts/core-identity (existing home
    of Role/Permission logic). New ManageRolesScreen: create a role with a
    checked subset of permissions (grouped by module prefix), edit an
    existing custom role's permissions (replaces the set, not merges).
    Deliberately did NOT build role deletion — a role id is referenced from
    company_access in the SYSTEM DB, invisible to a company-DB-only check,
    so safe deletion needs cross-database validation not built yet
    (flagged in Open Questions). The built-in Admin role is hard-blocked
    from being edited through this path (accidentally stripping its own
    management permissions would lock a company out of managing itself).
  - License expiry reminder: LicenseStatus gained expiresInDays (null for a
    perpetual license), computed purely for a UI "renew soon" banner
    (<=30 days) on the Company List screen — kept fully separate from the
    actual pass/fail validity check, which already handles real expiry
    correctly regardless of this field.
  - Verified end-to-end against real encrypted files (same throwaway-script
    precedent as every session, calling the actual handler functions, run
    in a real Electron process): listAllPermissions returns the full
    cross-module list; a custom "Accountant" role is created with exactly
    the granted permissions; duplicate role names and non-existent
    permission codes are both rejected; editing a custom role's permissions
    correctly replaces (not merges) the set; editing the built-in Admin
    role is correctly rejected; a perpetual license reports
    expiresInDays: null; a second license signed 10 days from expiry
    (using the same real Ed25519 dev key from session 9) correctly reports
    expiresInDays: 10. Then relaunched the real packaged app fresh (cleared
    node_modules/.vite + out/, isolated --user-data-dir) — confirmed no
    bundled require("@mhts/...")/require("kysely") remained and the app
    created a real encrypted system.db and stayed running with no crash.
What's still pending: nothing blocking. Genuine open items (all flagged,
  not oversights, all carried over or newly added to Open Questions): role
  deletion still isn't possible (only permission-editing); backup/restore
  has no cross-install disaster-recovery path; the private signing key
  still needs to move to real secured storage (unchanged from session 9);
  Form 26Q/16A generation, a TDS-rate admin UI, and 194Q's turnover-
  eligibility gate (carried over from Phase 2); the manual GUI click-through
  STILL hasn't happened (unchanged — this sandboxed environment has no
  interactive desktop session).
Any decisions made (also add to Section 2): role management added to
  core-identity rather than a new package; Admin (system) role hard-blocked
  from permission edits; role deletion deliberately deferred pending a
  cross-database safety check; expiresInDays kept fully separate from the
  actual validity check. All logged above with full reasoning.
Any blockers (also add to Section 3): unchanged from session 9 — team
  allocation, white-label/reseller legal agreement, CA/compliance advisor
  retention, and moving the license private key to real secured storage.
Next concrete step: this session's changes are additional commits on the
  still-open phase0/foundation-leftovers-and-bill-wise-allocation branch —
  get that PR opened/reviewed/merged before starting anything new. After
  that: Phase 3 (Inventory) is the Blueprint's next phase in sequence;
  role deletion and a disaster-recovery backup path are the two most
  concrete Phase-0-adjacent gaps left if more foundation work is wanted
  instead.
```

```
Date: 2026-09-06 (session 9)
Phase: 0 (Foundation leftovers) + 2 (bill-wise payment allocation follow-up)
What was completed:
  - Phase 2 PR (session 8, phase2/sales-purchase-core) was reviewed and
    merged into main by the user. Verified after merge: main's tree matched
    the tested branch exactly (empty diff), and a fresh
    `nx run-many -t build,lint` from main passed clean across all 12
    projects.
  - User chose "Phase 0 leftovers" + "bill-wise payment allocation" as this
    session's scope (declined Phase 3 Inventory for now). Two design
    questions were put to the user before writing code per the plan-first
    rule: license-gating strictness (soft gate chosen, with a real dev
    license generated so testing is never blocked) and the bill-wise
    allocation design (approved as proposed).
  - Invite-a-new-user flow: new inviteUser (core-identity's DEK-rewrap
    pattern, reused from the existing admin password reset) + listRoles;
    ManageUsersScreen gained a real invite form. Custom role creation itself
    is still not built (only the seeded Admin role exists to invite into) —
    flagged in Open Questions, not silently worked around.
  - Theme engine: a single global stylesheet (styles.css, CSS custom
    properties, data-theme toggle) themes every screen with zero per-screen
    changes, since none of them set their own background/text color to
    begin with. Preference persists in a new app_preference system-DB
    table. White-labeling is separate and build-time: brand.config.json
    (app name, accent color) — a reseller build only edits that file.
  - Backup/restore: backup copies the company's encrypted DB file
    byte-for-byte to a user-chosen location (native save dialog). Restore
    is deliberately careful given how hard-to-reverse a mistake would be —
    captures the session DEK and closes the live connection first, makes
    its own pre-restore safety copy, copies the chosen backup in, verifies
    by opening-and-querying with the captured DEK, and rolls the safety copy
    back on ANY failure. Scoped to same-company/same-install only (not a
    full disaster-recovery migration path — flagged, not built).
  - Licensing/white-label plumbing: generated a REAL Ed25519 keypair. The
    private key is NOT in this repo — handed to the user to move into their
    own secure storage; a new scripts/generate-license.mjs (standalone,
    never imported by the shipped app) is the only thing that can sign a
    license. New @mhts/core-licensing package embeds only the PUBLIC key
    and verifies signature + expiry; hardware binding is enforced locally
    (a new license_activation system-DB table records the first machine a
    licenseId activated on; a later check from a different machine for the
    same licenseId is rejected — loading a different, still-valid license
    legitimately overwrites the record). Soft-gated per the user's explicit
    choice: only NEW company creation requires a valid license, so a
    lapsed/missing one can never lock a customer out of an existing
    company's data. A real signed dev/test license was generated and its
    path handed to the user so this could never block their own testing.
  - Bill-wise (invoice-level) payment allocation: new
    sales_invoice_settlement/purchase_invoice_settlement tables link a
    Receipt/Payment voucher to the specific invoice(s) it settles (partial
    settlement allowed, validated against the CURRENT remaining outstanding).
    New CustomerReceiptScreen/SupplierPaymentScreen are additive alongside
    the existing generic Payment/Receipt screens. This directly upgrades
    listMsmeAgeing from FIFO-estimated to exact wherever settlement data
    exists (falls back to the same FIFO assumption only for whatever isn't
    covered by real settlements yet — a pure improvement, not a behavior
    change for existing data).
  - A real bug was caught during end-to-end verification (not by tsc/lint):
    listOutstandingSalesInvoices's query originally LEFT JOINed both
    sales_invoice_line AND sales_invoice_settlement in the same query,
    fanning out (each line duplicated once per settlement row) and silently
    inflating the computed taxable amount, so a fully-settled invoice never
    actually disappeared from the outstanding list. Fixed by computing
    settled amounts via the separate, correctly-grouped query the code
    already had, instead of joining it into the same one. This is exactly
    why the project's verify-with-real-handler-calls discipline matters —
    this would have shipped silently wrong otherwise.
  - Verified end-to-end against real encrypted files (same throwaway-script
    precedent as every session, calling the actual handler functions, run
    in a real Electron process): company creation correctly blocked with no
    license; the real signed dev license verifies and machine-binds; a
    tampered machine-id binding is correctly rejected and correctly
    re-accepted once restored; invite-user's full temp-password ->
    forced-change -> real-session flow works and duplicate invites are
    rejected; theme preference reads/writes correctly; partial bill-wise
    settlement reduces outstanding correctly, over-settlement is rejected,
    full settlement clears the invoice from the outstanding list; an
    MSME invoice correctly drops out of ageing once fully bill-wise-settled
    even though it's past due; backup produces a real independently-
    openable encrypted file, a corrupt/wrong restore attempt correctly rolls
    back leaving real data untouched, and a valid restore correctly rolls
    the company back to an earlier snapshot. Then relaunched the real
    packaged app fresh (cleared node_modules/.vite + out/, isolated
    --user-data-dir) — confirmed no bundled require("@mhts/...")/
    require("kysely") remained and the app created a real encrypted
    system.db and stayed running with no crash.
What's still pending: nothing blocking. Genuine open items (all flagged, not
  oversights): no custom-role creation UI (only the seeded Admin role
  exists); backup/restore has no cross-install disaster-recovery path; no
  license expiry-reminder UI; the private signing key needs to move to real
  secured storage and an authorization process decided; Form 26Q/16A
  generation, a TDS-rate admin UI, and 194Q's turnover-eligibility gate
  (carried over from Phase 2); the manual GUI click-through STILL hasn't
  happened (this sandboxed environment has no interactive desktop session —
  true in every session so far, not new this time).
Any decisions made (also add to Section 2): soft license gating (user's
  explicit choice over hard-gating); Ed25519 keypair generated for real,
  private key kept out of the repo entirely, signing tool kept standalone;
  local (not license-file-embedded) hardware binding; dedicated
  app_preference table over generic key-value settings; theme via a single
  global stylesheet since no screen sets its own colors; bill-wise
  settlement schema and its cancellation-aware query pattern. All logged
  above with full reasoning.
Any blockers (also add to Section 3): Team allocation, white-label/reseller
  legal agreement, CA/compliance advisor retention — all still pending,
  unchanged. New: the license private key needs to move to real secured
  storage (currently only in this session's ephemeral scratchpad) before
  anyone relies on it — see Open Questions.
Next concrete step: Phase 3 (Inventory) is the Blueprint's next phase in
  sequence and would let Sales/Purchase invoice lines reference real stock
  items. Alternatively: build custom-role creation/editing (the invite-user
  flow's most obvious next gap), or a license expiry-reminder UI. This
  session's changes are uncommitted on main as of this entry — commit,
  branch, and PR them before starting anything new (see CLAUDE.md's git
  workflow).
```

```
Date: 2026-09-05 (session 8)
Phase: 2 — Sales + Purchase — kicked off AND completed in this session, all
  three of base scope/vendor TDS/Sales+Purchase Orders (user explicitly chose
  "do all three" over the initially-proposed staged/deferred scope)
What was completed:
  - Proposed a staged Increment-1 plan (defer TDS and Orders) per this
    project's plan-first rule for financial logic; user asked for all three
    in one pass instead, so the plan below reflects the full combined scope.
  - New `business_party` table (migration 005, company DB) unifying
    customers/suppliers via a `party_type` discriminant (CUSTOMER/SUPPLIER/
    BOTH) rather than two separate tables, since a real counterparty is
    often both. Each party gets its own dedicated ledger sub-account under
    the EXISTING Sundry Debtors/Sundry Creditors groups (Phase 1 already
    seeds these — no new default chart-of-accounts groups were needed for
    Phase 2 at all), created atomically alongside the party row.
  - `sales_invoice`/`sales_invoice_line` and `purchase_invoice`/
    `purchase_invoice_line` tables — deliberately carry NO financial_year or
    invoice-number columns of their own: each invoice posts a real voucher
    (new voucher types SALES_INVOICE/PURCHASE_INVOICE) through the unchanged
    Phase 1 double-entry engine, and voucher.voucher_number (already
    sequential per type+year) IS the invoice number, joined via voucher_id.
  - `sales_order`/`purchase_order` (+ line tables) — DO get their own
    sequential numbering (no voucher exists yet pre-conversion). Lifecycle:
    DRAFT -> CONFIRMED -> CONVERTED (or CANCELLED from DRAFT/CONFIRMED).
    Converting copies the order's lines into a brand-new invoice (a REAL
    ledger posting) and marks the order CONVERTED.
  - Refactored `core-accounting`'s createVoucher into a thin wrapper over a
    newly-exported `createVoucherInTransaction(trx, input, actorUserId)`,
    and applied the identical split to core-sales-purchase's
    createSalesInvoice/createPurchaseInvoice (-> ...InTransaction variants).
    convertSalesOrderToInvoice/convertPurchaseOrderToInvoice use the
    ...InTransaction variants directly so the invoice-and-its-voucher AND the
    source order's CONVERTED status update commit or roll back as ONE
    transaction — closes a real atomicity gap an earlier draft had (a crash
    between two separate transactions could leave a posted invoice pointing
    at an order that still read CONFIRMED, inviting an accidental duplicate
    invoice on retry). Matches the Blueprint's literal Phase 2 exit criterion
    ("full invoice-to-ledger-to-report chain, atomic").
  - Vendor TDS (194C/194J/194Q/194I): section codes are a small fixed
    vocabulary in core-sales-purchase (like VOUCHER_TYPES); the RATE and
    THRESHOLD for each are resolved from the system DB's `rule_set` table via
    a newly-real `@mhts/core-rules-engine` (createRuleSetVersion/
    resolveEffectiveRule/listRuleSetVersions — date-effective lookup +
    versioning, a superseded rate gets an end date, never edited in place).
    core-rules-engine had been a deliberate Phase 0 stub ("resolution logic
    out of scope for this pass"); it's now real, and GST (Phase 4)/payroll
    (Phase 7) inherit a working mechanism instead of building their own.
    TDS is threshold-aware (computeTdsAmount), not flat-rate-on-the-whole-
    invoice: sums a party's prior cumulative taxable value under that section
    this FY, taxes only the portion of THIS invoice above the threshold.
    Seeded default rates are flagged in their source_reference as simplified
    pending CA review (real sub-cases collapsed to one representative rate
    per section) — installation-wide seeding happens ONCE at app bootstrap
    (main/index.ts), never per-company (rule_set is shared across every
    company, per the existing two-tier System/Company DB design).
  - Section 43B(h): purchase_invoice snapshots is_msme_vendor + a computed
    due_date (min(credit period, 45 days) for a flagged MSME vendor) at
    creation time, so a later edit to the party can't rewrite a past
    invoice's ageing. New listMsmeAgeing report (FIFO settlement assumption —
    see Open Questions) flags overdue MSME invoices.
  - Receivables/Payables: exact party-level outstanding balance, reusing
    Phase 1's computeLedgerBalances completely unchanged (each party's own
    ledger balance IS their outstanding amount).
  - RBAC: new SALES.*/PURCHASE.* permission codes (MANAGE_PARTIES,
    CREATE_INVOICE, CREATE_ORDER, VIEW_REPORTS), granted the same way
    ACCOUNTING.* ones are, at company creation.
  - Real (not fake) UI: PartiesScreen, New/Register screens for Sales and
    Purchase Invoices AND Orders (order registers have Confirm/Cancel/Convert
    actions), Receivables/Payables/MsmeAgeing screens — a dozen new screens,
    all wired through real IPC handlers (new salesPurchaseHandlers.ts) to the
    real core-sales-purchase logic, gated on the new permissions, reachable
    from the Dashboard. A shared DocumentLinesEditor component (description +
    ledger + amount + optional tax ledger/amount per line) is reused across
    all four invoice/order creation screens rather than duplicated 4x, given
    each line has more fields than the existing Payment/Receipt lines.
    Invoice cancellation reuses the EXISTING generic cancelVoucher unchanged
    (an invoice IS a voucher underneath) — no new cancellation mechanism.
  - Verified end-to-end against real encrypted files (same throwaway-script
    precedent as every prior session, calling the actual handler functions,
    run in a real Electron process): company+parties created; a sales
    invoice with a manual tax line posts correctly and the customer's ledger
    debit balance in the Trial Balance matches exactly; a Rs 2,00,000
    purchase invoice under 194C correctly deducts Rs 2,000 TDS (threshold-
    aware: 2% of only the Rs 1,00,000 excess over the section's Rs 1,00,000
    threshold) with the MSME due date correctly capped at 45 days; Payables
    correctly shows the NET (post-TDS) amount owed; MSME ageing correctly
    flags the invoice as 1-day overdue the day after due, and shows nothing
    overdue on the invoice date itself; a sales order's full DRAFT ->
    CONFIRMED -> CONVERTED lifecycle posts a real invoice on conversion, and
    converting the same order twice is correctly rejected; a purchase
    order's carried-forward TDS section (194J) is correctly applied at
    conversion time (threshold-aware: Rs 2,000 TDS on the Rs 20,000 excess
    over 194J's Rs 30,000 threshold); a sales invoice against a
    supplier-only party is correctly rejected; cancelling an invoice via the
    existing generic cancelVoucher nets its effect out of the Trial Balance
    exactly. Then relaunched the real packaged app fresh (electron . against
    a rebuilt out/, isolated --user-data-dir, cleared node_modules/.vite
    first) — confirmed no bundled require("@mhts/...")/require("kysely")
    remained (the dynamic bundle-exclude list from session 3 correctly
    picked up the brand-new core-sales-purchase package with zero config
    changes, exactly the point of making it dynamic) and the app created a
    real encrypted system.db and stayed running with no crash.
What's still pending in this phase: nothing blocking — see Open Questions for
  five genuine, explicitly-flagged simplifications (no bill-wise payment
  allocation — ageing is FIFO-estimated, not exact; no TDS-rate admin UI; no
  194Q buyer-turnover eligibility gate; MSME due date always assumes the
  45-day cap, never the 15-day no-agreement fallback; no Form 26Q/16A
  generation yet).
Any decisions made (also add to Section 2): unified business_party table;
  reusing Phase 1's default chart-of-accounts groups unchanged; invoices
  never duplicating voucher_number/financial_year; the createVoucher /
  createVoucherInTransaction split (and its sales/purchase mirror) for real
  order-conversion atomicity; TDS rates as real rule_set-backed data via a
  newly-implemented core-rules-engine; threshold-aware TDS computation;
  simplified 45-day-only MSME due date; FIFO-assumed MSME ageing in the
  absence of bill-wise allocation. All logged above with full reasoning.
Any blockers (also add to Section 3): Team allocation, white-label/reseller
  legal agreement, CA/compliance advisor retention — all still pending,
  unchanged. The new TDS default rates explicitly need CA review before
  being relied on for a real filing (flagged in their own source_reference,
  not just here).
Next concrete step: Phase 2 is done. Options for what's next: Phase 3
  (Inventory — items, units, warehouses, batches, valuation) is the
  Blueprint's literal next phase and would let Sales/Purchase invoice lines
  start referencing real stock items instead of plain descriptions; or
  circle back to Phase 0's still-pending items (backup framework, theme
  engine, license/white-label plumbing, the "invite a new user" flow); or
  address one of this session's flagged Phase 2 simplifications (bill-wise
  payment allocation would be the highest-value one, since it turns MSME
  ageing from estimated to exact). This branch (phase2/sales-purchase-core)
  needs a PR opened and reviewed/merged before any of the above starts.
```

```
Date: 2026-09-05 (session 7)
Phase: 1 — Accounting Core — fully complete, including both items previously
  logged as deliberately deferred beyond the Blueprint's literal scope
What was completed:
  - User confirmed the two deferred items from session 6 (voucher
    edit/cancellation, Payment/Receipt/Contra-specific UX) should be built
    now rather than left open. Both done this session.
  - Voucher cancellation, modeled as an auto-generated reversal voucher —
    never a destructive edit or delete, consistent with the append-only
    audit philosophy already established for audit_log. Migration 004 adds
    cancelled_at/cancelled_by_voucher_id (on the original) and
    reverses_voucher_id (on the reversal), cross-linking the two.
    core-accounting gained listVouchers and cancelVoucher (shares a new
    private insertVoucherWithLines helper with createVoucher, so sequential
    numbering + audit-log writing isn't duplicated). Guards: a reversal
    can't itself be cancelled (no unbounded chains), and an
    already-cancelled voucher can't be cancelled twice.
  - New VoucherRegisterScreen — the app's first general voucher-listing UI.
    Built as a genuine prerequisite for cancellation (there was no way to
    find/pick an existing voucher before this), not a side effect. Shows
    Active/Cancelled/Reversal status per voucher with a working Cancel
    action gated on ACCOUNTING.CREATE_VOUCHER.
  - Dedicated Payment/Receipt/Contra voucher screens — no backend changes
    needed, since createVoucher already accepted arbitrary lines for any
    voucher type. Payment: one "paid from" ledger auto-credited for the
    total + one or more "paid to" lines debited. Receipt: the mirror image.
    Contra: a plain two-ledger transfer, one amount. All auto-balance so the
    user only enters one side, unlike the generic form. Renamed the
    original generic screen to JournalVoucherScreen (now Journal-only, type
    dropdown removed) since Payment/Receipt/Contra have their own homes now.
  - Verified end-to-end against real encrypted files (same throwaway-script
    precedent as every session, calling the actual handler functions):
    posted two RECEIPT vouchers, confirmed the register lists both Active;
    cancelled one, confirmed the reversal is cross-linked correctly and the
    original shows Cancelled; confirmed cancelling the same voucher twice
    and cancelling a reversal are both rejected; confirmed Trial Balance
    nets the cancelled voucher's effect to exactly zero automatically (no
    report code needed changing for this — the existing sum-based balance
    computations just work); posted a Payment and a Contra voucher built
    exactly the way their new screens construct lines, confirmed the final
    Trial Balance ties out to the paisa. Then relaunched the real packaged
    app fresh — no crash.
What's still pending in this phase: nothing — see Open Questions for the
  one remaining non-blocking item (opening-balance netting across ledgers).
Any decisions made (also add to Section 2): cancellation-via-reversal, not
  destructive editing; shared insertVoucherWithLines helper; Payment/Receipt/
  Contra as thin auto-balancing UX layers over the unchanged createVoucher.
  All logged above with full reasoning.
Any blockers (also add to Section 3): Team allocation, white-label/reseller
  legal agreement, CA/compliance advisor retention — all still pending,
  unchanged.
Next concrete step: Phase 1 is genuinely done now, nothing deferred. Start
  Phase 2 (Sales + Purchase: customers, suppliers, invoices, receivables/
  payables, vendor TDS, 43B(h) MSME flag) in a fresh chat — see the top of
  this file ("How to Resume in a New Chat") for exactly how; paste this
  entry so nothing needs re-explaining. Or circle back to Phase 0's
  still-pending items first (backup framework, theme engine, license/
  white-label plumbing, the "invite a new user" flow, and the
  still-outstanding real visual click-through of the whole shell on a
  normal dev machine).
```

```
Date: 2026-09-05 (session 6)
Phase: 1 — Accounting Core — COMPLETE (Blueprint's Phase 1 line fully built
  and verified: Chart of Accounts, ledgers, groups, vouchers, double-entry,
  Trial Balance, P&L, Balance Sheet)
What was completed:
  - Both Phase 0 and Phase 1 PRs (from session 5) were reviewed and merged
    into main by the user during this session, in the correct order (Phase
    0 first, then Phase 1 — Phase 1 was branched off Phase 0 before Phase 0
    merged, so its PR diff only became clean after Phase 0 landed). Verified
    after merge: main's tree is byte-for-byte identical to what was tested
    (`git diff <local Phase 1 tip> origin/main` was empty), and a fresh
    `nx run-many -t build,lint` from main passes clean across all 11
    projects — the merge didn't silently break anything.
  - Finished Profit & Loss and Balance Sheet — the two pieces of the
    Blueprint's Phase 1 line ("TB/P&L/BS") that were still open. Refactored
    Trial Balance onto a new shared `computeLedgerBalances` helper
    (packages/core-accounting/src/ledgerBalances.ts) rather than three
    separate balance queries, since all three reports are the same
    "ledger's signed balance within some date/nature bound" computation with
    different filters layered on top.
  - Balance Sheet adds net profit/loss since inception as a synthetic
    "Current Earnings" equity line (no period-closing entries into a real
    retained-earnings ledger exist in this phase) — the standard mechanic
    for an interim balance sheet to actually balance.
  - Wired end to end: accountingHandlers.ts (getProfitAndLoss/
    getBalanceSheet, paise->rupees conversion at the boundary as before),
    main/index.ts + preload IPC registration, and two new real (not fake)
    screens — ProfitAndLossScreen (date-range income/expense/net-profit) and
    BalanceSheetScreen (assets vs. liabilities+equity, side by side),
    reachable from the Dashboard.
  - Verified end-to-end against real encrypted files (same throwaway-script
    precedent as every session, calling the actual handler functions):
    posted 4 vouchers across capital introduction/cash sale/rent payment/
    bank contra; Trial Balance still balances; P&L for the active date range
    matches expected income/expense/net-profit exactly; P&L for a quiet
    period correctly shows zero; Balance Sheet's Assets exactly equals
    Liabilities + Equity (including Current Earnings) both with posted
    activity and as of a date before any vouchers existed. Then relaunched
    the real packaged app fresh — no crash.
  - Resolved one Open Question in the process, not just implemented around
    it: the anticipated need for a recursive account-group hierarchy rollup
    turned out unnecessary — every account_group row (including sub-groups)
    already carries its own `nature` directly, so a flat WHERE-IN filter on
    nature was sufficient.
  - Phase Status Board updated: Phase 1 marked done. Two items remain
    deliberately deferred beyond the Blueprint's literal Phase 1 scope, not
    oversights — Payment/Receipt/Contra-specific UX (one generic
    double-entry form still covers all four voucher types) and voucher
    edit/cancellation (correcting a mistake still means posting a manual
    reversal voucher). Both stay open in Section 3 for whenever they're
    wanted.
What's still pending in this phase: nothing blocking — see the two
  deliberately-deferred items above if you want them built later.
Any decisions made (also add to Section 2): computeLedgerBalances as a
  shared helper for TB/P&L/BS instead of three separate queries; synthetic
  Current Earnings equity line for an unclosed Balance Sheet. Both logged
  above with full reasoning.
Any blockers (also add to Section 3): Team allocation, white-label/reseller
  legal agreement, CA/compliance advisor retention — all still pending,
  unchanged.
Next concrete step: Phase 1 is done against the Blueprint's literal scope.
  Start Phase 2 (Sales + Purchase: customers, suppliers, invoices,
  receivables/payables, vendor TDS, 43B(h) MSME flag) in a fresh chat — see
  the top of this file ("How to Resume in a New Chat") for exactly how to
  kick that off; paste this entry so nothing needs re-explaining. Or, if
  preferred, circle back to Phase 0's still-pending items first (backup
  framework, theme engine, license/white-label plumbing, the "invite a new
  user" flow, and the still-outstanding real visual click-through of the
  whole shell on a normal dev machine).
```

```
Date: 2026-09-05 (session 5)
Phase: 1 — Accounting Core (kicked off; Phase 0 left at the state session 4
  ended it — see the entry below for exactly what's still pending there)
What was completed:
  - Scoped and built a first increment of Phase 1, not the full 8-10 week
    phase: default Chart of Accounts, a double-entry voucher engine, and a
    Trial Balance report — matching the Blueprint's Phase 1 exit criterion
    ("Assets = Liabilities + Equity enforced; unbalanced entries impossible")
    as a real, tested code path rather than an aspiration.
  - Foundational decision made before writing any schema: all amounts are
    stored as integers in paise, never REAL/float, everywhere in the schema
    and in the new @mhts/core-accounting package — avoids the classic
    floating-point rounding bug in financial software, decided once now
    rather than migrated later once real ledger data exists.
  - db-schema company DB migrations 002 (account_group + ledger_account) and
    003 (voucher + voucher_line, with a unique index enforcing sequential
    numbering per voucher_type+financial_year).
  - New @mhts/core-accounting package: seedChartOfAccounts (standard
    Tally-familiar default groups + a default Cash ledger, seeded at company
    creation), createLedgerAccount/listLedgerAccounts/listAccountGroups,
    createVoucher (validates every line has exactly one of a debit/credit,
    requires >=2 lines, requires total debits = total credits, inserts
    header+lines+audit-log entry in ONE Kysely transaction per Rule #4),
    computeTrialBalance, and computeFinancialYearLabel (derives '2026-27'
    style labels from the company's financial_year_start_month).
  - New @mhts/core-audit package: the first real implementation of the
    "audit-writing service" that Phase 0's AuditLogTable comment anticipated
    but nothing had actually built yet (nothing mutated business data until
    now). writeAuditLog computes the SHA-256 hash chain in application code
    and is meant to be called inside the same transaction as the business
    write it records — createVoucher is its first caller. Pulled out as its
    own package (not folded into core-accounting) since every future module
    -- GST, payroll, inventory, sales/purchase -- will need the identical
    write path.
  - Established the pattern that each business module owns and grants its
    own RBAC permission codes (ACCOUNTING.MANAGE_CHART_OF_ACCOUNTS /
    CREATE_VOUCHER / VIEW_REPORTS, via grantAccountingPermissions called
    alongside core-identity's seedAdminRole at company creation) rather than
    core-identity accumulating every module's permissions in one list.
  - Real (not fake) UI wired end to end: ChartOfAccountsScreen (list + add
    ledger), NewVoucherScreen (dynamic lines, client-side balance check
    mirroring the server-side one), TrialBalanceScreen, all reachable from
    the Dashboard and gated on the new permissions. Money is entered/shown
    in rupees in the UI; the rupee<->paise conversion happens once, at the
    IPC boundary (apps/desktop-shell/src/main/accountingHandlers.ts), never
    scattered through business logic.
  - Verified end-to-end against real encrypted files (same throwaway-script
    precedent as every prior session, calling the actual handler functions):
    company creation seeds the expected default groups + Cash ledger; a
    balanced RECEIPT voucher posts correctly; an unbalanced voucher is
    rejected with a clear message; a line carrying both a debit AND a credit
    is rejected; Trial Balance reflects the posted voucher with matching
    totals; RECEIPT vouchers number sequentially (1, 2); every successfully-
    posted voucher wrote exactly one real audit_log row and audit_log is
    still append-only. Then cleared caches and relaunched the real packaged
    app fresh (electron . against a rebuilt out/, isolated --user-data-dir)
    — new system.db created cleanly, no crash.
What's still pending in this phase: P&L and Balance Sheet reports (need the
  same account-group hierarchy rollup, better proven against real voucher
  data first); Payment/Receipt/Contra-specific UX (one generic double-entry
  form covers all four voucher types today); voucher edit/cancellation
  (correcting a mistake means posting a manual reversal voucher for now);
  computeTrialBalance doesn't require opening balances to net to zero across
  ledgers (only vouchers are forced to balance) — see Open Questions.
Any decisions made (also add to Section 2): paise-not-float money
  representation; Phase 1 scoped to a first increment; new core-audit
  package and its transaction-scoped write pattern; each module owns its own
  permission codes. All logged above with full reasoning.
Any blockers (also add to Section 3): Team allocation, white-label/reseller
  legal agreement, CA/compliance advisor retention — all still pending,
  unchanged. Three new non-blocking Phase 1 open questions added (P&L/BS,
  voucher edit/cancel, opening-balance netting) — see Section 3.
Next concrete step: Either continue Phase 1 (P&L/BS reports are the most
  natural next piece, reusing the account-group hierarchy already in place)
  or circle back to Phase 0's still-pending items (backup framework, theme
  engine, license/white-label plumbing, the "invite a new user" flow, and
  the still-outstanding real visual click-through of the whole shell on a
  normal dev machine) — whichever the user wants next.
```

```
Date: 2026-09-05 (session 4)
Phase: 0 — Foundation
What was completed:
  - Replaced the "another admin re-grants access" idea (flagged but not built
    in session 3) with a full offline Super Admin reset + account lockout
    design, proposed to the user before writing code per the plan-first
    rule, with one explicit open question (see below) resolved by the user
    before implementing.
  - Architectural pivot made ON REQUEST during that review: passwords moved
    off AppUserTable (was a single global password across every company a
    person has access to) onto CompanyAccessTable (migration 004) — each
    company's password now lives on the same row as the DEK wrap it unlocks.
    This was the user's explicit choice over documenting the cross-company
    caveat as a known limitation. AppUserTable is now just an identity
    anchor (name + globally-unique email).
  - New SYSTEM.RESET_USER_PASSWORD permission (core-identity/rbac.ts). Any
    role holding it can, while logged in, reset another user's password for
    that company — no internet, no recovery key. The acting session now also
    holds the raw unwrapped Company DEK in main-process memory
    (SessionManager.dek, never sent over IPC) so it can re-wrap the DEK for
    the target user under a freshly server-generated temporary password
    (core-identity's new generateTemporaryPassword — never admin-typed).
    Target gets must_change_password=1, forcing a real changePassword call
    before a session is established; login() still verifies the temp
    password and unwraps the DEK either way so it never leaks "needs reset"
    for free. Guarded against targeting your own account.
  - Account lockout: new singleton security_policy table (migration 005,
    DB-configurable: max_failed_attempts default 5, lockout_duration_seconds
    default 900, backoff_base_seconds default 2 with doubling). Lockout
    state (failed_login_count/locked_until/last_failed_attempt_at) lives per
    company_access row, consistent with per-company passwords. No CAPTCHA
    (offline app, user's call, matches the whole architecture).
  - Corrected my own proposal before implementing: the pre-auth
    "does this company have another admin" check I originally proposed
    can't actually work — role/permission data lives inside the encrypted
    Company DB, unreachable pre-login. Simplified to always showing both
    recovery options on a new PasswordHelpScreen, with the "ask an admin"
    instructions carrying their own "use your recovery key instead" escape
    hatch — no dead end, no new schema/sync-debt.
  - New screens: PasswordHelpScreen (routes forgot-password to admin-ask vs
    recovery-key), SetNewPasswordScreen (forced change after a temp-password
    login), ManageUsersScreen (real user list + working Reset Password
    action, gated on SYSTEM.MANAGE_USERS / SYSTEM.RESET_USER_PASSWORD — not
    fake UI). login()'s IPC contract changed to LoginResult (mustChangePassword
    discriminant) since a successful credential check no longer always yields
    a session.
  - Documented (not implemented — explicitly deferred) email/SMS OTP-based
    reset in the Key Decisions Log: offline-first principle, ongoing
    third-party cost, and India SMS DLT registration lead time. Any Resend/
    Cloudflare/MSG91 accounts already created are on hold, unused.
  - Verified end-to-end (throwaway script, esbuild-bundled, run in a real
    Electron process, calling the actual handler functions — same precedent
    as prior sessions): normal login; 3 wrong passwords (test-tuned
    max_failed_attempts, same configurable security_policy row production
    uses) lock the account even against the correct password; lockout clears
    once its window passes; a second user is granted access, admin-reset
    issues a temp password, login with it reports mustChangePassword without
    establishing a session, changePassword completes it and the old temp
    password stops working; self-reset is refused; and — the actual point of
    the redesign — the SAME email/identity was given access to a SECOND
    company, and resetting their password in Company A left Company B's
    password completely untouched. Also cleared caches and relaunched the
    real packaged app again (electron . against a fresh out/, isolated
    --user-data-dir) — new system.db (with the new tables/columns) created
    cleanly, no crash.
What's still pending in this phase: backup framework, theme engine, license/
  white-label plumbing. No "invite a new user" flow exists yet — Manage
  Users can list and reset existing access grants but can't create a new one
  (only createCompany's admin bootstrap does that today) — needed before
  Manage Users is usable for onboarding, not just recovery. safeStorage's
  Linux-without-keyring fallback is still unverified (unchanged from
  earlier sessions).
Any decisions made (also add to Section 2): per-company passwords (schema
  pivot); offline Super Admin reset design; account lockout with configurable
  thresholds, no CAPTCHA; solo-admin routing shows both options unconditionally
  instead of a pre-auth permission check; OTP reset deferred, not abandoned.
  All logged above with full reasoning.
Any blockers (also add to Section 3): Team allocation, white-label/reseller
  legal agreement, CA/compliance advisor retention — all still pending,
  unchanged.
Next concrete step: The "invite a new user" flow (Manage Users currently has
  no way to create a NEW company_access grant, only reset an existing one) is
  the most obviously-missing piece before this feels like a complete RBAC
  story. After that, a real visual click-through of the whole shell on a
  normal dev machine (still hasn't happened — everything so far is verified
  via scripts, including this session's) is worth doing before moving on to
  backup framework / theme engine / licensing or Phase 1.
```

```
Date: 2026-09-05 (session 3)
Phase: 0 — Foundation
What was completed:
  - Fixed a real launch crash the user hit: ERR_REQUIRE_ESM requiring kysely
    from db-schema/connection.js. Root cause was already understood from
    session 2 (electron-vite's externalizeDepsPlugin must not externalize
    @mhts/* or kysely), but the exclude list was a hand-maintained array —
    made it robust by computing it automatically from packages/*/package.json
    at config-eval time, so a future core-* package can't silently regress
    this. Cleared node_modules/.vite + out/ and rebuilt from scratch, then
    actually relaunched the real packaged app (`electron .` against the real
    built out/, isolated --user-data-dir, not a custom test harness) and
    confirmed: it created and correctly encrypted a real system.db and
    stayed running with no crash. Also relaunched via `electron-vite dev`
    (the dev-mode path) with the same result.
  - Resolved the password-reset/recovery gap flagged at the end of session 2.
    Design (stated to the user before implementing, per their ask): a 256-bit
    recovery key generated once at company creation, alongside the DEK,
    AES-256-GCM-wrapping the DEK directly (no password/KDF needed — it's
    already full-entropy random bytes) and stored in a new company-wide
    company_recovery_key table (system DB). Shown to the user exactly once
    on a new RecoveryKeyScreen they must acknowledge saving before continuing.
    Rejected "another admin re-grants access" as the *only* recovery path,
    since a large share of MHTS's real target market (proprietorship/OPC
    entities) is a single-admin company with no second logged-in identity to
    do the re-granting — recorded as a real trade-off in the Key Decisions
    Log, not just implemented silently. The recovery key is reusable (not
    single-use) and the mechanism is explicitly zero-knowledge: losing both
    the password and the recovery key means the data is unrecoverable by
    design, no vendor master key exists.
  - New "Forgot password?" flow: LoginScreen -> ForgotPasswordScreen (email +
    recovery key + new password) -> new resetPassword IPC handler, which
    unwraps the DEK with the recovery key, updates the password hash and
    re-wraps the DEK under the new password atomically (systemDb.transaction),
    then logs the user straight in (reuses the same session-establishment
    path as a normal login via a new shared `establishSession` helper).
  - core-identity/keyWrap.ts refactored to separate the raw AES-256-GCM
    wrap/unwrap primitives (wrapWithRawKey/unwrapWithRawKey) from the
    password-specific KDF wrapper (wrapDataKey/unwrapDataKey now built on
    top of them) plus formatRecoveryKey/parseRecoveryKey (grouped-hex human
    form). db-schema migration 003 adds the company_recovery_key table.
  - Verified end-to-end against real encrypted files (throwaway script,
    bundled with esbuild, run in a real Electron process — not committed,
    same precedent as prior sessions), calling the ACTUAL handler functions
    (not a reimplementation) this time: create company -> get recovery key ->
    normal login works -> wrong recovery key rejected (GCM auth-tag failure)
    -> correct recovery key resets password and logs in -> OLD password now
    rejected -> NEW password works -> the same recovery key still works for
    a second reset.
What's still pending in this phase: backup framework, theme engine, license/
  white-label plumbing. An "another admin re-grants access" convenience path
  for multi-user companies (not needed for correctness, recovery key already
  covers the hard case). safeStorage's Linux-without-keyring fallback is
  still unverified (unchanged from session 2).
Any decisions made (also add to Section 2): dynamic (not hand-maintained)
  bundle-exclude list for @mhts/* packages in electron.vite.config.ts;
  recovery-key mechanism and its zero-knowledge trade-off. Both logged above
  with full reasoning.
Any blockers (also add to Section 3): Team allocation, white-label/reseller
  legal agreement, CA/compliance advisor retention — all still pending,
  unchanged.
Next concrete step: A real visual click-through of the shell on a normal dev
  machine (create a company, save the recovery key, log in, sign out, use
  "Forgot password?" with the saved recovery key, confirm the Dashboard
  still shows the right permissions) is now the only thing standing between
  "verified via scripts" and "actually used once by a human" — worth doing
  before further Foundation work (backup framework, theme engine, licensing)
  or before Phase 1 starts.
```

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
