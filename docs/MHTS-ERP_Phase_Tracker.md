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
| 9 | Print + Templates | Print Centre, native printing, PDF, template designer | ✅ Done | | Split into three increments (user's explicit choice, same pattern as Phases 4/8): Increment 1 (config-based rebranding + Sales Invoice/Payslip printing — the Blueprint's literal exit criterion) is done. Increment 2 (extend to remaining document types + a real Print Centre register) is done — see its own paragraph below. **Increment 3 (full drag-and-drop template designer) is now also done** — see its own paragraph at the end of this row. **Phase 9 is now functionally complete against the Blueprint's one-line scope.** **Increment 1 detail:** new pure-TS `core-company-profile` package (singleton `company_letterhead_profile` row per company DB — address/phone/email/website/bank details/footer note/logo BLOB/per-document layout+accent — same singleton-row pattern as `core-payroll-engine`'s `company_payroll_settings`, and the same "BLOB lives in the company DB so it travels with `backupCompany`'s whole-file copy" reasoning as Phase 6's `document_attachment`). New `apps/print-templates` (Phase 0's placeholder stub, now real): pure HTML/CSS string builders (`renderSalesInvoiceHtml`/`renderPayslipHtml`, CLASSIC/MODERN layouts) with zero DB/Electron dependency — its `project.json` had to be changed from `projectType: "application"` to `"library"` because Nx's `@nx/enforce-module-boundaries` structurally forbids any project of type "application" from being imported by anything (a separate, stricter rule than the custom tag-based `depConstraints`), which only surfaced once `desktop-shell` actually imported it for the first time. Printing/PDF uses Electron's own built-in `webContents.print`/`printToPDF` against a hidden, sandboxed `BrowserWindow` loaded via a `data:` URL — deliberately no new dependency (`pdfmake`/`puppeteer-print` from the Blueprint's original suggestion), since Electron already embeds Chromium. Closed two real, pre-existing schema gaps surfaced by trying to print a real invoice/payslip: `business_party` had no address column at all (only `warehouse.address`/`branch.address` existed) — added `business_party.address` plus a new `updateBusinessPartyAddress` (the only party field editable after creation so far, so a pre-existing party can get one retroactively); `sales_invoice_line` computed quantity/rate/item for stock-posting purposes but never persisted them — added `item_id`/`quantity_thousandths`/`rate_paise` columns, now populated by `createSalesInvoiceInTransaction` (a previously-silent gap, not a regression). `employee.designation` added for the payslip header (only `department` existed before). Migration 018. Verified end-to-end (45 checks, throwaway tsx script against a real encrypted company/system DB pair, deleted after) — including the qty/rate/item persistence, the address-retrofit path, logo blob round-trip, a genuine CLASSIC-vs-MODERN layout diff for identical data (the literal "fully re-brandable without code" exit criterion), and payslip assembly joining the new `designation`/PAN/bank/UAN fields correctly. Full workspace `nx run-many -t build -t lint` (20 projects, cache bypassed) clean; `tsc --noEmit` clean on the renderer project and introduces no new errors on the main-process project (the same 3 pre-existing latent errors from before this session remain — `licenseHandlers.ts`'s already-documented one, plus two `MANUFACTURING_JOURNAL`/`MANUFACTURING_CONSUME` enum-widening errors in `accountingHandlers.ts`/`inventoryHandlers.ts` that predate this session — a Phase-8-era gap in the IPC boundary's own `VoucherType`/`MovementType` unions (`shared/ipc.ts`), flagged here but deliberately not fixed since it's out of this increment's scope). Merged to `main` (PR #19). **Increment 2 detail:** extended printing to every remaining document type — Purchase Invoice, Sales Order, Purchase Order, Journal/Payment/Receipt/Contra vouchers, and Expense Claims — plus a new Print Centre register that aggregates every printable document type into one screen (browse + reprint, not reachable only per-row from each document's own register anymore). Closed the purchase-side twin of Increment 1's own schema gap: `purchase_invoice_line` never got `item_id`/`quantity_thousandths`/`rate_paise` when migration 018 added them to `sales_invoice_line` — migration 019 adds all three, now populated by `createPurchaseInvoiceInTransaction`. Five new `getXForPrint` assembly functions, one per new document family: `getPurchaseInvoiceForPrint` (`core-sales-purchase`, mirrors `getSalesInvoiceForPrint` plus TDS/due-date/MSME fields), `getSalesOrderForPrint`/`getPurchaseOrderForPrint` (`core-sales-purchase`, new — an order line carries only a flat tax amount, no CGST/SGST/IGST/Cess split, since GST isn't computed until conversion to an invoice), `getVoucherForPrint` (`core-accounting`, new — the first print-assembly function for a bare ledger-line voucher: joins `voucher_line` to `ledger_account`/`cost_centre`/`branch` for names; deliberately generic across all four Journal/Payment/Receipt/Contra types, with every OTHER voucher type — Sales/Purchase Invoice, Expense Claim, Payroll, Stock Adjustment, Manufacturing, Fixed Asset, FX Revaluation, Inter-Branch Transfer — either printed via its own richer path or not printable at all, gated by a `PRINTABLE_VOUCHER_TYPES` allow-list both in the main-process handler and the Voucher Register's own UI), `getExpenseClaimForPrint` (`core-expense`, a single-claim-scoped version of the existing `listExpenseClaims` join, reusing `ExpenseClaimSummary` as-is rather than a new type since it already carried everything a print template needs). New `listPayslipsForPrint` (`core-payroll-engine`) is a flat cross-run payslip listing purely for the Print Centre — `PayrollRunScreen`'s own listing stays scoped to one selected run. Five new `apps/print-templates` builders: `purchaseInvoiceTemplate.ts` gets a REAL CLASSIC/MODERN split (reusing the existing `invoice_layout` preference as-is, no new schema) since it's structurally identical to the Sales Invoice; `orderTemplate.ts` (shared by both Sales and Purchase Order), `voucherTemplate.ts`, and `expenseClaimTemplate.ts` all take a `layout` parameter for signature consistency but render identically regardless of it — an explicit, deliberate scope choice reusing the EXACT precedent Increment 1's own `payslipTemplate.ts` already established (`void layout`), not a new pattern invented this session; a dedicated extra layout column per new document type was considered and rejected as schema surface with no real distinct rendering behind it. `printHandlers.ts` gained five new `build.../print.../save...Pdf` triples following Increment 1's exact template (`letterheadForPrint` + the document's own `getXForPrint` + `Promise.all`, hand-mapped paise→rupees, rendered, printed/saved) — 10 new IPC channels plus one plain data-list channel for the Print Centre's payslip rows. `PrintCentreScreen.tsx` is a new screen, not a new backend aggregate query — it composes its unified table client-side from each document type's own EXISTING `list*` IPC call (the same ones each dedicated register screen already uses), so no new cross-cutting "list every printable document" backend concept was introduced. Verified end-to-end (31 checks, throwaway tsx script against a real encrypted company/system DB pair, deleted after) — including the purchase-invoice qty/rate/item persistence round-trip, a genuine CLASSIC-vs-MODERN HTML diff for the Purchase Invoice on identical data, Sales/Purchase Order print assembly with the flat-tax line shape, a Journal voucher's ledger-name resolution and Dr/Cr total, confirming `getVoucherForPrint` correctly reports a Purchase Invoice's own voucher type (proving the caller-side `PRINTABLE_VOUCHER_TYPES` guard has accurate data to gate on), Expense Claim print assembly, and `listPayslipsForPrint` running cleanly against the real schema with zero payroll runs. Full workspace `nx run-many -t build -t lint` (20 projects, cache bypassed) clean; `tsc --noEmit` clean on the renderer project and introduces no NEW errors on the main-process project (confirmed via `git status` that the same 3 pre-existing latent errors from Increment 1 — `licenseHandlers.ts`'s already-documented one, plus the two Manufacturing-era `VoucherType`/`MovementType` enum-widening gaps in `accountingHandlers.ts`/`inventoryHandlers.ts` — sit in files this session never touched). Not yet merged — on branch `phase9/print-templates-increment2`, based on `main` (Phase 8 and Increment 1 are both already merged), pending user review. Merged to `main` (PR #20). **Increment 3 detail:** the drag-and-drop template designer, scoped via AskUserQuestion before planning — **all 6 document families in one pass** (not Sales-Invoice-first), and the drag/resize interaction **hand-rolled with plain React pointer events, zero new npm dependency** (this codebase had no DnD/canvas library at all; same "the platform already covers it" reasoning Increment 1 used to reject pdfmake/puppeteer). Architecture: a company's custom field layout is that company's own creative configuration, not shared regulatory reference data like GST rates — so per Rule #3 (company data isolation) it's a new **company-DB** table, `print_template_layout` (migration 020: `document_family`/`version`/`name`/`layout_json`/`is_active`/`created_by`/`created_at`), NOT a system-wide `core-rules-engine` `rule_set` row. Append-only supersede-on-new-version via `is_active`, the exact same pattern `core-manufacturing`'s `bill_of_material` already established (never edit a version in place); at most one `ACTIVE` row per family, and "revert to default" supersedes it with no replacement (history stays, print path falls back to CLASSIC/MODERN). New pure-TS package `core-print-templates` (`type:core`, depends only on `db-schema`+`core-audit`) owns this lifecycle — `saveTemplateLayoutVersion`/`getActiveTemplateLayout`/`listTemplateLayoutVersions`/`revertTemplateLayout`, each write audit-logged via `@mhts/core-audit`. It deliberately does NOT depend on `@mhts/print-templates` (Nx's `type:core` → `type:app` boundary structurally forbids it) — `layout_json` is opaque JSON to this package, the exact "payload is caller-owned" precedent `rule_set.rule_payload` already set; `TemplateFamily` is mirrored (not imported) into both packages, same reasoning `core-company-profile`'s `DocumentLayout` already used. `apps/print-templates` gained the actual rendering engine, alongside (not replacing) the existing per-family CLASSIC/MODERN builders: `templateLayoutTypes.ts` (`TemplateLayoutDocument`/`TemplateElement` — text/image/line/table, all positioned in mm), `templateFieldCatalog.ts` (a static `Record<TemplateFamily, FieldCatalogEntry[]>` enumerating every bindable field per family straight from the existing `*TemplateData` interfaces — fixed metadata about a TS contract, not DB-versioned rule data, so a plain exported const is the right fit, not a rules-engine row), and `customLayoutRenderer.ts`'s `renderCustomLayoutHtml` (a dot-path field resolver + absolute-positioned inline-style HTML emitter, table elements repeating once per bound array row) reusing the existing `escapeHtml`/`formatRupees`/`wrapHtmlDocument` helpers. `document_family` groups exactly the 6 renderer families that already existed (`ORDER` shared by Sales+Purchase Order, `VOUCHER` shared by Journal/Payment/Receipt/Contra, matching precedent). Print-path integration: each of the 6 `buildXHtml` functions in `printHandlers.ts` gained one `getActiveTemplateLayout` lookup before choosing a renderer (falls through to the existing CLASSIC/MODERN builder when none is active) — six identical-shaped call sites, the existing default path completely untouched. Each `buildXHtml` also now returns its assembled `data` object (not just `html`/`fileNameBase`) so the designer's live-preview endpoint, `getTemplatePreviewData`, can **genuinely reuse** the exact same `getXForPrint`+paise-conversion assembly against the most recently created real document of that family (falling back to a small hardcoded placeholder dataset only when the company has zero documents of that type yet — preview-only, never used for an actual print/PDF). 6 new IPC channels (`getTemplateLayout`/`saveTemplateLayout`/`revertTemplateLayout`/`listTemplateLayoutVersions`/`getTemplatePreviewData`/`getTemplateFieldCatalog`), all gated behind the existing `PRINT.MANAGE_LETTERHEAD` permission (no new permission — this is the same class of action as editing the letterhead profile). New `TemplateDesignerScreen.tsx`: family picker, a field palette (click-to-insert, since there's no DnD library — "drag-and-drop" means freely repositioning/resizing an already-placed element via hand-rolled `onPointerDown`/`onPointerMove`/`onPointerUp` + `setPointerCapture`, not a drag-from-palette gesture), a property panel (font size/weight/align for text, table column list), and the canvas shows each bound field's REAL resolved value from `getTemplatePreviewData` live while editing (a deliberate simplification over a separate iframe preview mode — the same canvas doubles as the WYSIWYG preview). Canvas page size defaults to 182×269mm — A4 minus the existing fixed 14mm `@page` print margin from `wrapHtmlDocument` — so the on-screen canvas matches the actual printed content area pixel-for-mm, not just approximately. Verified end-to-end (23 checks, throwaway tsx script against a real encrypted company DB, deleted after) — migration 020 applying cleanly alongside all 19 prior migrations, versioned save/get/list/revert against real SQLite (supersede-not-overwrite, family independence, safe no-op revert on an untouched or already-reverted family, exactly 4 real `audit_log` rows for 4 mutating actions), and the interpreter itself (bound-field resolution against a real data object, static text, repeating table rows, currency formatting, null-safe rendering, a missing logo simply omitted rather than a broken `<img>`). Full workspace `nx run-many -t build -t lint` (22 projects, cache bypassed) clean; `tsc --noEmit` clean on the renderer project and introduces no NEW errors on the main-process project (confirmed via `git status` that the same 3 pre-existing latent errors — `licenseHandlers.ts` plus the two Manufacturing-era enum-widening gaps — sit in files this session never touched). Merged to `main` (PR #21). **Phase 9 is now functionally complete against the Blueprint's one-line scope; residual simplifications (click-to-insert vs. drag-from-palette, no QR/image-upload elements, no per-company layout duplication) are tracked explicitly in Open Questions, not silently dropped.** |
| 10 | Commercialization | Installer, updates, demo mode, setup wizard | ✅ Done | | Scoped via AskUserQuestion into three increments (same pattern as Phases 8/9), all three now done: **Increment 1 (installer + update/migration pipeline)**, **Increment 2 (setup wizard)**, and **Increment 3 (demo mode)** — see each one's own paragraph. **Phase 10 is now functionally complete against the Blueprint's one-line scope.** **Increment 1 detail:** starting state was confirmed genuinely greenfield via a background survey — no electron-builder/forge config, no electron-updater, no app icon files, no CI anywhere in the repo. The survey also surfaced a real, previously-undiscovered bug: `openExistingCompanyDb` (used on every login) never called `migrateCompanyDb`, while `openAndMigrateSystemDb` already migrated the System DB unconditionally on every startup — a company DB created on an older app version would silently never be forward-migrated after an app update, exactly the failure mode "update/migration pipeline" exists to prevent. Fixed in `apps/desktop-shell/src/main/db.ts`: `openExistingCompanyDb` now always calls `migrateCompanyDb` (a guaranteed no-op on an already-current DB, per Kysely's own migration tracking) behind a copy-before-mutate/verify/rollback-on-failure safety net — the exact same shape `restoreCompany` in `backupHandlers.ts` already established, reused rather than reinvented; a brand-new company file (no existing file to back up) skips the copy step. `createAndMigrateCompanyDb` now just calls this same function after its `mkdirSync`, removing the prior duplication. Packaging: new `apps/desktop-shell/electron-builder.yml` — Windows NSIS (fully built and verified in this sandboxed dev environment), Mac DMG and Linux AppImage configs also scaffolded per the user's explicit choice to cover all three even though only Windows could be built/tested here. Real, non-obvious monorepo-packaging findings, all confirmed empirically rather than assumed: (1) electron-builder can't auto-detect the Electron version in an npm/yarn workspace since `electron` is hoisted to the repo-root `node_modules`, not `apps/desktop-shell/node_modules` — fixed via an explicit `electronVersion: 44.2.0` pin. (2) `better-sqlite3-multiple-ciphers` ships one prebuilt binary per platform/arch (`prebuilds/*.node`, via `prebuildify`) rather than one per Node ABI version — the signature of an **N-API** module, which is ABI-stable across every Node.js/Electron version by design, meaning no rebuild has ever been needed (this is also *why* the app has run correctly since Phase 0 with no `@electron/rebuild` step anywhere) — `npmRebuild: true` (electron-builder's default, which assumes a non-N-API module and tries a from-source node-gyp rebuild) was actively wrong here and is now explicitly disabled. (3) Every `@mhts/*` workspace package is a symlink in `node_modules` (`node_modules/@mhts/<name>` → `packages/<name>`, outside the app directory) — electron-builder's production-dependency walker resolves these into their real target path when parsing `package.json`'s `"dependencies"` and crashes trying to compute a path relative to the app directory for a target outside it. The correct fix (confirmed by testing, not guessed): move every `@mhts/*` package from `apps/desktop-shell/package.json`'s `dependencies` into `devDependencies` — they were never true runtime dependencies in the first place, since `electron.vite.config.ts`'s existing `bundleInsteadOfExternalize` logic already bundles all of them directly into `out/main/index.js`; only `better-sqlite3-multiple-ciphers`, `node-machine-id`, and the new `electron-updater` are real `require()`s at runtime and correctly stay in `dependencies`. (4) The sandboxed dev environment lacks Windows Developer Mode / the symlink-creation privilege, which broke two unrelated things for two different reasons: electron-builder's Windows build eagerly downloads a combined win/mac code-signing tool archive containing macOS `.dylib` symlinks even for a fully unsigned build (worked around via `win.signAndEditExecutable: false`, appropriate anyway since there's no code-signing certificate yet — flagged as a new Open Questions item for real distribution); the Linux AppImage target structurally needs to create real symlinks for its icon/desktop-file layout and has no equivalent workaround, so `package:linux` could not be completed in this environment (a genuine, disclosed environment limitation, not a code defect — needs a real Linux host or CI runner, or Developer Mode enabled locally) and `package:mac` cannot even be attempted from Windows at all (DMG creation requires a real macOS host). A one-off placeholder app icon (`build/icon.png`, a plain "M" monogram, generated by a small `pngjs`-based script at packaging time, not committed) stands in for real MHTS/white-label branding art, which is a separate design task. Auto-update: full `electron-updater` flow per the user's explicit choice ("build all the logic, don't skip anything") — a new `updateHandlers.ts` wires `checking-for-update`/`update-available`/`download-progress`/`update-downloaded`/`error` events to a new main→renderer push channel (`update:status`, the first plain `webContents.send` channel in this codebase — every prior IPC surface has been request/response `invoke`/`handle`), a silent non-blocking startup check 10s after window creation (packaged builds only, never blocks or surfaces an error dialog on failure — consistent with the Blueprint's "no phone-home dependency for core operation" principle), a manual check exposed via the same two new IPC channels (`CHECK_FOR_UPDATE`/`QUIT_AND_INSTALL`), and a new `UpdateStatusBanner` renderer component that renders nothing until an update is actually downloading/ready. `publish: { provider: github, ... }` in the builder config makes electron-builder emit a real `app-update.yml` into the package (confirmed present in the built output) which `electron-updater` reads automatically — but actually publishing a release (`npm run release`) needs a `GH_TOKEN` this session doesn't have, the same class of limitation as the `gh`-CLI unavailability that has blocked this project from opening its own PRs since Phase 0; so full update-discovery end-to-end (finding and installing a real new version) is unverified pending a real published release. Also fixed, since this increment already touches the licensing-adjacent packaging/shipping path: the `licenseHandlers.ts:49` latent `tsc` error flagged as pre-existing/out-of-scope since Phase 3 (Phase Tracker's own Open Questions list) — `LicenseActivationTable.activated_at`'s Kysely `ColumnType` had its update type set to `never`, which made `verifyAndBind`'s legitimate re-wrap-on-renewal `.set({ activated_at: ... })` a real type error; changed to `string` (matching the exact pattern `AppPreferenceTable.updated_at` already used) — a one-line schema-type correction, not a logic change. Verified: full workspace `nx run-many -t build -t lint` (21 projects, cache bypassed) clean; `tsc --noEmit` on both renderer and main-process tsconfigs — the `licenseHandlers.ts` error is gone and only the same 2 pre-existing Manufacturing-era `VoucherType`/`MovementType` enum-widening errors remain (untouched, unrelated files); a throwaway tsx script (10 checks, deleted after) against real encrypted fixture company DBs proved the migration fix end-to-end — an "old" DB fixture (migrations 001-019 only) gets correctly brought forward to include migration 020's table by `openExistingCompanyDb`, a brand-new company file skips the backup step entirely (nothing to back up), and a deliberately corrupted migration-bookkeeping row (forcing Kysely's migrator to throw) proved the rollback path restores the company DB file to its exact pre-attempt bytes while keeping the `.bak` for forensics; a real NSIS installer (`MHTS ERP Setup 1.0.0.exe`, ~126MB) was actually built and its unpacked output inspected to confirm `better-sqlite3-multiple-ciphers`'s prebuilt binaries landed correctly under `resources/app.asar.unpacked/node_modules/` (not sealed inside asar) and `app-update.yml` was correctly emitted. The packaged app itself was launched multiple times in this sandboxed environment: it consistently reached a stable multi-process Electron memory footprint with no crash or immediate exit. **`app.whenReady()` was initially assumed to be the blocker** (attributed at the time to the same pre-existing "no interactive desktop session" limitation Phase 0's own status note has carried since session 1) — **this assumption was wrong, and was corrected the same session** once the user reported a real crash (`Cannot find module '@mhts/print-templates'`) when running the packaged build themselves. **Same-session bugfix detail:** root cause was `electron.vite.config.ts`'s `workspacePackageNames()` — the function that auto-discovers which `@mhts/*` workspace packages need bundling instead of left as external `require()`s (see the original Phase 0 fix for `kysely`/`packages/*`) — only ever scanned `packages/*`, never `apps/*`. `@mhts/print-templates` legitimately lives under `apps/print-templates` (Phase 9's own real print-rendering library, tagged `type:app` not `type:core` — genuinely used by `printHandlers.ts`, not a premature import; Phase 9 was already fully merged before this session began), so it was the one `@mhts/*` package that stayed a real external `require()` the entire time — silently fine in `electron-vite dev` (plain Node can resolve the workspace symlink and load `.ts` source directly there) but fatal in a packaged build, which ships no such module at all. Fixed by generalizing `workspacePackageNames()` to scan both `packages/*` and `apps/*`, explicitly excluding this app's own directory by path comparison (not by hardcoding the name "desktop-shell") since the entry point can't bundle itself. Re-verified for real, not just re-asserted: rebuilt `out/main/index.js` and confirmed via `grep` it contains zero `require("@mhts/...")` calls (up from one) while `better-sqlite3-multiple-ciphers`/`node-machine-id`/`electron-updater` remain correctly external; full workspace `nx run-many -t build -t lint` (21 projects) and `tsc --noEmit` on both tsconfigs stayed clean (same 2 pre-existing Manufacturing-era errors, nothing new); rebuilt the real NSIS installer, extracted its actual `app.asar` with the `asar` CLI and confirmed the packaged bundle itself (not just the pre-package build output) has zero `@mhts/*` requires; and relaunched the real unpacked `.exe` — this time `system.db`'s mtime updated at the exact moment of launch (proof `bootstrap()` executed, not inferred from memory footprint alone), and the process ran stably past `createWindow()` all the way to the 10-second delayed background update check, which correctly and non-fatally logged a 404 (no GitHub Release published yet — the already-disclosed, expected auto-update limitation, not a new bug) instead of crashing or blocking. This also retroactively disproves the earlier "no interactive desktop session" theory for THIS specific test shape — `app.whenReady()` does resolve in this sandbox after all; that Phase 0-era caveat may still be real for other things (e.g. an actual visible/interactive window), but it was not the cause of this crash. **Increment 2 detail:** a guided, entirely skippable one-time flow targeting the Blueprint's literal "clean install → first invoice in under 15 minutes" exit criterion, built by chaining EXISTING real IPC calls rather than inventing new backend logic. Shown exactly once — right after a brand-new company's first login, never on a returning login — by threading a new optional `fromCreation` flag through the existing `recoveryKey`→`login`→(`setNewPassword`)→`dashboard` view chain in `App.tsx`: when set, a successful login (or post-temp-password login) routes to a new `{ name: 'setupWizard' }` view instead of straight to the dashboard. New `SetupWizardScreen.tsx`, four steps: Welcome ("Skip setup" always available) → quick-add-a-customer (calls `window.mhts.createParty` with a minimal field set — name/GSTIN/state, `isMsmeUdyamRegistered: false` — "Skip this step" always available) → quick-add-an-item (calls `window.mhts.createItem` with `itemType: 'SERVICE'` only — deliberately NOT offering `STOCKABLE` in the wizard, since a stockable item needs a Unit of Measure and (for invoicing) a Warehouse, and NEITHER is seeded at company creation; auto-seeding a default unit/warehouse behind the scenes was considered and rejected as presumptuous guessing of business-specific defaults, the same "don't hardcode/guess a default" instinct the Blueprint's Rule #2 applies elsewhere — a physical-goods business is pointed to Inventory → Manage Items afterward instead, a genuine disclosed scope trim, not a silent gap) → Ready ("Create my first invoice," which routes to the existing, completely unmodified `NewSalesInvoiceScreen`, or "Go to Dashboard instead"). No new IPC channels, no new permissions, no new schema/migration — every call the wizard makes is one the full Parties/Items screens already made and already had end-to-end verification from Phases 2/3; the full screens remain where a company fills in everything the quick-add forms skip. Verified: full workspace `nx run-many -t build -t lint` (21 projects) and `tsc --noEmit` on both tsconfigs clean (same 2 pre-existing Manufacturing-era errors, nothing new, nothing from this increment); a throwaway tsx script (4 checks, deleted after) confirmed the exact `createParty`/`createItem` argument shapes the wizard's two quick-add steps send — against a real encrypted company DB seeded the same way real company creation seeds it (chart of accounts + sales/purchase + inventory ledgers) — both succeed, are listed back correctly, and the service item needs no unit/warehouse at all. UI routing itself (the `fromCreation` flag threading and the four-step state machine) was verified by code review and the type-checker, not a live click-through — this sandboxed environment still has no proven interactive/visual GUI verification path (see the still-open Phase 10 GUI-launch Open Questions item), the same standing limitation every prior phase's UI work has carried. **Increment 3 detail:** both halves the user confirmed via AskUserQuestion — a one-click sample-data demo company (exempt from the license gate entirely, at most one exists at a time) AND a 14-day license-free trial starting from first app launch. New system-DB migration 009: `company.is_demo` (same `is_active`-style integer-as-boolean column) and a new singleton `trial_activation` table (exact `license_activation` pattern). **Trial**: new `trialHandlers.ts` — `ensureTrialStarted` (idempotent, called once at every bootstrap) + `checkTrialStatus` (`{active, daysRemaining}`); `createCompany`'s existing soft gate now allows a company through when EITHER a valid license exists OR the trial is still active (the `maxCompanies` check only applies with a real license — the trial's only enforcement axis is time, never company count); `CompanyListScreen` shows a "N days left in your free trial" banner in place of the "no license" message when applicable. **Demo company**: refactored `createCompany`'s ~15-call seed/grant chain into a shared `seedNewCompanyData` (removes duplication, not a new pattern) reused by both real and demo creation. New `demoHandlers.ts`'s `createDemoCompanyAndLogin` builds a company exactly like `createCompany` does, then calls `establishSession` directly with the DEK it already generated — completely bypassing password verification, since `establishSession` (now exported from `handlers.ts`) takes the raw DEK as a plain parameter, confirmed via this session's own background survey. This gives a genuine one-click, zero-typing "Try Demo": no password is ever shown or needed (a real throwaway one is still generated/hashed/wrapped to satisfy the schema's non-null columns, via `core-identity`'s existing `generateTemporaryPassword`). A new `deleteExistingDemoCompany` helper (no precedent existed anywhere in this codebase for deleting a company) removes any prior demo's `company_access`/`company_recovery_key`/`company` rows and unlinks its `.db` file before every fresh "Try Demo" click — narrowly scoped to demo replacement only, explicitly NOT a general company-deletion feature (real company deletion has backup/audit implications out of scope here). New `demoDataSeed.ts`'s `seedDemoData` calls the exact same IPC-layer functions (`createUnitOfMeasure`/`createWarehouse`/`createParty`/`createItem`/`createSalesInvoice`/`createPurchaseInvoice`/`createVoucher`) any real user's click would call — 5 parties, 8 items (5 stockable + 3 service, real HSN/SAC codes drawn from the already-seeded GST rate catalog rather than invented), 2 purchase + 4 sales invoices spread across the past month, and a RECEIPT + PAYMENT voucher — real, independently-already-tested business logic exercising itself, not a parallel mock-data path. A real bug surfaced and fixed while building this: a stockable PURCHASE line must post to the `Stock-in-Hand` asset ledger, not a Purchases expense ledger (COGS is recognized on sale, not on purchase, in this codebase's perpetual-inventory design) — caught by the verification script, not assumed. Deliberately, and explicitly unlike the Setup Wizard's own restraint (Increment 2): fabricating a unit/warehouse/sales-ledger/realistic catalog here is the entire point of a demo (data that only exists to be looked at), so nothing was held back the way Increment 2 held back `STOCKABLE` items — flagged as a reasoned, deliberate distinction, not an inconsistency. New `CREATE_DEMO_COMPANY`/`GET_TRIAL_STATUS` IPC channels; `CompanySummary` gained `isDemo`; `CompanyListScreen` gained a "Try Demo" button (a `window.confirm` warns before replacing an existing demo) and a small "Demo" tag in the company list; a new `onDemoReady` prop in `App.tsx` routes straight to the dashboard, skipping the recovery-key/login screens entirely (the same one-click promise as the button itself). **Deliberate, disclosed simplification**: there is no persistent "resume the existing demo" path — every "Try Demo" click wipes and recreates fresh, avoiding having to decide whether/how to store the demo's DEK unencrypted for a password-less return visit (a real, disclosed exception to this app's zero-knowledge design that wasn't worth taking on for a v1). Verified end-to-end (19 checks, throwaway tsx script against a real encrypted system DB, deleted after): migration applies cleanly; `ensureTrialStarted` is idempotent and a backdated trial correctly reports expired; `createCompany` is genuinely blocked with no license and an expired trial, and genuinely succeeds with no license during an active trial; `createDemoCompanyAndLogin` produces a real session with real permissions and becomes the active session; exactly one demo company ever exists in `listCompanies`, correctly flagged; all seeded data (5 parties, 8 items, 2+4 invoices, 2+ vouchers) is independently listable; a real Trial Balance from the seeded data is non-zero AND balances to the paisa; a stockable demo item's stock position is genuinely non-zero; and a second "Try Demo" click produces a different company id, deletes the first demo's `.db` file from disk, leaves exactly one demo company behind, and leaves the separately-created real trial company completely untouched. Full workspace `nx run-many -t build -t lint` (21 projects) and `tsc --noEmit` on both tsconfigs clean (same 2 pre-existing Manufacturing-era errors, nothing new). Renderer UI (the Try Demo button, trial banner, `onDemoReady` wiring) verified by code review and the type-checker only — same standing "no proven interactive GUI verification path in this sandbox" limitation as Increments 1/2. **Phase 10 is now functionally complete against the Blueprint's one-line scope; residual simplifications (no demo-company resume, no code-signing certificate, Linux/Mac packaging unverified in this sandbox) are tracked explicitly in Open Questions, not silently dropped.** Merged to `main` (PR #22 for increments 1-2, PR #23 for increment 3). Phase 10 is fully merged. |
| 11 | UAT & Compliance Sign-off | Full acceptance test, CA sign-off, security pass | 🟨 In progress | | Increment 1 (full scope in one pass, user's explicit choice — same precedent as Phase 7) built three of this phase's four strands: **(1) Automated test harness** — this repo had ZERO test infrastructure through Phase 10 (every prior phase verified via a throwaway `.tsx` script run once and deleted); now a real, persisted, re-runnable Vitest suite exists across 18 `core-*`/`db-schema` packages — **179 tests, 27 test files**, all green, wired into `nx run-many -t test` via the `@nx/vitest` inferred-target plugin (same pattern as `@nx/eslint/plugin` already used for `lint`). New `packages/test-support` (pure TS, no Electron dependency) provides `createTempCompanyDb`/`createTempSystemDb` — real SQLCipher-encrypted temp DBs via `db-schema`'s own documented-for-this-exact-purpose `encryptionKey` passphrase mode — the direct, finally-persisted equivalent of every prior phase's throwaway script. Coverage prioritized by risk: `core-rules-engine` (foundational), `core-identity` (security-critical crypto), `core-accounting` (the double-entry balancing invariant), `core-gst-engine`/`core-payroll-engine` (converting the already-manually-verified Phase 4/Phase 7 scenarios into real regression tests), `core-inventory` (FIFO/weighted-average, explicitly flagged since Phase 3 as needing exactly this), `core-fixed-assets`/`core-banking`/`core-multi-currency`/`core-sales-purchase` (dense pure-function math), plus lighter smoke coverage for `core-manufacturing`/`core-expense`/`core-documents`/`core-company-profile`/`core-print-templates`/`core-licensing`/`db-schema`. Not 100% coverage of ~16,900 lines in one pass — a real regression baseline over the highest-risk logic, with remaining gaps tracked below, same disclosure convention every phase has used. **(2) Security review** — a full code-level audit (auth/crypto, IPC boundary, SQL injection, audit-trail tamper-resistance, license/RBAC bypass surface, secrets-in-repo including full git history) found the codebase largely clean, plus two real fixes: a new `verifyAuditChain()` in `core-audit` (5 tests) gives Rule #5 an actual tamper-DETECTION routine — nothing previously checked the hash chain itself, only the DB triggers blocking UPDATE/DELETE — wired end-to-end as a real `SYSTEM.VIEW_AUDIT_LOG`-gated "Verify audit trail" button on the dashboard (new `auditHandlers.ts`, IPC channel, preload method, `VerifyAuditTrailScreen`); and consolidation of a `requireSessionWithCompanyDb` permission guard that had been independently duplicated byte-for-byte across 14 separate `*Handlers.ts` files into one shared implementation in `session.ts` (a maintainability/drift risk, not a live vulnerability — all 14 copies were confirmed identical before consolidating). Full findings + severity + recommendations written up in new `/docs/MHTS-ERP_Phase11_Security_Review.md`, which explicitly recommends a real third-party penetration test before onboarding a paying customer. **(3) CA sign-off prep** — new `/docs/MHTS-ERP_CA_Compliance_Test_Cases.md` compiles every GST/payroll test scenario (both the new automated ones, cited by file, and the Phase 4/Phase 7 sessions' manually-verified-but-not-yet-automated ones) plus a consolidated 16-item "Known Simplifications Requiring CA Confirmation" sign-off checklist pulling together every already-flagged compliance gap from Phases 2/4/7; also closed the one real gap the review found (GST already had a CSV export, payroll didn't) by adding CSV export to `PayrollRunScreen.tsx`, mirroring `GstReturnsScreen.tsx`'s existing `toCsv` pattern. **(4) GUI click-through remains genuinely not done** — same standing "no interactive desktop session in this sandbox" limitation every phase has carried; needs the user's own machine. Verified: full workspace `nx run-many -t build -t lint -t test` clean (62 tasks, 22 projects); `tsc --noEmit` on both renderer and main-process tsconfigs — same 2 pre-existing, already-documented Manufacturing-era errors, nothing new introduced by this increment. Not yet merged — on branch `phase11/uat-security-compliance-and-test-harness`, pending user review. **Phase 11 is NOT marked Done** — a live GUI click-through and a genuine external pentest/CA sign-off are real, un-fakeable remaining steps that need a human outside this sandbox. **Increment 2 (same branch, this session, 2026-09-08 session 28) — CA pack finalization + two adversarial internal reviews, zero application-code changes.** No source code was touched this session; the work was entirely document production, ordered per the user's explicit instruction (adversarial reviews first, then finalize the CA-facing/narrative docs with their findings folded in). **Adversarial CA-persona review** (new, not committed as a doc in `/docs` root — see deliverables note below): read `core-gst-engine`, `core-payroll-engine`, and `core-sales-purchase`'s GST/TDS files line-by-line against the existing CA Compliance Test Cases pack and found one real code-vs-its-own-documentation contradiction — `gstReturns.ts`'s `computeItcTotals()` does not exclude reverse-charge-origin lines from the "eligible ITC" pool that `computeGstr3bData()` nets against output liability, despite `Gstr3bData.rcmInwardCgst`'s own field comment explicitly claiming RCM credit is "NOT eligible for set-off against this period's ITC." This may not actually be a bug (current practice broadly allows same-period RCM ITC use), but the code and its own comment disagree with each other and need a CA ruling either way — flagged prominently in the finalized pack, deliberately NOT silently fixed in code this session (financial-logic changes need the user's explicit confirmation first, per this file's own git-workflow rule). Also found: ESI's contribution-period continuity (6-month covered-once-crossed rule) isn't modeled — `computeEsi()` re-gates every payroll run independently; and Section 87A's marginal-relief smoothing isn't modeled — `computeAnnualTaxNewRegime()` is a hard cliff at the ₹12,00,000 threshold. Both are real formula gaps, not just disclosures, and both are recommended for an actual code fix in a future session. Four new sign-off-checklist rows (S17–S20: GST TDS/TCS not modeled, TDS section-tagging has no validation safety net, the ESI gap, the 87A gap) were added to the finalized pack. **Security follow-up** (second-pass audit on top of `/docs/MHTS-ERP_Phase11_Security_Review.md`): ran a REAL `npm audit` for the first time this project (the first review had explicitly deferred it) — 15 vulnerabilities (1 critical, 12 high, 2 moderate) across 866 resolved dependencies, but independently traced every one to the `electron-builder`/`electron-vite` build-time toolchain (via `npm ls`) — none reachable from the packaged app's runtime dependency tree; specifically confirmed the one advisory whose title names `electron-updater` (`builder-util-runtime <9.7.0`) is a false alarm for this app, since the actual shipped `electron-updater@6.8.9` resolves its own `builder-util-runtime` to the patched 9.7.0, and the vulnerable 9.2.10 copy lives only in `electron-builder`'s separate, never-bundled tree. Also independently re-verified the first review's SQL-injection grep and found it undercounted its own result (3 raw `` sql`...` `` usages outside migrations exist, not the reported 1 — the other two are `core-inventory/stockLayers.ts` and `core-rules-engine/ruleSet.ts`, both hardcoded literals with no interpolation, so the underlying conclusion is unchanged but the first review's wording should be corrected). New finding out of the first review's stated scope entirely: `apps/print-templates/src/customLayoutRenderer.ts`'s `styleToCss()` interpolates layout-authored `colorHex`/`align`/`fontWeight` into an inline `style=""` attribute with no escaping/validation (low severity — mitigated by the print window's own `sandbox: true` + no preload, and today's only writer being the gated Template Designer UI). Also flagged: the print pipeline's hidden `BrowserWindow` already runs `sandbox: true` successfully with no preload script, while the main window still runs `sandbox: false` (an existing open item from the first review) — recommended this be resolved as an actual test now that a working sandboxed-window precedent exists in the same codebase, rather than staying an indefinite documentation question; and no CSP is set anywhere (low severity, no remote content is ever loaded, but cheap defense-in-depth). **Five external deliverables produced, all letterhead-branded Word `.docx` files** (per the user's explicit format choice) under new `/docs/phase11-deliverables/`: the finalized CA Compliance Pack (`MHTS-ERP_CA_Compliance_Pack_FINAL.docx`, restructured from the existing test-case doc plus the new S17–S20 rows and a prominent "items needing your judgement" section surfacing the three findings above, with a genuine blank, unsigned CA sign-off block — explicitly never marked signed/approved, since that is the real CA's call) plus a short cover note (`MHTS-ERP_CA_Cover_Note.docx`); the adversarial CA review itself (`MHTS-ERP_Phase11_CA_Adversarial_Review.docx`); the security follow-up itself (`MHTS-ERP_Phase11_Security_FollowUp.docx`); a project journey/retrospective narrative synthesizing the Blueprint's original 14–18-month/11-phase estimate against what was actually built between 2026-09-05 and 2026-09-08 (`MHTS-ERP_Project_Journey.docx`); and a launch/live-demo guide covering dev mode, a real packaged Windows installer, and a step-by-step script for the built-in "Try Demo" company — including an accuracy correction caught by actually reading `demoDataSeed.ts` rather than assuming: Demo Mode seeds parties/items/invoices/vouchers but NO employees or payroll run, so the demo script explicitly does not claim a payroll walkthrough is available out of the box (`MHTS-ERP_Launch_and_Demo_Guide.docx`). **A real, non-obvious gap surfaced while sourcing letterhead branding**: this repo has zero MHTSdigiXR-side letterhead assets anywhere — `brand.config.json` only carries `appName`/`accentColor`/`tagline` for the PRODUCT's own white-label plumbing (a different, already-built concern from Phase 9's `CompanyLetterheadScreen.tsx`, which is per-CUSTOMER-company letterhead). The logo/address/GSTIN/contact used for these five documents came from a letterhead file the user supplied directly in chat (`D:\MHTS\MHTS_Letterhead_updated.docx`), not from anything in the repository — worth remembering for any future vendor-facing (as opposed to customer-facing) branded output. **Increment 3 (same branch, same session, 2026-09-08 session 28 continued) — fixed all 3 real gaps the adversarial CA review found, with explicit plan approval first (EnterPlanMode/ExitPlanMode) per this file's own financial-logic confirmation rule.** User chose: align the RCM fix to what the pack already documents (exclude it), and fix all three gaps including the larger ESI one, not just the two simple ones. **Fix 1 (RCM set-off)**: `core-sales-purchase/gstReturns.ts`'s `computeItcTotals()` now adds a `where('is_reverse_charge', '=', IS_FALSE)` clause, so RCM-origin credit no longer enters `computeGstr3bData()`'s same-period eligible-ITC/set-off — it stays visible only in the informational `rcmInward*` fields, matching what `Gstr3bData.rcmInwardCgst`'s comment already claimed (updated that comment too). New `gstReturns.test.ts` (3 tests, first DB-integration test this package has ever had) proves a normal purchase's credit enters the set-off while an RCM purchase's does not, even when both are marked `itcEligible`. **Fix 2 (Section 87A marginal relief)**: `core-payroll-engine/salaryTds.ts`'s `computeAnnualTaxNewRegime()` now caps tax at `min(slabTax, netTaxableIncome - rebateThreshold)` above the threshold instead of the old hard-cliff full-slab-tax jump — a pure formula change, 2 new tests (relief binding near the threshold; relief correctly phasing out and matching the pre-existing P6 worked example unchanged at higher incomes). **Fix 3 (ESI contribution-period continuity)** — the largest of the three: new `esiContributionPeriod.ts` (`contributionPeriodBounds()`, pure — encodes the ESI Act's fixed Apr-Sep/Oct-Mar calendar periods independent of the company's own accounting FY; `wasEsiApplicableEarlierInContributionPeriod()`, DB-aware — queries `payslip_line`/`payslip`/`payroll_run` for this employee's prior ESI lines using the exact `'ESI (employee)'`/`'ESI (employer)'` label strings `payrollRun.ts` already writes, no new column/migration needed). `computeEsi()` gained a backward-compatible `options.forceApplicable` parameter that skips the ceiling gate and computes on uncapped actual gross (ESI has no PF-style contribution cap once covered). `payrollRun.ts` now calls the new DB helper before every `computeEsi()` call. 13 new tests total (8 in `esiContributionPeriod.test.ts` covering the pure boundary logic and the Oct-Mar calendar-year rollover, plus 3 extending the existing ESI describe block in `statutoryDeductions.test.ts`). Verified: full workspace `nx run-many -t build -t lint -t test` clean (22 projects, cache bypassed); `tsc --noEmit` on both `apps/desktop-shell` tsconfigs — same 2 pre-existing, already-documented Manufacturing-era enum-widening errors, nothing new. The finalized CA pack (`docs/phase11-deliverables/MHTS-ERP_CA_Compliance_Pack_FINAL.docx`) was regenerated: Section 1.1 now records the two payroll fixes as already-done (not open questions), Section 1.2 keeps only the RCM-direction confirmation (now reframed as "confirm the conservative exclusion is what you want," since code and document no longer contradict each other) and the still-unmodeled GST TDS/TCS item, and the sign-off checklist dropped the two now-fixed S19/S20 rows (S17/S18 remain). No UI changes were needed for any of the three fixes — all are report/computation-layer only. **Increment 4 (same branch, same session, 2026-09-08 session 28 continued again) — security hardening from the follow-up review, plus DB-integration test coverage for the four areas Increment 1's Open Questions flagged as still missing.** User asked for "both" when offered a choice between the two; infrastructure/hardening work, not financial-logic, so built and verified directly per this file's own "infrastructure/scaffolding" workflow carve-out rather than pausing for a plan approval. **Security hardening**: (1) main `BrowserWindow` now runs `sandbox: true` (was `false`) — verified safe first by confirming `preload/index.ts` uses nothing but `contextBridge`/`ipcRenderer` (no raw Node APIs, so nothing sandbox mode would break), then proven empirically by actually launching the packaged build (`npx electron .` with a throwaway `--user-data-dir`, 12-second smoke run) and confirming `system.db` was created/migrated AND `Local Storage/leveldb` files were written — the latter only happens if the renderer's own bundled script executed, which is real (if non-visual) proof the sandboxed renderer + preload boundary still works end-to-end, not just "the process didn't crash." (2) A baseline Content-Security-Policy (`default-src 'self'` etc.) is now set via `session.defaultSession.webRequest.onHeadersReceived`, deliberately skipped in dev mode (`process.env.ELECTRON_RENDERER_URL` set) since electron-vite's HMR client needs inline/eval'd scripts a strict CSP would break — only applies to the packaged/production load path. (3) `apps/print-templates/src/customLayoutRenderer.ts`'s `styleToCss()`/`renderLineElement()` now validate `colorHex` (strict hex pattern), `fontWeight`/`align` (enum check) before interpolating into an inline `style=""` attribute, instead of trusting `print_template_layout.layout_json`'s stored shape at runtime — closes the gap the security follow-up flagged. New `apps/print-templates/vitest.config.mts` (this app-tagged package had ZERO test infrastructure before now, unlike every `core-*` package) plus `customLayoutRenderer.test.ts` (6 tests) proving a malicious `colorHex`/`fontWeight`/`align` value is dropped rather than breaking out of the attribute. **DB-integration test coverage** (all four Open-Questions gap areas, one new test file each): `core-fixed-assets/depreciation.test.ts` (2 tests) — `postDepreciationRun` posts one real balanced `DEPRECIATION` voucher whose amount matches the schedule engine, the IT WDV book stays memo-only (never a `voucher_id`), and a re-run is a safe no-op; `core-multi-currency/revaluation.test.ts` (3 tests) — `postFxRevaluation` posts a real `FX_REVALUATION` voucher only when the exchange rate actually moved between booking and revaluation, in the statutorily-correct gain/loss direction, and a second run at the same date correctly sees zero further adjustment (proving `findFxExposures`' own prior-adjustment lookback works); `core-banking/reconciliation.test.ts` (2 tests) — `computeBankReconciliationStatement`'s book-vs-calculated-bank-balance math against real posted vouchers with a mix of reconciled/unreconciled lines; `core-sales-purchase/rcmCompositionPosting.test.ts` (3 tests) — composition-scheme sales collect zero GST despite normal HSN resolution, composition purchases are forced ITC-ineligible (GST folds into cost) even when the input says eligible, and reverse-charge purchases self-assess Dr Input/Cr RCM-Payable while excluding the tax from the supplier's payable — all asserted against real `computeTrialBalance` ledger balances, not just the report layer `gstReturns.test.ts` already covered. 16 new tests total across 5 new files. Verified: full workspace `nx run-many -t build -t lint -t test` clean (22 projects, cache bypassed — one `desktop-shell:lint` run hit a transient parallel-build race Nx itself flagged as "flaky," re-ran clean in isolation); `tsc --noEmit` on both `apps/desktop-shell` tsconfigs — same 2 pre-existing Manufacturing-era errors, nothing new. |

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
| 2026-09-07 | **Phase 9 split into three increments (user's explicit choice over one full pass): Increment 1 = print/PDF infra + Company Letterhead Profile + Sales Invoice/Payslip templates (the Blueprint's literal exit criterion); Increment 2 = extend templates to remaining document types + a real Print Centre register; Increment 3 = full drag-and-drop template designer.** User explicitly wants both the fast config-based rebranding path now AND the full WYSIWYG designer eventually, not one or the other — hence three increments rather than picking a single scope. | 9 |
| 2026-09-07 | **Printing/PDF uses Electron's own built-in `webContents.print()`/`printToPDF()` against a hidden, sandboxed `BrowserWindow` loaded via a `data:` URL — not `pdfmake`/`puppeteer-print` as the Blueprint's Section 6 originally suggested.** Electron already embeds a full Chromium renderer, so a second HTML-to-PDF engine (`puppeteer-print`) would duplicate it, and `pdfmake`'s own declarative layout format would mean re-authoring every template in a proprietary DSL instead of plain HTML/CSS — a real cost with no benefit given Electron's native API already does both jobs. Zero new npm dependency for this feature. | 9 |
| 2026-09-07 | **A new pure-TS `core-company-profile` package owns the Company Letterhead Profile** (address/phone/email/website/bank details/footer note/logo BLOB/per-document layout+accent) as a singleton row (`company_letterhead_profile`, fixed id, same pattern as `core-payroll-engine`'s `company_payroll_settings`) inside the per-company encrypted DB — not the system DB's `company` table, even though that table already holds legal_name/GSTIN/PAN/state_code. Reasoning: the logo is a BLOB, and Rule #3 + the existing Phase 6 precedent (`document_attachment.file_data`) both established that BLOBs belong inside the company DB so `backupCompany`'s whole-file copy captures them — putting presentation data in the system DB would split "company identity" facts (registry, cross-installation) from "company branding" facts (company-specific, must travel with that company's own backup) for no reason. A printed document needs both: identity fields resolved from the system DB's `company` row, presentation fields from this new table — exactly mirroring how `companyStateCodeFor` already does a system-DB lookup by companyId from a company-DB-scoped operation. | 9 |
| 2026-09-07 | **`apps/print-templates` (Phase 0's placeholder stub) is pure HTML/CSS string-building with zero DB or Electron dependency of its own — the caller (a new `printHandlers.ts` in `desktop-shell`) assembles all display data and handles the actual `printToPDF`/print-dialog/save-dialog calls.** Its `project.json` needed `"projectType"` changed from `"application"` to `"library"` (keeping `tags: ["type:app"]` for the existing custom boundary rule) — Nx's `@nx/enforce-module-boundaries` has a separate, non-configurable structural rule that forbids ANY project of type `"application"` from being imported by anything at all, regardless of the custom tag-based `depConstraints` that explicitly allow `type:app` to depend on `type:app`. This only surfaced once `desktop-shell` first actually imported it (Phase 0 never wired real usage), and is worth flagging for the next time a Phase-0 `apps/*` stub gets its first real consumer. | 9 |
| 2026-09-07 | **Closed two real, pre-existing schema gaps discovered while wiring a real Sales Invoice printout, both additive (migration 018), not full features:** (1) `business_party` had NO address column at all (only `warehouse.address`/`branch.address` existed anywhere in the schema) — added `business_party.address` plus the party master's first-ever post-creation edit path, `updateBusinessPartyAddress` (deliberately narrow — one field, no financial risk — so a party created before this feature existed can still get a printable address, rather than being permanently stuck without one). (2) `sales_invoice_line` already computed `itemId`/`quantityThousandths`/`ratePaise` for every stockable line (used to move stock in `createSalesInvoiceInTransaction`) but silently discarded them after posting — added `item_id`/`quantity_thousandths`/`rate_paise` columns and now persists them, so a printed invoice can show Qty/Rate for a stockable line (previously only the taxable amount survived). Both gaps predate this session; neither is a regression introduced by Phase 9. | 9 |
| 2026-09-07 | **`employee.designation` added (only `department` existed before)** — needed for a payslip's employee header block; wired through the existing `EmployeePayrollProfileInput`/`updateEmployeePayrollProfile` edit path (core-payroll-engine) rather than a new endpoint, since it's the same kind of low-risk profile field as PAN/UAN/bank details already editable there. | 9 |
| 2026-09-07 | **Journal/Payment/Receipt/Contra vouchers share ONE generic print path (`getVoucherForPrint`/`renderVoucherHtml`), not four separate ones** — the only real difference between them is the title text and which permission/screen creates them; the underlying shape (Dr/Cr ledger lines + narration + optional cost centre/branch) is identical. Every OTHER voucher type (Sales/Purchase Invoice, Expense Claim, Payroll, Stock Adjustment, Manufacturing, Fixed Asset, FX Revaluation, Inter-Branch Transfer) either already has its own richer print path or has none at all — a `PRINTABLE_VOUCHER_TYPES` allow-list (`['JOURNAL','PAYMENT','RECEIPT','CONTRA']`) gates both the main-process handler (throws if called on any other type) and the Voucher Register screen's own Print/Save PDF buttons (simply not shown for any other type), so the generic path can never be pointed at a voucher it wasn't designed for. | 9 |
| 2026-09-07 | **Purchase Invoice gets a REAL CLASSIC/MODERN layout split (reusing the existing `invoice_layout` preference, no new schema); Sales/Purchase Order, Journal/Payment/Receipt/Contra vouchers, and Expense Claim all take a `layout` parameter for signature consistency but render identically regardless of it.** Purchase Invoice is structurally identical to the already-dual-layout Sales Invoice, so building the real MODERN variant was cheap and avoided reusing a real preference for fake effect. The other four document families are simpler "back-office" documents (a ledger-line voucher, a pre-transaction order, an expense claim) where a second visual brand identity wasn't judged worth the extra code this pass — this is the EXACT precedent Increment 1's own `payslipTemplate.ts` already established (`void layout`, documented there as "the simpler layout reads the same either way"), not a new pattern invented this session. A dedicated extra `company_letterhead_profile` layout column per new document type was considered and explicitly rejected — schema surface with no real distinct rendering behind it, i.e. the same "fake functionality" smell CLAUDE.md's Rule #6 warns against for something NEW (unlike payslip's own already-existing, already-accepted decorative selector, which this pass didn't touch). | 9 |
| 2026-09-07 | **The Print Centre (`PrintCentreScreen`) is a purely client-side aggregation of each document type's own EXISTING `list*` IPC call** (`listSalesInvoices`/`listPurchaseInvoices`/`listSalesOrders`/`listPurchaseOrders`/`listVouchers`/`listExpenseClaims`, plus one new `listPayslipsForPrint` for cross-run payslips specifically, since no such flat listing existed before) — not a new backend "list every printable document" query. Each document type's own dedicated register screen keeps working completely unchanged; the Print Centre just re-fetches the same data a second time and merges it into one filterable table with a reprint button per row. Chosen over a new cross-cutting SQL view/query because the underlying entities (invoices, orders, vouchers, claims, payslips) have genuinely different shapes and no natural single "documents" table exists (or should exist) to query instead. | 9 |
| 2026-09-07 | **Migration 019 closes the purchase-side twin of Increment 1's own `sales_invoice_line` gap**: `purchase_invoice_line` never got `item_id`/`quantity_thousandths`/`rate_paise` when migration 018 added those columns to the sales side — discovered only because Increment 2 needed a real Purchase Invoice printout to show Qty/Rate the same way Sales Invoice does. Same fix shape as migration 018: nullable columns, populated by `createPurchaseInvoiceInTransaction` from data that already existed on the create-invoice INPUT (used for stock-receipt posting) but was previously discarded after use. | 9 |
| 2026-09-07 | **A company's drag-and-drop template layout lives in a new COMPANY-DB table (`print_template_layout`), not a system-wide `core-rules-engine` `rule_set` row**, even though "versioned, date-effective config resolved by a shared rules service" is exactly Rule #2's pattern. Reasoning: `rule_set` is for reference data that's genuinely the same fact for every company (a GST slab, a TDS threshold) — a company's own chosen field positions/fonts/logo placement is that company's private creative configuration, the same category `company_letterhead_profile` already lives in, so Rule #3 (company data isolation, no cross-company tables) governs here instead. The append-only supersede-on-new-version MECHANISM is still borrowed from the rules-engine tradition (and more directly from `core-manufacturing`'s `bill_of_material`, an `is_active`-flag single-active-per-key pattern in the company DB already), just not the storage location. | 9 |
| 2026-09-07 | **New pure-TS package `core-print-templates` cannot depend on `@mhts/print-templates`** — Nx's `depConstraints` only let `type:core` depend on `type:core`/`type:db`/`type:shared`, and `print-templates` is tagged `type:app` (a structural consequence of it being `desktop-shell`'s print-rendering library, not a business-logic package). So `print_template_layout.layout_json` is stored and returned as opaque `unknown` JSON — core-print-templates never parses or validates its internal shape, the exact "payload is caller-owned" precedent `core-rules-engine`'s `rule_set.rule_payload` already established. `TemplateFamily` (the 6-member document-family union) is independently declared in both packages rather than shared, mirroring how `core-company-profile`'s `DocumentLayout` type is already duplicated (not imported) into `print-templates` for the identical reason. | 9 |
| 2026-09-07 | **The template designer's drag/resize interaction is hand-rolled with plain React `onPointerDown`/`onPointerMove`/`onPointerUp` + `setPointerCapture` — no DnD/canvas library was added.** Confirmed via AskUserQuestion before planning (the alternative offered was `dnd-kit`, ~10kb, no native bindings). This codebase had zero drag-and-drop or canvas code anywhere before this session; the platform's own pointer events are sufficient for "drag to move, drag a corner handle to resize" against a small number of absolutely-positioned elements, so adding a dependency wasn't justified — the same reasoning Increment 1 used to reject `pdfmake`/`puppeteer-print` in favor of Electron's built-in printing. | 9 |
| 2026-09-07 | **Confirmed via AskUserQuestion: all 6 document families (Sales Invoice, Purchase Invoice, Order, Voucher, Expense Claim, Payslip) got the designer in one pass, not a Sales-Invoice-first increment split.** Once the generic engine (layout storage, field catalog, interpreter, print-path integration point) exists, wiring each additional family is a small, uniform addition (one catalog entry, one integration call site) — splitting it into a second increment would have meant redoing the same small pattern 5 more times in a later session for no real risk reduction, unlike e.g. Phase 8's genuinely-larger multi-currency-vs-branches split. | 9 |
| 2026-09-07 | **The designer's live canvas shows each bound field's REAL resolved value (via a new `getTemplatePreviewData` reusing the exact same `getXForPrint`+paise-conversion assembly every `buildXHtml` print function already uses) instead of a separate iframe-rendered "Preview" mode.** Considered and rejected a second mode that calls `renderCustomLayoutHtml` and shows the resulting HTML in a sandboxed iframe purely for time/scope reasons — the interactive edit canvas already needs its own React-rendered representation of every element (for click-to-select and drag handles), so duplicating that as static print HTML just to preview would be two renderers to keep in sync for one screen. Falls back to a small hardcoded placeholder dataset only when a company has zero real documents of that family yet (preview-only, clearly labelled in the UI, never reaches an actual print/PDF). | 9 |
| 2026-09-08 | **Phase 10 scoped into three increments via AskUserQuestion**: Increment 1 (installer + update/migration pipeline), Increment 2 (setup wizard), Increment 3 (demo mode — both a sample-data demo company AND a time/feature-limited trial, per the user's explicit "both" choice). Auto-update: build the full `electron-updater` flow, not a stripped-down manual-only check. Installer platforms: scaffold Windows + Mac + Linux electron-builder configs even though only Windows could be built/tested in this sandboxed dev environment. First real semver bump: `apps/desktop-shell`'s `package.json` version moved from the placeholder `0.0.0` to `1.0.0` — electron-builder reads this directly for the installer filename and it's the baseline `electron-updater` compares future releases against. | 10 |
| 2026-09-08 | **Every `@mhts/*` workspace package moved from `apps/desktop-shell/package.json`'s `dependencies` to `devDependencies`.** Not a style choice — electron-builder's production-dependency walker resolves `node_modules/@mhts/<name>` (a symlink to `packages/<name>`, outside the app directory in this npm/yarn workspace) to its real target when parsing `"dependencies"`, and crashes computing a path relative to the app dir for a target that isn't under it. Since `electron.vite.config.ts`'s existing `bundleInsteadOfExternalize` logic already inlines every `@mhts/*` package directly into `out/main/index.js`, none of them were ever true runtime `require()`s in the packaged app — `devDependencies` is the semantically correct place for them regardless of the packaging bug, not a workaround. Only `better-sqlite3-multiple-ciphers`, `node-machine-id`, and `electron-updater` are real runtime dependencies and stay in `dependencies`. | 10 |
| 2026-09-08 | **`electron-builder.yml` sets `npmRebuild: false`.** `better-sqlite3-multiple-ciphers` ships one prebuilt binary per platform/arch (`prebuilds/*.node` via `prebuildify`), not one per Node ABI version — confirmed this is an **N-API** module, which is ABI-stable across every Node.js/Electron version by design. electron-builder's `npmRebuild: true` default assumes a non-N-API module needing a from-source node-gyp rebuild against Electron's specific ABI, which this module has never needed (explaining why no `@electron/rebuild` step has ever existed anywhere in this repo, back to Phase 0) — and which additionally cannot even run in this sandboxed environment (no Visual Studio/MSVC build tools). Disabling it is the objectively correct config for this module, not just a sandbox workaround. | 10 |
| 2026-09-08 | **Windows NSIS build sets `win.signAndEditExecutable: false`; the Linux AppImage target could not be completed in this sandboxed environment; Mac DMG cannot even be attempted from Windows.** All three trace to one root cause: this environment lacks Windows Developer Mode / the symlink-creation privilege. electron-builder's Windows build otherwise eagerly downloads a combined win/mac code-signing tool archive containing macOS `.dylib` symlinks (needed even for a fully unsigned build, since there's no code-signing certificate yet — see Open Questions) and fails extracting it without that privilege; disabling `signAndEditExecutable` skips needing that archive at all, which is appropriate regardless since there's nothing to sign yet. The Linux AppImage target has no equivalent flag — it structurally needs real symlinks for its icon/desktop-file layout — so `package:linux` remains genuinely unverified pending either Developer Mode being enabled locally or a real Linux/CI build host. | 10 |
| 2026-09-08 | **`openExistingCompanyDb` (apps/desktop-shell/src/main/db.ts) now always calls `migrateCompanyDb` before returning, wrapped in a copy-before-mutate/verify/rollback-on-failure safety net.** Previously it never migrated at all (only `createAndMigrateCompanyDb`, used solely at company creation, did) — the System DB has migrated unconditionally on every startup since Phase 0 (`openAndMigrateSystemDb`), but the equivalent per-company-DB path had this exact gap the entire time, undiscovered until this session's background survey. `migrateCompanyDb` is a guaranteed no-op on an already-current DB (Kysely's `Migrator` tracks applied migrations in its own table), so this adds negligible cost to every login; the safety-copy/rollback shape directly reuses the one `restoreCompany` (`backupHandlers.ts`) already established, rather than inventing a new pattern. A brand-new company file (nothing to back up yet) skips the copy step — `createAndMigrateCompanyDb` now just calls this same function after its `mkdirSync`, removing what was previously near-duplicate logic. | 10 |
| 2026-09-08 | **`LicenseActivationTable.activated_at`'s Kysely `ColumnType` update type changed from `never` to `string`**, fixing the `licenseHandlers.ts:49` `tsc` error flagged as pre-existing/out-of-scope since Phase 3 (never fixed across 6+ sessions). The column's declared type forbade ever `.set()`-ing it via an UPDATE, but `verifyAndBind`'s re-wrap-on-license-renewal path legitimately needs to — a one-line schema-type correction (matching the exact pattern `AppPreferenceTable.updated_at` already used elsewhere in the same file) with no logic change, done now because this increment already touches the licensing-adjacent packaging/shipping path. | 10 |
| 2026-09-08 | **`electron.vite.config.ts`'s `workspacePackageNames()` now scans both `packages/*` and `apps/*`** (previously `packages/*` only), excluding this app's own directory by path comparison. Fixes a real crash the user hit running the actual packaged build: `Cannot find module '@mhts/print-templates'`. That package is a genuine, already-merged Phase 9 dependency (`printHandlers.ts`) but happens to live under `apps/print-templates` rather than `packages/*` (it's `desktop-shell`'s print-rendering library, tagged `type:app`) — so the original Phase 0 auto-bundle-discovery fix (built to stop a *hand-maintained* list from silently going stale) had an unscanned blind spot of its own the whole time, invisible in `electron-vite dev` (a plain Node process resolves the workspace symlink and loads `.ts` source directly) and only fatal in a real packaged build. Generalizing the scan (rather than special-casing `print-templates` by name) means any future `apps/*`-located `@mhts/*` package is covered automatically, the same "structurally impossible to forget" reasoning the original fix already used for `packages/*`. | 10 |
| 2026-09-08 | **Setup Wizard's quick-add item step only offers SERVICE items, never STOCKABLE.** A stockable item needs a Unit of Measure and, to actually appear on an invoice, a Warehouse — neither is seeded at company creation (confirmed: `createCompany` seeds ledgers/permissions/chart-of-accounts, never a default unit or warehouse). Auto-seeding a hidden default (e.g. a "Nos" unit, a "Main Warehouse") behind the wizard was considered and rejected: unit names and warehouse structure are genuinely business-specific, and silently guessing one contradicts the same "don't hardcode/guess a default" instinct the Blueprint applies to GST/payroll rates elsewhere in spirit, even though this isn't itself GST/payroll rule data. A physical-goods business is pointed to Inventory → Manage Items after finishing the quick setup instead — a disclosed scope trim, not a silent gap. | 10 |
| 2026-09-08 | **14-day license-free trial, per-install, tracked by a new singleton `trial_activation` system-DB row started once at first bootstrap** — confirmed via AskUserQuestion (14 days, over 7 or 30). `createCompany`'s existing soft license gate now allows a company through when EITHER a valid license exists OR the trial is still active; the `maxCompanies` limit only applies with a real license (the trial has no company-count concept, only a time limit). | 10 |
| 2026-09-08 | **The demo company is exempt from the license/trial gate entirely and never counts toward `maxCompanies`** — confirmed via AskUserQuestion. At most one exists at a time; every "Try Demo" click deletes the previous one (`company_access`/`company_recovery_key`/`company` rows + its `.db` file) and creates a fresh replacement, rather than offering any persistent "resume" path — deliberately, since resuming would require deciding how to store the demo's DEK for a password-less return visit (a real, disclosed exception to this app's zero-knowledge design not taken on for a v1). | 10 |
| 2026-09-08 | **`createDemoCompanyAndLogin` bypasses password verification entirely by calling `establishSession` (now exported from `handlers.ts`) directly with the DEK it already generated**, rather than creating a password and then immediately logging in with it. Confirmed via this session's own background survey that `establishSession` takes the raw DEK as a plain parameter with no password-derivation inside it — the exact same DEK `createAndMigrateCompanyDb` already used moments earlier. A real throwaway password is still generated (`core-identity`'s existing `generateTemporaryPassword`, the same one the admin-reset-password flow already uses for the identical "never admin/user-typed" reasoning) purely to satisfy `company_access`'s non-null columns — it is never shown or needed by anyone. | 10 |
| 2026-09-08 | **`createCompany`'s ~15-call permission-grant/ledger-seeding chain was extracted into a shared `seedNewCompanyData(companyDb)`**, called by both `createCompany` and the new demo-company handler — the exact same seeding either way (a demo company needs every module's ledgers/permissions exactly like a real one, so its reports/screens behave identically), so this removes what would otherwise have been a second copy-pasted 15-line chain rather than introducing a new pattern. | 10 |
| 2026-09-08 | **Demo sample data is seeded by calling the same IPC-layer handler functions (`createParty`, `createItem`, `createSalesInvoice`, etc.) a real user's click already calls**, from a new `demoDataSeed.ts`, rather than writing directly to the company DB or inventing a parallel "mock data" code path. This means the seeded data exercises the exact same already-tested business logic (GST auto-computation, FIFO stock costing, financial-year resolution) a real invoice would, and a bug in that seeding step (a stockable purchase line posting to the wrong ledger — see below) surfaces as the same kind of real validation error a real user would hit, not a silently-wrong shortcut. | 10 |
| 2026-09-08 | **A stockable item's PURCHASE line must post to the `Stock-in-Hand` ledger, not a generic "Purchases" expense ledger** — discovered while building the demo data seeder (real error: "A stockable item line must post to the Stock-in-Hand ledger", `core-sales-purchase`'s `createPurchaseInvoiceInTransaction`). Consistent with this codebase's perpetual-inventory design: a stockable purchase increases the stock ASSET immediately, and COGS is only recognized later, on sale (matching Phase 3's own self-balancing COGS voucher-line pair) — a generic Purchases expense ledger is only appropriate for a non-stockable (service) purchase line. Not a new rule, just newly surfaced by this being the first code in the app to construct a stockable purchase line for something other than an interactive screen already wired to the correct ledger. | 10 |
| 2026-09-08 | **Test framework: Vitest, not `node:test`, wired via the `@nx/vitest` inferred-target plugin.** Confirmed via a background survey that zero test infrastructure existed anywhere in the repo through Phase 10. Vitest was chosen because `vite`/`esbuild` are already resolved in `node_modules` (transitively via `electron-vite`) and Vitest handles the same ESM/CJS interop problem this repo already solved once for `kysely` (ESM-only) and `@mhts/*` packages (raw TS `main`, no dist build) with zero new bundler concept — `node:test` would need to re-derive that TS/ESM execution strategy from scratch. `@nx/vitest` (a dedicated Nx 23 plugin, distinct from and simpler than `@nx/vite` for a test-only, no-dev-server use case) auto-infers a `test` target from each package's own `vitest.config.mts`, the same "inferred target from a config file's presence" pattern `@nx/eslint/plugin` already established for `lint` — no hand-maintained `nx:run-commands` wiring per package. | 11 |
| 2026-09-08 | **New `packages/test-support`: real SQLCipher-encrypted temp DB fixtures, not mocks.** `createTempCompanyDb`/`createTempSystemDb` wrap `db-schema`'s `openCompanyDb`/`openSystemDb` with the `encryptionKey` passphrase mode — that mode's own JSDoc in `connection.ts` already documented it as existing "for interactive/legacy use... e.g. throwaway scripts," so this is that exact intended use, just finally persisted and shared instead of hand-rolled fresh in every session. Consistent with Rule #6 (no fake functionality) applied to test fixtures themselves — every test in this suite runs against a real encrypted SQLite file with real migrations applied, never an in-memory or mocked substitute. | 11 |
| 2026-09-08 | **Test coverage prioritized by risk × value, not attempted exhaustively.** ~16,900 lines across 18 `core-*`/`db-schema` packages had zero tests; one session cannot responsibly claim 100% coverage of that in one pass. Prioritized: `core-rules-engine` (every rate lookup depends on it), `core-identity` (security-critical crypto), `core-accounting` (the double-entry invariant), `core-gst-engine`/`core-payroll-engine` (converting the Phase 4/Phase 7 sessions' own already-manually-verified scenario lists — rate-change simulation, RCM/composition routing, wage-cap reclassification, sticky-gratuity headcount thresholds — into real persisted regression tests, since those scenarios were already designed and checked once, just never committed), `core-inventory` (FIFO/weighted-average, explicitly flagged in Open Questions since Phase 3 as needing exactly this). Remaining gaps (see Open Questions below) are disclosed, not silently skipped — the same convention every phase has used for scope trims. | 11 |
| 2026-09-08 | **Security review found the codebase's security posture largely sound**, with two real, fixed findings rather than a long list of problems: `verifyAuditChain()` closes the tamper-DETECTION gap in Rule #5 (the DB triggers already prevented UPDATE/DELETE, but nothing checked the hash chain itself, which a crafted direct INSERT with a fabricated hash could in principle defeat since triggers don't cover INSERT); and the 14× byte-for-byte-duplicated `requireSessionWithCompanyDb` permission guard was consolidated into one shared function in `session.ts` — confirmed all 14 copies were behaviorally identical before consolidating (a maintainability/drift-risk finding, not a live vulnerability). Full findings (including ones deliberately NOT auto-fixed, like `sandbox: false`'s undocumented rationale) are in `/docs/MHTS-ERP_Phase11_Security_Review.md`, which explicitly recommends a real third-party penetration test before onboarding a paying customer — this pass is real code-level audit work, not a substitute for one. | 11 |
| 2026-09-08 | **CA sign-off is prepared via a documented test-case pack + a closed CSV-export gap, not a full compliance rewrite.** New `/docs/MHTS-ERP_CA_Compliance_Test_Cases.md` gives a CA a concrete list of what's automated-and-tested vs. manually-verified-but-not-yet-automated, plus every already-flagged compliance simplification in one 16-item sign-off checklist, rather than scattered across per-phase Open Questions entries a CA would have to hunt through. The one net-new code change from this strand: `PayrollRunScreen.tsx` gained CSV export mirroring `GstReturnsScreen.tsx`'s existing `toCsv` helper — GST already had a CA-exportable artifact, payroll didn't, a real (if small) inconsistency the compliance review surfaced. | 11 |
| 2026-09-08 (session 28) | **Two internal "adversarial persona" reviews (simulated CA, simulated senior security engineer) run BEFORE finalizing the CA-facing pack, per the user's explicit sequencing instruction** — findings folded into the finalized documents rather than the pack being polished first and reviewed after. Deliberately did NOT let either simulated review touch application code even where it found a real gap (the RCM ITC set-off code-vs-comment contradiction, the ESI contribution-period gap, the 87A marginal-relief gap) — CLAUDE.md's own git-workflow rule requires explicit user confirmation before writing financial-logic code, and a document-production session is not the place to make that call implicitly. All three are flagged prominently in the finalized pack instead, for a real fix in a future confirmed session. | 11 |
| 2026-09-08 (session 28) | **All five Phase 11 external deliverables produced as letterhead-branded Word `.docx` files** (user's explicit choice over Markdown), under new `/docs/phase11-deliverables/`, using a shared hand-built `docx` (npm) generation module rather than hand-editing XML — no `pandoc`/LibreOffice/`pdftoppm` were available in this environment to visually render/verify the output, so correctness was checked by well-formed-XML validation (Python's stdlib `xml.dom.minidom` against every part of each `.docx` zip) rather than a rendered screenshot; the user should do one visual open-in-Word pass before sending the CA pack onward. | 11 |
| 2026-09-08 (session 28) | **MHTSdigiXR's own vendor-side letterhead (logo/address/GSTIN/contact) does not exist anywhere in this repository** — confirmed by search before asking the user, per this file's own "check the repo first" instruction. `brand.config.json` (`apps/desktop-shell/src/renderer/src/brand.config.json`) is the PRODUCT's white-label config (`appName`/`accentColor`/`tagline` only) for a customer's OWN branding of the shipped app — a different, already-built concern from any MHTSdigiXR-as-vendor document branding. The user supplied a letterhead file directly (`D:\MHTS\MHTS_Letterhead_updated.docx`, outside the repo) for this session's use; the extracted logo/address/contact/GSTIN were embedded into the generated `.docx` files but were NOT committed back into the repo as reusable assets (no `docs/` or `apps/*/assets` location for vendor-facing branding currently exists) — worth a deliberate decision in a future session if MHTSdigiXR-branded output becomes a recurring need. | 11 |
| 2026-09-08 (session 28, continued) | **User asked, in the same session, to scope and fix all 3 gaps the adversarial CA review found — went through EnterPlanMode/ExitPlanMode for explicit approval first, per this file's own financial-logic confirmation rule, rather than treating "yes, fix them" as blanket approval to just start editing GST/payroll files.** Two scoping choices confirmed via AskUserQuestion before planning: (1) align the RCM set-off fix to what the CA pack ALREADY documents (exclude RCM credit from the same-period set-off) rather than the code's pre-existing behavior — the pack had already gone out describing the excluded behavior, so matching the code to the document already in circulation was judged safer than the reverse, pending the real CA's eventual ruling; (2) fix all three gaps in one pass, including the larger DB-aware ESI contribution-period feature, not just the two simple pure-function ones. | 11 |
| 2026-09-08 (session 28, continued) | **ESI contribution-period continuity implemented via a DB-aware lookback, not a new schema column.** `wasEsiApplicableEarlierInContributionPeriod()` (new `core-payroll-engine/esiContributionPeriod.ts`) detects prior coverage by querying `payslip_line.label` for the exact `'ESI (employee)'`/`'ESI (employer)'` strings `payrollRun.ts` already writes, joined through `payslip`/`payroll_run` for the period — the same "reuse what's already persisted instead of adding a column" instinct this project has used before (e.g. Phase 9's `void layout` precedent). `computeEsi()` gained a `forceApplicable` option rather than changing its core signature/callers — backward compatible, every existing caller/test unaffected. | 11 |
| 2026-09-08 (session 28, continued again) | **Security-hardening and test-coverage-expansion work treated as infrastructure, not financial logic — built and verified directly (this file's own Phase 0-style carve-out) rather than pausing for a plan-approval cycle.** The user was offered a choice (security hardening vs. test coverage expansion) via AskUserQuestion and picked "Both" — neither touches accounting/GST/payroll computation, so CLAUDE.md's financial-logic confirmation rule doesn't apply here the way it did for Increment 3's three fixes. | 11 |
| 2026-09-08 (session 28, continued again) | **`sandbox: true` on the main `BrowserWindow` was verified two ways before flipping it, not just asserted safe.** Static check: grepped `preload/index.ts` for any raw Node API usage (`require(`, `node:` imports, `process.`, `__dirname`) and found none — only `contextBridge`/`ipcRenderer`, both fully sandbox-compatible by design. Dynamic check: actually launched the packaged build in this sandbox (`npx electron .` against a throwaway `--user-data-dir`, killed after 12s) and confirmed `system.db`/`system.key` were created with real content AND `Local Storage/leveldb` files existed afterward — the latter only happens if the renderer's own bundled JS executed far enough to touch `localStorage`, which is real (non-visual) evidence the sandboxed renderer+preload boundary works end-to-end. This is a more rigorous check than Phase 10's original "process didn't crash" standard, adopted because a security-relevant config flip deserves it. | 11 |
| 2026-09-08 (session 28, continued again) | **The CSP added via `session.defaultSession.webRequest.onHeadersReceived` is deliberately skipped whenever `process.env.ELECTRON_RENDERER_URL` is set (dev mode)**, applying only to the packaged/production `loadFile` path. | electron-vite's dev server needs inline/eval'd scripts and a websocket connection (HMR) that a strict `default-src 'self'` policy would break, and it's a local, trusted, dev-only server rather than untrusted remote content — the same risk profile distinction Phase 10's background-update-check logic already draws via `app.isPackaged`. | 11 |
| 2026-09-08 (session 28, continued again) | **`apps/print-templates` got its first-ever test infrastructure** (new `vitest.config.mts`, mirroring every `core-*` package's own config rather than inventing a different pattern) — this `type:app`-tagged package had zero tests through Phase 11 Increment 1, unlike every `core-*` package, simply because Increment 1's own coverage pass didn't scope it in. | 11 |
| 2026-09-08 (session 28, further continued) | **The `docgen` letterhead module was rebuilt after the user flagged the header didn't match the actual sample letterhead — a real misread on the first pass, not a subjective styling choice.** Re-opened `D:\MHTS\MHTS_Letterhead_updated.docx`'s raw XML and found the "header" in the actual sample is a single large, faint (10% opacity), page-centered WATERMARK image anchored behind the text — not a running logo-and-tagline bar the way the first pass built it. The "MHTSdigiXR / KoodaldigiXS" name-and-tagline block that had been mistaken for header content was actually page-1 BODY text in the sample, confirmed by checking `document.xml`'s own `sectPr` (only one `headerReference`, pointing at the watermark-only `header1.xml`). Rebuilt `buildHeader()` to place a pre-baked low-opacity PNG (`mhts_watermark.png`, alpha channel multiplied by 0.10 via Pillow, since the `docx` npm package's `floating` image API has no direct alpha/transparency option — baking it into the pixel data was the reliable path) as a `behindDocument: true`, page-centered floating image via `docx`'s `HorizontalPositionAlign`/`VerticalPositionAlign`/`TextWrappingType.NONE`. Also rebuilt `buildFooter()` to match the sample's exact 4-line order (brand/confidentiality/page line, address, phone/web/mobile, GSTIN) instead of the collapsed single-line version the first pass used. All six `.docx` deliverables under `docs/phase11-deliverables/` were regenerated and re-copied in. | 11 |
| 2026-09-08 (session 28, further continued) | **The Launch & Demo Guide was rewritten from "assumes zero prior codebase knowledge" to "assumes zero computer experience at all"** — the user asked for something a 12-year-old could follow. Every terminal command now has a one-sentence plain-language explanation of what it does and why (e.g. "a Terminal is just a plain window where you type commands instead of clicking buttons"), every step is a single atomic action with an explicit "You should see: ..." confirmation line, and a one-page cheat-sheet table closes the document for anyone who just wants the commands with no explanation. | 11 |

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
- [x] Phase 9 Increment 1: **Print/PDF infra + Company Letterhead Profile + Sales Invoice/Payslip printing** — **done 2026-09-07** (see Key Decisions Log for the full design). The items below are genuine, explicitly-scoped simplifications within that delivered scope (and the two already-known follow-on increments), not oversights.
- [x] Phase 9: **Printing/PDF only covered Sales Invoice and Payslip in Increment 1** — **done 2026-09-07** (Increment 2, see Key Decisions Log). Purchase Invoice, Sales/Purchase Orders, Journal/Payment/Receipt/Contra vouchers, and Expense Claims now all print/save-PDF too.
- [x] Phase 9: **No Print Centre register screen** — **done 2026-09-07** (Increment 2, see Key Decisions Log). New `PrintCentreScreen` aggregates every printable document type (Sales/Purchase Invoice, Sales/Purchase Order, Journal/Payment/Receipt/Contra voucher, Expense Claim, Payslip) into one browsable, filterable, reprintable register, composed client-side from each type's own existing `list*` call.
- [ ] Phase 9: **Purchase Invoice/Sales Order/Purchase Order/Voucher/Expense Claim print templates take a `layout` parameter but only Purchase Invoice actually renders CLASSIC differently from MODERN** — Sales/Purchase Order, Journal/Payment/Receipt/Contra vouchers, and Expense Claims render identically regardless of layout, the exact same precedent Increment 1's own `payslipTemplate.ts` established for payslips (a simpler document family where a second visual layout wasn't judged worth the extra code this pass). A dedicated extra `company_letterhead_profile` layout column per new document type was considered and rejected as schema surface with no real distinct rendering behind it; `invoice_layout` is reused as-is instead.
- [ ] Phase 9: **The generic Journal/Payment/Receipt/Contra voucher print path doesn't show cheque/UTR/instrument details** — `getVoucherForPrint` assembles ledger lines, narration, cost centre/branch names, and amounts, but doesn't join `voucher_payment_instrument` (Phase 5); a Payment/Receipt voucher with a recorded cheque or UTR reference won't show it on the printed voucher. A real, scoped-out gap, not an oversight — Phase 5's `ChequeRegisterScreen` remains the place to look up instrument details today.
- [ ] Phase 9: **Manufacturing Journal, Fixed Asset (Acquisition/Depreciation/Disposal), FX Revaluation, Inter-Branch Transfer, and Payroll vouchers still have no print path at all**, generic or otherwise — the Voucher Register's `PRINTABLE_VOUCHER_TYPES` allow-list deliberately only covers Journal/Payment/Receipt/Contra (the four "plain ledger-line" types); every other voucher type shown in that register has no Print/Save PDF button next to it. A future pass could extend the same generic `getVoucherForPrint`/`renderVoucherHtml` path to some of these, or give each its own richer template the way Sales Invoice/Payslip/Purchase Invoice got.
- [ ] Phase 9: **Print/Save-PDF permissions/reach for Increment 2's five new document types have no retroactive grant for pre-Phase-9 companies** — same characteristic every prior module's additions have had since Phase 3; not a new gap, just extending an existing one (`PRINT.PRINT_DOCUMENTS` itself was already this way after Increment 1).
- [x] Phase 9: **No drag-and-drop template designer** — **done 2026-09-07** (Increment 3, see Key Decisions Log). New `TemplateDesignerScreen` lets a company freely position/resize/bind text, image, divider, and repeating line-item-table elements per document family, saved as a versioned custom layout that overrides CLASSIC/MODERN when active.
- [ ] Phase 9: **The template designer's palette is click-to-insert, not drag-from-palette** — "drag-and-drop" in practice means freely dragging/resizing an already-placed element (hand-rolled pointer events, no DnD library exists in this codebase); adding a field from the sidebar is a click, not a drag gesture. Confirmed, deliberate scope (see Increment 3's Key Decisions Log entry).
- [ ] Phase 9: **The template designer has no QR/barcode element, no arbitrary-image element (logo only), and doesn't cover Manufacturing Journal/Fixed Asset/FX Revaluation/Inter-Branch Transfer/Payroll vouchers** (the same voucher types Increment 2 already left without any print path at all — see the row above this one). A deliberate v1 scope trim, not an oversight — there's no e-invoicing IRN feature elsewhere in this codebase yet for a QR element to bind to.
- [ ] Phase 9: **A custom template layout has no per-company retroactive default and no way to duplicate/export a layout to another company** — each company designs its own from scratch; there's also no admin "reset every company back to CLASSIC" bulk action, the same one-at-a-time characteristic every prior config screen in this codebase has had.
- [ ] Phase 9: **`business_party.address` is a single free-text field — no separate billing vs. shipping address**, and there is still no bulk/retroactive way to backfill it for every pre-existing party at once (only the new one-at-a-time `updateBusinessPartyAddress` edit path exists). A real GST tax invoice can show a distinct "Details of Consignee" block when shipping differs from billing; this pass always shows the same address for both.
- [ ] Phase 9: **No "amount in words" line on the printed Sales Invoice** — common on real Indian invoices/payslips but not built this pass; a deliberate scope trim, not an oversight.
- [ ] Phase 9: **The printed invoice/payslip letterhead resolves company GSTIN/PAN/state from the system DB's `company` row live at print time**, so editing those fields later (there's no UI to do so today, but the columns exist) would silently change how OLD invoices print — there's no per-invoice snapshot of the seller's own registration details the way `purchase_invoice`'s `is_msme_udyam_registered` snapshot works for the counterparty. Low risk today since there's no company-registration edit screen yet, but worth revisiting if one is added.
- [ ] Phase 9: **Print/Letterhead permissions have no retroactive grant for pre-Phase-9 companies** — `grantPrintPermissions`/`seedDefaultCompanyLetterheadProfile` only run at NEW company creation, the same characteristic every prior module's additions have had since Phase 3.
- [ ] Phase 9 (pre-existing, not introduced this session): **`tsc --noEmit` on the main-process project surfaces two latent enum-widening errors** in `accountingHandlers.ts`/`inventoryHandlers.ts` — the IPC boundary's own `VoucherType`/`MovementType` string-literal unions (declared directly in `apps/desktop-shell/src/shared/ipc.ts`) were never extended with `'MANUFACTURING_JOURNAL'`/`'MANUFACTURING_CONSUME'`/`'MANUFACTURING_PRODUCE'` when Phase 8 Increment 3 added those to `core-accounting`/`core-inventory`'s own enums. Re-confirmed still present and untouched as of Phase 10 Increment 1 (2026-09-08) — the only latent `tsc` error still outstanding now that `licenseHandlers.ts:49` is fixed (see below). Worth a small dedicated fix.
- [x] **`licenseHandlers.ts:49` latent `tsc` error** (flagged since Phase 3, re-confirmed unfixed in every session through Phase 9) — **done 2026-09-08** (Phase 10 Increment 1, see Key Decisions Log). `LicenseActivationTable.activated_at`'s `ColumnType` update type was `never`; changed to `string`.
- [x] Phase 10 Increment 1: **Installer + update/migration pipeline** — **done 2026-09-08** (see Key Decisions Log for the full design). The items below are genuine, explicitly-scoped gaps/limitations within that delivered scope, not oversights.
- [ ] Phase 10: **No real code-signing certificate exists yet** (Windows Authenticode / Mac notarization) — `win.signAndEditExecutable: false` produces a functionally-working but unsigned installer, which will show an OS "unknown publisher"/Gatekeeper warning. Getting a real certificate is a paid, business-side (MHTSdigiXR) decision, not a code task — re-enable `signAndEditExecutable` (and add mac notarization config) once one exists.
- [ ] Phase 10: **`package:linux` (AppImage) could not be verified in this sandboxed dev environment** — it structurally needs to create real symlinks for its icon/desktop-file layout, and this environment lacks Windows Developer Mode / the symlink-creation privilege. Needs either Developer Mode enabled on a real dev machine, or a real Linux/CI build host, before the Linux target can be trusted. `package:mac` (DMG) cannot even be attempted from Windows at all — needs an actual macOS host or CI runner.
- [ ] Phase 10: **Auto-update's real end-to-end behavior (discovering and installing an actual new published version) is unverified** — verified only that the wiring is correct and `app-update.yml` is emitted into the package; actually publishing a release via `npm run release` needs a `GH_TOKEN` this session doesn't have, the same class of limitation as the `gh`-CLI unavailability that has blocked this project from opening its own PRs since Phase 0. Verify for real the first time an actual GitHub Release is published.
- [ ] Phase 10: **The placeholder app icon (`build/icon.png`, a plain "M" monogram) is not real branding** — generated by a one-off `pngjs` script purely so electron-builder has something to derive per-platform icon formats from. Needs real MHTS/white-label art (a design task, not a code task) before any public distribution.
- [x] **`Cannot find module '@mhts/print-templates'` crash in the packaged Windows build** — **done 2026-09-08** (same session as Increment 1, reported by the user actually running the installed build; see the dedicated bugfix detail in the Phase 10 row and the new Key Decisions Log entry). Root cause: `electron.vite.config.ts`'s workspace-package auto-bundle-discovery only scanned `packages/*`, missing `@mhts/print-templates` (which lives under `apps/`) — a real, previously-undiscovered gap in the original Phase 0 bundling fix, not a premature Phase 9 import (Phase 9 was already fully merged). Fixed generically (now scans `apps/*` too) rather than special-cased, so any future `apps/*`-located `@mhts/*` package is covered automatically. Re-verified against a real rebuilt installer, not just re-asserted.
- [ ] Phase 10: **No visually-confirmed interactive GUI launch yet** — the packaged app was relaunched after the print-templates fix and now runs stably past `createWindow()` (proven via a real `system.db` write at launch time and the background update check firing 10s later, not just memory-footprint inference), which disproves the earlier "app.whenReady() never resolves here" theory. Still outstanding: nobody has visually confirmed an actual rendered/interactive window in this sandboxed environment (no screenshot capability here) — a real manual click-through on a normal desktop remains the only way to close this out completely, same as every phase before it.
- [x] Phase 10 Increment 2: **Setup Wizard** — **done 2026-09-08** (see the Phase 10 row and Key Decisions Log for the full design). The item below is a genuine, explicitly-scoped simplification within that delivered scope, not an oversight.
- [ ] Phase 10: **Setup Wizard's quick-add item step only supports SERVICE items, not STOCKABLE** — a physical-goods business must finish the wizard (or skip that step) and then set up a Unit of Measure, Warehouse, and stockable Item from the full Inventory screens afterward, same as today. See the dedicated 2026-09-08 Key Decisions Log entry for why auto-seeding a default unit/warehouse was rejected rather than attempted.
- [ ] Phase 10: **The Setup Wizard's routing logic (`fromCreation` flag threading, the four-step state machine) was verified by code review and the type-checker, not a live click-through** — same standing "no proven interactive GUI verification path in this sandbox" limitation as the item above, not specific to this increment.
- [x] Phase 10 Increment 3: **Demo Mode** — **done 2026-09-08** (see the Phase 10 row and Key Decisions Log for the full design). **Phase 10 is now functionally complete against the Blueprint's one-line scope.** The items below are genuine, explicitly-scoped simplifications within that delivered scope, not oversights.
- [ ] Phase 10: **No persistent "resume the existing demo" path** — every "Try Demo" click always wipes and recreates a fresh demo company; there is no way to log back into a demo company after logging out of it except by clicking "Try Demo" again (which replaces it). A deliberate simplification (see Key Decisions Log) avoiding a real, disclosed exception to this app's zero-knowledge DEK design that a resume feature would require.
- [ ] Phase 10: **The demo company's trial balance/reports are real but the sample data itself is fixed and non-randomized** — the same 5 parties/8 items/6 documents every time, not varied per click. Fine for its purpose (showing real reports work), but a demo clicked twice in a row looks identical in content, just under a new company id.
- [ ] Phase 10: **The trial clock cannot be reset by anything short of deleting/reinstalling** (by design — it's meant to be a genuine one-time-per-install trial) but is also not tied to any hardware fingerprint the way license activation is (`node-machine-id`) — deleting just the system DB file (not reinstalling the whole app) would restart the trial. A real gap for a determined user, though the same class of client-side-trial limitation almost all desktop trial software has; not hardened against here, and not claimed to be.
- [ ] Phase 10: **The Try Demo button, trial banner, and `onDemoReady` wiring were verified by code review and the type-checker only**, not a live click-through — the same standing "no proven interactive GUI verification path in this sandbox" limitation as every other Phase 10 UI item above.
- [x] Phase 11 Increment 1: **Automated test harness, security review, CA sign-off prep (full scope in one pass)** — **done 2026-09-08** (see the Phase 11 row and Key Decisions Log for the full design). **Phase 11 is genuinely NOT complete** — see the items below, which are real remaining gaps, not disclosed-and-accepted scope trims the way most other rows in this list are.
- [x] Phase 11: ~~Test coverage is a prioritized regression baseline, not exhaustive~~ — **PARTIALLY RESOLVED (2026-09-08, session 28, Increment 4): `core-fixed-assets`/`core-multi-currency`/`core-banking`/`core-sales-purchase` (RCM/composition posting + GSTR-3B) all gained real DB-integration tests — see Section 2's Key Decisions Log. Still not covered: GSTR-1/9/9C's own DB-integration paths beyond GSTR-3B, and non-RCM ITC-eligibility (blocked-credit) invoice posting.** Original note: 179 tests across 27 files covers the highest-risk pure-function math and the most critical DB-integration invariants (double-entry balancing, FIFO consumption, RBAC, audit-chain integrity, headcount applicability), but does NOT yet cover: `core-sales-purchase`'s GSTR-1/3B/9/9C computation functions as DB-integration tests (only the pure `computeTdsAmount` threshold math is automated there); RCM/composition-scheme/ITC-eligibility invoice-posting scenarios as DB-integration tests (currently only manually-verified per the Phase 4 session, cited in the new CA test-case pack); `core-fixed-assets`'/`core-multi-currency`'s DB-integration paths (`postDepreciationRun`, `postFxRevaluation`) — only their underlying pure math (`depreciationMath.ts`, `convertForeignToBase`) and rate-resolution (`resolveExchangeRate`) are covered; a manufacturing-journal cancellation/reversal test (the feature itself doesn't exist yet per Phase 8's own Open Questions, so nothing to test); and `core-banking`'s reconciliation/statement-import DB-integration paths (only the pure CSV-parsing half is covered). A natural next-session task, not a silent gap — each item above is a real, specific, addressable hole, not a vague "more tests would be nice."
- [ ] Phase 11: **No real third-party penetration test has been performed** — this session's security review is real code-level audit work (see `/docs/MHTS-ERP_Phase11_Security_Review.md`) but is one person's internal pass, not an adversarial external test. Explicitly recommended before onboarding a paying customer, same standing recommendation as the security review document itself makes.
- [ ] Phase 11: **No actual CA has reviewed or signed off on anything yet** — `/docs/MHTS-ERP_CA_Compliance_Test_Cases.md` is the prepared artifact a CA needs to review, not a completed review. The 16-item sign-off checklist in that document is currently all unchecked.
- [x] Phase 11: ~~`sandbox: false` on the Electron `BrowserWindow` remains undocumented as a deliberate choice~~ — **RESOLVED (2026-09-08, session 28, Increment 4).** Flipped to `sandbox: true` after confirming `preload/index.ts` uses no raw Node APIs and empirically re-launching the packaged build to confirm the renderer still bootstraps correctly under sandbox mode — see Section 2's Key Decisions Log for the exact verification method. A baseline CSP was also added for the packaged/production load path in the same pass.
- [ ] Phase 11: **The live GUI has still never been visually confirmed as interactive/rendering correctly in this sandbox** — the exact same standing limitation carried since Phase 0 ("no interactive desktop session here"), now also blocking a live click-through of the new "Verify audit trail" button and the payroll CSV export button specifically. Needs the user's own machine.

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
Date: 2026-09-08 (session 28)
Phase: 11 (UAT, Security & Compliance Sign-off), Increment 2 — CA pack
  finalization + two adversarial internal reviews (document production only,
  zero application-code changes)
What was completed:
  - Confirmed the Increment 1 PR for `phase11/uat-security-compliance-and-
    test-harness` was still NOT merged (no `gh` CLI available, same standing
    limitation since Phase 0) and continued on that same branch.
  - Read both existing Phase 11 documents in full
    (`MHTS-ERP_CA_Compliance_Test_Cases.md`,
    `MHTS-ERP_Phase11_Security_Review.md`) before starting anything.
  - User's ordering instruction: do the two adversarial reviews (deliverables
    3 & 4) FIRST, then finalize the CA pack/journey/launch-guide documents
    (1, 2, 5) with those findings folded in. Followed that order exactly.
  - **Adversarial CA-persona review**: read `core-gst-engine` (gstRates.ts,
    gstSplit.ts, gstSetOff.ts, gstSummary.ts), `core-sales-purchase`'s GST/
    TDS files (tds.ts, gstLineResolution.ts, gstReturns.ts,
    purchaseInvoices.ts, salesInvoices.ts), and `core-payroll-engine`'s
    statutory files (wageClassification.ts, pf.ts, esi.ts, pt.ts,
    salaryTds.ts, gratuity.ts, applicability.ts, rules.ts) line-by-line
    against the existing test-case pack. Found one real code-vs-its-own-
    documentation contradiction (RCM input tax credit flowing into the same-
    period GSTR-3B set-off despite `Gstr3bData.rcmInwardCgst`'s own comment
    claiming otherwise — see Section 2 Key Decisions Log for detail), plus
    two real (not just disclosed) formula gaps: ESI's 6-month contribution-
    period continuity isn't modeled, and Section 87A's marginal-relief
    smoothing isn't modeled (hard cliff at ₹12,00,000 instead). Also
    surfaced: GST TDS (Sec 51)/TCS (Sec 52) aren't modeled or disclosed
    anywhere; vendor-TDS section-tagging has no validation safety net
    against a forgotten deduction. Cross-checked the existing 16-item S1–S16
    sign-off checklist line-by-line against the code — all 16 hold up
    accurately. Added S17–S20 for the four new items.
  - **Security follow-up**: ran a REAL `npm audit` for the first time on
    this project (the first review had explicitly deferred it) — 15
    vulnerabilities (1 critical, 12 high, 2 moderate) across 866 resolved
    dependencies. Used `npm ls` to independently trace every one to the
    `electron-builder`/`electron-vite` build-time toolchain; specifically
    disproved the one advisory whose title names `electron-updater`
    (confirmed the actual shipped `electron-updater@6.8.9` resolves its own
    `builder-util-runtime` to the already-patched 9.7.0 — the vulnerable
    9.2.10 copy lives only in `electron-builder`'s separate, never-bundled
    tree). Independently re-ran the first review's SQL-injection grep and
    found it undercounted (3 raw `` sql`...` `` hits outside migrations
    exist, not the reported 1 — both extras are hardcoded literals, so the
    security conclusion is unchanged, but the wording should be corrected).
    Read `apps/print-templates/src` in full (out of the first review's
    stated scope entirely) and found `customLayoutRenderer.ts`'s
    `styleToCss()` interpolates layout-authored style values into an inline
    `style=""` attribute with no escaping/validation (low severity — the
    print window's own `sandbox: true` + no preload script limits the
    realistic impact). Compared the main window's `sandbox: false` against
    the print window's `sandbox: true` and recommended actually testing
    `sandbox: true` on the main window now that a working precedent exists
    in the same codebase. Flagged the total absence of a CSP as a cheap
    defense-in-depth gap.
  - **Five external deliverables produced** (plus a short cover note), all
    as letterhead-branded Word `.docx` files per the user's explicit format
    choice, under new `/docs/phase11-deliverables/`: the finalized CA
    Compliance Pack (existing test-case doc restructured, S17–S20 added, a
    prominent "items needing your judgement" section for the three
    code-level findings above, and a genuinely blank/unsigned CA sign-off
    block — never marked signed or approved); a cover note; the adversarial
    CA review itself; the security follow-up itself; a project journey/
    retrospective narrative (Blueprint's original 14–18-month/11-phase
    estimate vs. what was actually built 2026-09-05 to 2026-09-08); and a
    launch/live-demo guide (dev mode, a real Windows installer build, and a
    step-by-step "Try Demo" script) — the guide deliberately does NOT claim
    a payroll demo is available out of the box, since reading
    `demoDataSeed.ts` directly confirmed Demo Mode seeds parties/items/
    invoices/vouchers but no employees or payroll run.
  - Letterhead branding (logo, address, GSTIN, contact) came from a file the
    user supplied directly in chat (`D:\MHTS\MHTS_Letterhead_updated.docx`)
    after confirming no MHTSdigiXR vendor-side letterhead exists anywhere in
    this repository (`brand.config.json` is the product's own white-label
    config, a different concern). Logo extracted and cropped (Python/
    Pillow) for a compact running-header lockup vs. a fuller cover-page
    lockup. The CA cover note's signatory name/title was deliberately left
    blank per the user's explicit request ("keep space for this, we will
    add the details manually").
  - Built a small reusable `docx` (npm package, installed fresh in the
    scratchpad — not a repo dependency) generation module
    (letterhead.js: header/footer/cover-page/heading/table/callout-box
    helpers) rather than hand-writing six separate documents' XML. No
    `pandoc`/LibreOffice/`pdftoppm` were available in this environment to
    visually render the output for review, so every generated `.docx` was
    instead validated by parsing every internal XML part with Python's
    stdlib `xml.dom.minidom` (all six passed) — this is NOT the same as a
    human confirming the documents look right when opened in Word.
Any decisions made (also add to Section 2): see the four new 2026-09-08
  (session 28) Key Decisions Log rows — adversarial-reviews-before-
  finalization sequencing with no application-code changes, the docx-format
  choice and its verification limitation, and the vendor-letterhead gap.
Any blockers (also add to Section 3): none.
UPDATE (same session, continued): the user asked to scope and fix all three
  gaps immediately after reviewing the deliverables. Went through
  EnterPlanMode/ExitPlanMode for explicit approval (per CLAUDE.md's
  financial-logic confirmation rule) before touching any GST/payroll code —
  see the plan file referenced in that approval and the two new "session 28,
  continued" Key Decisions Log rows for the choices confirmed along the way.
  All three fixed, tested, and verified (see the Increment 3 paragraph in
  the Phase Status Board): `gstReturns.ts`'s RCM exclusion, `salaryTds.ts`'s
  87A marginal relief, and the new `esiContributionPeriod.ts` DB-aware
  lookback wired into `payrollRun.ts`. 18 new tests across
  `gstReturns.test.ts` (new file), `esiContributionPeriod.test.ts` (new
  file), and extensions to `statutoryDeductions.test.ts`. Full workspace
  `nx run-many -t build -t lint -t test` clean (22 projects); `tsc --noEmit`
  on both `apps/desktop-shell` tsconfigs shows only the same 2 pre-existing
  Manufacturing-era errors. The finalized CA pack was regenerated to move
  the ESI/87A items from "needs your judgement" into "already fixed" and to
  drop the two now-obsolete S19/S20 checklist rows.
Next concrete step (superseded by the update below — kept for history):
  the user should (1) do a visual open-in-Word pass on all six generated
  documents before sending any of them onward, given this session had no
  rendering tool to verify formatting itself (this still applies to the
  regenerated CA pack too); (2) whenever ready, everything from Increments
  1-3 is still on one unmerged branch
  (`phase11/uat-security-compliance-and-test-harness`) awaiting a PR/review
  decision, same as before this session.
UPDATE (same session, continued again): user was asked to choose between
  security hardening (from the security follow-up's own recommendations)
  and expanding DB-integration test coverage (from Increment 1's own Open
  Questions list) — answered "Both." Completed both as Increment 4:
  sandbox: true + a baseline CSP + the print-template style-attribute
  escaping fix (security hardening), and 16 new DB-integration tests across
  5 new files covering depreciation/FX-revaluation run posting, bank
  reconciliation, and RCM/composition invoice posting (test coverage
  expansion) — see the Phase Status Board's Increment 4 paragraph and the
  four new Key Decisions Log rows for full detail. Both Open Questions items
  this closes (sandbox: false, the test-coverage gap list) are now marked
  [x] resolved/partially-resolved in Section 3, with the residual gaps
  spelled out rather than the whole item silently disappearing.
Next concrete step (current): (1) the visual open-in-Word pass on the six
  documents is still outstanding — nothing in Increment 4 touched them;
  (2) a real third-party penetration test, an actual CA review/sign-off,
  and a live GUI click-through remain the three genuinely un-fakeable
  human steps, unchanged; (3) everything from Increments 1-4 is still on
  one unmerged branch (`phase11/uat-security-compliance-and-test-harness`)
  awaiting a PR/review decision.
```

```
Date: 2026-09-08 (session 27)
Phase: 11 (UAT, Security & Compliance Sign-off), Increment 1 — full scope in
  one pass (user's explicit choice, same precedent as Phase 7)
What was completed:
  - User confirmed Phase 10 (PR #22 + PR #23) was fully merged; synced local
    main, fixed a stale "not yet merged" note left in the tracker from before
    PR #23 landed, then started Phase 11.
  - Asked the user how to sequence Phase 11's four very different strands
    (test harness / security review / CA prep / GUI click-through); user
    chose "do all in one go." Given the scale, entered plan mode and ran
    three parallel Explore agents to survey: (1) the test-harness landscape
    (confirmed ZERO test infrastructure exists anywhere in the repo — no
    vitest/jest/node:test, no *.test.ts files, an inert nx.json test-target
    default with nothing to trigger it — ~16,900 lines across 18 core-*/
    db-schema packages never persisted-tested); (2) the security surface
    (auth/crypto, IPC boundary, SQL construction, audit-trail triggers,
    license/RBAC checks, secrets); (3) CA-facing compliance material (GST/
    payroll computation code, existing Phase 4/Phase 7 manually-verified
    scenarios, CSV export precedent). Wrote a concrete plan (Strands A-D)
    and got explicit approval before writing code, since Strand B touches
    core-identity/core-audit.
  - **Strand A (test harness)**: chose Vitest via the `@nx/vitest` inferred-
    plugin (not `@nx/vite` — a dedicated, simpler Nx 23 plugin for a
    test-only use case; not `node:test` — would need to re-derive the same
    ESM/TS interop work this repo already solved for kysely/`@mhts/*`).
    New `packages/test-support` (`createTempCompanyDb`/`createTempSystemDb`)
    wraps `db-schema`'s own documented-for-this-purpose `encryptionKey`
    passphrase mode against real temp SQLCipher files — no mocks. Wrote and
    verified **179 tests across 27 files** spanning `core-rules-engine`,
    `core-identity` (password/keyWrap/rbac), `core-accounting` (double-entry
    invariant, fx BigInt precision), `core-gst-engine` (split/set-off),
    `core-payroll-engine` (wage-cap, PF/ESI/PT/TDS, gratuity, headcount
    applicability incl. sticky gratuity), `core-inventory` (FIFO/weighted-
    average), `core-fixed-assets` (dual-depreciation math), `core-banking`
    (CSV statement parsing), `core-multi-currency` (exchange-rate
    resolution), `core-sales-purchase` (TDS threshold math), `core-audit`
    (new `verifyAuditChain`, see Strand B), `db-schema` (migration
    integrity), plus smoke tests for `core-manufacturing`, `core-expense`,
    `core-documents`, `core-company-profile`, `core-print-templates`,
    `core-licensing`. Caught and fixed several real test-authoring bugs
    along the way (a UNIQUE-constraint miss on employee ledgers, a couple of
    hand-arithmetic errors in GST set-off/FX test expectations) — all fixed
    before the suite went green, not left broken.
  - **Strand B (security review)**: full-repo grep confirmed `writeAuditLog`
    is the only code path that ever inserts into `audit_log` (no bypass);
    full git-history scan (`git log --all -p`) for committed secrets/private
    keys found nothing. Two real fixes: new `verifyAuditChain()` in
    `core-audit` (5 tests) — Rule #5 had tamper-PREVENTION (DB triggers
    blocking UPDATE/DELETE) but no tamper-DETECTION (nothing checked the
    hash chain itself, which a crafted direct INSERT could in principle
    defeat since triggers don't cover INSERT) — wired end-to-end as a real
    `SYSTEM.VIEW_AUDIT_LOG`-gated "Verify audit trail" dashboard button (new
    `auditHandlers.ts` + IPC channel + preload method + `VerifyAuditTrail-
    Screen.tsx`, following the exact `BackupScreen.tsx`/`listBranches`
    wiring pattern via another background survey). Also consolidated the
    `requireSessionWithCompanyDb` permission guard — confirmed byte-for-byte
    duplicated across 14 separate `*Handlers.ts` files — into one shared
    export in `session.ts`; all 14 copies were verified identical before
    consolidating (a maintainability/drift risk, not a live bug). Full
    findings (including things deliberately NOT fixed, like `sandbox: false`
    being undocumented) written up in new
    `/docs/MHTS-ERP_Phase11_Security_Review.md`.
  - **Strand C (CA sign-off prep)**: new
    `/docs/MHTS-ERP_CA_Compliance_Test_Cases.md` — every GST/payroll test
    scenario (both newly-automated, cited by file, and Phase 4/Phase 7's
    manually-verified-but-not-yet-automated ones), plus a 16-item "Known
    Simplifications Requiring CA Confirmation" sign-off checklist pulling
    together every already-flagged compliance gap from Phases 2/4/7. Closed
    the one real gap the review surfaced: added CSV export to
    `PayrollRunScreen.tsx`, mirroring `GstReturnsScreen.tsx`'s existing
    `toCsv` helper (GST already had a CA-exportable artifact, payroll
    didn't).
  - **Strand D (GUI click-through)**: explicitly not attempted — same
    standing sandbox limitation every phase has carried.
  - Verified throughout: full workspace `nx run-many -t build -t lint -t
    test` clean (62 tasks, 22 projects, cache bypassed at least once to
    confirm a real run); `tsc --noEmit` on both `apps/desktop-shell`
    tsconfigs — same 2 pre-existing, already-documented Manufacturing-era
    enum-widening errors, nothing new introduced by this session's changes
    (including the guard consolidation and new audit-trail UI wiring).
What's still pending in this phase: genuinely incomplete, not a disclosed
  scope trim — see the five new Phase 11 rows in Open Questions: broader
  DB-integration test coverage (GSTR return computation, RCM/composition
  invoice posting, depreciation/FX-revaluation run posting, bank
  reconciliation) beyond what's already automated; a real third-party
  penetration test; an actual CA's review/sign-off against the prepared
  document; a decision on `sandbox: false`; and the standing live-GUI-
  click-through gap, now also covering the two new UI additions this
  session (Verify Audit Trail button, payroll CSV export button).
Any decisions made (also add to Section 2): see the six new 2026-09-08 Key
  Decisions Log rows — Vitest via `@nx/vitest`, real-encrypted-DB test
  fixtures (no mocks), risk-prioritized (not exhaustive) coverage, the
  security review's two fixes, and the CA-prep approach.
Any blockers (also add to Section 3): none new — the GUI-click-through and
  external-pentest/CA-review items are known, disclosed, non-blocking
  limitations of this sandbox and this session respectively, not blockers
  in the sense of something preventing further code work.
Next concrete step: user opens the PR (or asks for the compare URL) for
  `phase11/uat-security-compliance-and-test-harness` -> `main` whenever
  ready. After that: expand DB-integration test coverage per the new Open
  Questions items, get a real external pentest scheduled, hand the CA
  compliance pack to an actual CA, and do a live GUI click-through pass on
  a real desktop the next time one is available — any of these could
  reasonably be "next," user's call.
```

```
Date: 2026-09-08 (session 26)
Phase: 10 (Commercialization Hardening), Increment 3 — Demo Mode (final
  increment; Phase 10 is now functionally complete)
What was completed:
  - User confirmed the Phase 10 Increment 1+2 PR (#22) was merged, and asked
    "next?". Fetched/confirmed the merge via `git log origin/main`, checked
    out an updated `main`, and created `phase10/demo-mode` fresh from it
    (rather than continuing on the old branch, since that one was already
    closed out).
  - This increment's scope ("demo mode") bundled a real security-adjacent
    change (extending the license gate with a trial concept) and a feature
    with no precedent anywhere in the codebase (deleting a company), so —
    matching the same bar Increment 1 used — used AskUserQuestion to resolve
    three genuine forks before planning: trial length (14 days, over 7/30),
    whether the demo company should count toward the license's maxCompanies
    limit (exempt, always creatable), and demo data volume (a realistic
    small-business snapshot: ~5 parties, ~8 items, a month of invoices, a
    couple of vouchers — over a minimal 1-2-party version).
  - Entered plan mode; spawned an Explore survey covering exactly what a
    one-click zero-typing demo login and a company-deletion helper would
    need: confirmed `establishSession` (handlers.ts) takes the raw DEK
    directly with no password derivation, so a demo handler can build a
    company like `createCompany` does and log straight in bypassing password
    verification entirely; confirmed every IPC-layer function the demo
    seeder needs (`createParty`/`createItem`/`createSalesInvoice`/etc.) reads
    the active session internally, so the seeder can just call them directly,
    real-as-a-user-click, right after `establishSession`; confirmed
    `CompanyTable` has no `is_demo` column and there's no company-deletion
    precedent anywhere to build on. Wrote and got approval on a concrete plan
    before writing code.
  - Built the trial mechanism: new system-DB migration 009 (`company.is_demo`
    + singleton `trial_activation` table, same shape as `license_activation`)
    and new `trialHandlers.ts` (`ensureTrialStarted`/`checkTrialStatus`).
    `createCompany`'s existing soft license gate now also accepts an active
    trial in place of a valid license (maxCompanies only applies with a real
    license). `CompanyListScreen` shows a trial-countdown banner when
    applicable.
  - Built the demo company: extracted `createCompany`'s ~15-call seed/grant
    chain into a shared `seedNewCompanyData` (used by both real and demo
    creation — a real de-duplication, not a new pattern). New
    `demoHandlers.ts`'s `createDemoCompanyAndLogin` (delete any existing demo
    first via a new, narrowly-scoped `deleteExistingDemoCompany` — no general
    company-deletion feature was built, deliberately) builds a fresh company
    and calls `establishSession` directly with the DEK it already generated,
    skipping password verification for a genuine one-click, zero-typing
    login. New `demoDataSeed.ts` seeds 5 parties, 8 items (5 stockable + 3
    service, real HSN/SAC codes drawn from the already-seeded GST rate
    catalog), 2 purchase + 4 sales invoices, and a RECEIPT + PAYMENT voucher
    — by calling the exact same IPC-layer handler functions a real user's
    click would call, not a parallel mock-data path.
  - Verified end-to-end (19 checks, throwaway tsx script against a real
    encrypted system DB, deleted after) — caught and fixed one real bug along
    the way: a stockable item's PURCHASE line must post to the `Stock-in-Hand`
    asset ledger, not a generic Purchases expense ledger (COGS is recognized
    on sale, not purchase, in this codebase's perpetual-inventory design) —
    the verification script's own crash surfaced this before it could ship.
    Confirmed: migration applies cleanly; the trial gate genuinely blocks
    `createCompany` with no license once expired and genuinely allows it
    while active; `createDemoCompanyAndLogin` produces a real working session
    with real permissions; exactly one demo company ever exists; all seeded
    data is independently listable and produces a real, paisa-balanced Trial
    Balance and non-zero stock position; and a second "Try Demo" click
    deletes the first demo's system-DB rows AND its `.db` file while leaving
    a separately-created real company completely untouched. Full workspace
    `nx run-many -t build -t lint` (21 projects) and `tsc --noEmit` on both
    tsconfigs clean (same 2 pre-existing Manufacturing-era errors, nothing
    new). Renderer UI (Try Demo button, trial banner, `onDemoReady` routing)
    verified by code review and the type-checker only, not a live
    click-through — same standing sandbox limitation as every prior
    increment's UI work.
  - Also corrected a small documentation gap: the Phase 10 row still said
    Increment 3 was "next" and the branch was "not yet merged" for
    Increments 1-2, which was stale once PR #22 landed — updated the Phase
    Status Board row to ✅ Done and closed out the merge-status language.
What's still pending in this phase: none — **Phase 10 is now functionally
  complete against the Blueprint's one-line scope.** Five new Open Questions
  rows track the explicitly-scoped simplifications (no demo-resume path,
  fixed non-randomized sample data, the trial clock's lack of hardware
  binding, and the standing no-interactive-GUI-verification limitation).
Any decisions made (also add to Section 2): see the six new 2026-09-08 Key
  Decisions Log rows — the trial mechanism's design, the demo company's
  exemption from the license gate, the password-bypass login mechanism, the
  seed-function extraction, seeding via real IPC-layer calls, and the
  Stock-in-Hand ledger finding.
Any blockers (also add to Section 3): none new.
Next concrete step: user opens the PR (or asks for the compare URL) for
  `phase10/demo-mode` -> `main` whenever ready. After that, Phase 10 is done;
  Phase 11 (UAT & Compliance Sign-off) is next per the Blueprint's phase
  ordering, or resequence if the user wants something else first (e.g. a
  real interactive desktop click-through pass once available, or mopping up
  one of the many residual Open Questions items accumulated across all 11
  phases so far).
```

```
Date: 2026-09-08 (session 25, second follow-up in the same session)
Phase: 10 (Commercialization Hardening), Increment 2 — Setup Wizard
What was completed:
  - User asked whether a PR needed to be opened/merged before continuing to
    Increment 2 in a future chat. Explained the two precedents this project
    has used (Phase 8: multiple increments on one branch, one PR at the end;
    Phase 9: each increment its own branch, merged before the next started)
    and offered to just continue Increment 2 on the current
    `phase10/installer-update-migration` branch rather than block on a merge.
    User said "Proceed."
  - Surveyed prerequisites before designing: confirmed `CreatePartyInput`'s
    only required fields are `partyType`/`name`/`isMsmeUdyamRegistered`
    (GSTIN/state/MSME/credit-period/address all optional — matches
    `PartiesScreen`'s own create form); confirmed `CreateItemInput` needs a
    `unitId` + `valuationMethod` only when `itemType: 'STOCKABLE'` — a
    `SERVICE` item needs neither; and confirmed via `grep` on `handlers.ts`
    that `createCompany` seeds ledgers/permissions/chart-of-accounts but
    never a default Unit of Measure or Warehouse. This directly shaped the
    wizard's item step to SERVICE-only (see the new Key Decisions Log entry
    for why STOCKABLE wasn't attempted with a hidden auto-seeded default).
  - Built `SetupWizardScreen.tsx` (new) — four steps (Welcome → quick-add
    customer → quick-add item → Ready), every step skippable, chaining the
    exact same `window.mhts.createParty`/`createItem` calls the full
    Parties/Items screens already make (no new IPC, no new backend logic).
    Wired into `App.tsx` by threading a new optional `fromCreation` flag
    through the existing `recoveryKey`→`login`→(`setNewPassword`) view chain,
    so the wizard shows exactly once, right after a brand-new company's first
    login, and never on a returning login to an existing company. The wizard's
    final step hands off to the existing, unmodified `NewSalesInvoiceScreen`
    rather than embedding its own invoice form.
  - Verified: full workspace `nx run-many -t build -t lint` (21 projects) and
    `tsc --noEmit` on both tsconfigs clean (same 2 pre-existing
    Manufacturing-era errors, nothing new). A throwaway tsx script (4 checks,
    deleted after) called the real `@mhts/core-sales-purchase` `createParty`
    and `@mhts/core-inventory` `createItem` functions with the EXACT argument
    shapes `SetupWizardScreen`'s two quick-add steps send, against a real
    encrypted company DB seeded the same way real company creation seeds it
    (chart of accounts + sales/purchase + inventory ledgers) — both succeeded,
    listed back correctly, and the service item needed no unit/warehouse at
    all. The wizard's own routing/state-machine logic was verified by code
    review and the type-checker only, not a live click-through — flagged
    explicitly in Open Questions as the same standing "no proven interactive
    GUI verification path" limitation, not something new to this increment.
What's still pending in this phase: Increment 3 (demo mode: sample company +
  trial license) is next, per the sequencing already confirmed via
  AskUserQuestion in the main session 25 entry below.
Any decisions made (also add to Section 2): see the new 2026-09-08 Key
  Decisions Log row on why the wizard's item step is SERVICE-only.
Any blockers (also add to Section 3): none new.
Next concrete step: same as the main session 25 entry — user opens the PR (or
  asks for the compare URL) for `phase10/installer-update-migration` ->
  `main` whenever ready (not required before continuing; Increment 2 was
  built on the same branch per the user's explicit "proceed" rather than
  waiting on a merge). After that: Phase 10 Increment 3 (demo mode) is next.
```

```
Date: 2026-09-08 (session 25, follow-up in the same session)
Phase: 10 (Commercialization Hardening), Increment 1 — same-session bugfix
What was completed:
  - User ran the actual packaged Windows build themselves (not dev mode) and
    hit a real crash: `Cannot find module '@mhts/print-templates'`. Asked for a
    root-cause diagnosis before any fix, specifically: (1) confirm whether
    anything legitimately imports print-templates yet, since the user's own
    message suspected it might be a premature Phase 9 feature; (2) if it's
    legitimate, find why the packaged build can't resolve it, in the same
    category as the `kysely`/`packages/*` externalization fix from Phase 0;
    (3) fix the general bundler config, not a one-off removal; (4) rebuild and
    relaunch the REAL packaged build to confirm, not just re-run the earlier
    (already-passing) throwaway scripts.
  - Confirmed via `grep` that `printHandlers.ts` genuinely imports
    `@mhts/print-templates` — real, already-merged Phase 9 work (Phase 9 was
    fully done and merged to `main` before this session began), not a
    premature import. The user's premise was based on not yet knowing Phase 9
    had shipped; corrected that in the reply rather than silently agreeing.
  - Found the actual root cause: `electron.vite.config.ts`'s
    `workspacePackageNames()` (the function that decides which `@mhts/*`
    workspace packages get bundled instead of left as external `require()`s)
    only ever scanned `packages/*/package.json`, never `apps/*`.
    `@mhts/print-templates` legitimately lives under `apps/print-templates`
    (Phase 9's real print-rendering library, tagged `type:app` not
    `type:core`) — the one `@mhts/*` package this auto-discovery mechanism had
    always missed, silently fine in `electron-vite dev` (plain Node resolves
    the workspace symlink and loads .ts source directly) but fatal the moment
    it's actually packaged, since a packaged app ships no `node_modules/
    @mhts/print-templates` at all.
  - Fixed generically per the user's explicit instruction: `workspace
    PackageNames()` now scans both `packages/*` and `apps/*`, excluding this
    app's own directory by comparing resolved paths (not by hardcoding the
    name "desktop-shell") — so any FUTURE `apps/*`-located `@mhts/*` package
    is covered automatically, the same "structurally impossible to forget"
    reasoning the original Phase 0 fix already used for `packages/*`. See the
    new 2026-09-08 Key Decisions Log row for full detail.
  - Re-verified end-to-end against the REAL rebuilt artifacts, not just
    re-asserted: rebuilt `out/main/index.js` and confirmed via `grep` it now
    contains zero `require("@mhts/...")` calls (previously exactly one) while
    `better-sqlite3-multiple-ciphers`/`node-machine-id`/`electron-updater`
    correctly remain real external requires; full workspace `nx run-many -t
    build -t lint` (21 projects) and `tsc --noEmit` on both tsconfigs stayed
    clean (same 2 pre-existing Manufacturing-era errors, nothing new); rebuilt
    the actual NSIS installer end-to-end, extracted its real packaged
    `app.asar` with the `asar` CLI (not just the pre-package build output) and
    confirmed zero `@mhts/*` requires survived into the shipped artifact; then
    relaunched the real unpacked `.exe` in this sandboxed environment — this
    time `system.db`'s mtime updated at the exact moment of launch (a real
    file-system side effect proving `bootstrap()` executed, not an inference
    from memory footprint alone), and the process ran stably through
    `createWindow()` all the way to the 10-second delayed background update
    check, which correctly logged a non-fatal 404 (no GitHub Release published
    yet — the already-disclosed, expected auto-update limitation, not a new
    bug) instead of crashing.
  - Corrected a wrong conclusion from earlier in this same session: the
    original Increment 1 handoff had attributed the packaged app's earlier
    "stuck, no crash" behavior to `app.whenReady()` never resolving due to "no
    interactive desktop session" (a Phase 0-era environment limitation). This
    was wrong — it was actually the print-templates crash the whole time,
    just invisible because a Windows GUI-subsystem process's stdout/stderr
    doesn't reach a parent shell the way a console app's does. Updated the
    Phase 10 row, the Key Decisions Log, and Open Questions to state this
    plainly rather than let the earlier incorrect diagnosis stand uncorrected.
What's still pending in this phase: same as the main session 25 entry below —
  Increment 2 (setup wizard) and Increment 3 (demo mode) are next. One Open
  Questions item narrowed, not closed: nobody has yet visually confirmed an
  actual rendered/interactive window in this sandboxed environment (no
  screenshot capability here) — the app.whenReady()-never-resolves theory is
  now disproven, but a real manual click-through on a normal desktop is still
  the only way to fully close this out.
Any decisions made (also add to Section 2): see the new 2026-09-08
  `workspacePackageNames()` Key Decisions Log row (inserted after the
  `licenseHandlers.ts` row from the main session 25 entry).
Any blockers (also add to Section 3): none new.
Next concrete step: same as the main session 25 entry below — user opens the
  PR (or asks for the compare URL) for `phase10/installer-update-migration`
  -> `main`, now including this same-session fix in the same branch/commit
  history (a separate commit, not amended into the earlier one).
```

```
Date: 2026-09-08 (session 25)
Phase: 10 (Commercialization Hardening), Increment 1 — installer + update/migration
  pipeline
What was completed:
  - User's resume message said "Currently on Phase 10." Read CLAUDE.md, the Phase
    Status Board, and confirmed via `git log`/`git fetch origin` that Phase 9
    Increment 3 (still shown "not yet merged" in the tracker doc as of session 24's
    own entry) had actually already been merged to `main` via PR #21 — the doc
    just hadn't caught up. Updated that row before starting new work.
  - Phase 10's Blueprint one-liner ("installer, update/migration pipeline, demo
    mode, setup wizard") bundles several genuinely independent, architecturally
    open concerns, the same shape that warranted a plan pause in Phases 8/9.
    Spawned two background Explore-agent surveys (packaging/licensing/setup-flow
    state, then packaging/startup internals specifically) before planning, which
    surfaced real facts rather than assumptions: no electron-builder/forge config,
    no electron-updater, no app icon anywhere in the repo (all genuinely
    greenfield); and a real bug — `openExistingCompanyDb` (used on every login)
    never called `migrateCompanyDb`, unlike the System DB's equivalent
    `openAndMigrateSystemDb`, which already migrates on every startup.
  - Used AskUserQuestion to resolve the open forks before planning: auto-update
    should be the FULL electron-updater flow (not a stripped-down check-only
    version); installer configs should scaffold Windows + Mac + Linux even though
    only Windows could be built/tested here; demo mode should eventually be BOTH
    a sample-data demo company AND a time-limited trial (deferred to Increment 3);
    and the phase should split into increments, same pattern as Phases 8/9.
  - Entered plan mode, ran one more focused Explore survey on packaging
    internals (electron-vite's bundle/externalize split, native-module
    handling, exact startup sequence, IPC/preload pattern precedent), then wrote
    and got approval on a concrete Increment 1 plan covering: the installer,
    the migration-on-login fix, and full auto-update wiring.
  - Fixed the migration bug: `openExistingCompanyDb` (`apps/desktop-shell/src/
    main/db.ts`) now always calls `migrateCompanyDb` (a guaranteed no-op on an
    already-current DB) behind a copy-before-mutate/verify/rollback-on-failure
    safety net, directly reusing the exact shape `restoreCompany`
    (`backupHandlers.ts`) already established rather than inventing a new one; a
    brand-new company file (nothing to back up yet) skips the copy step.
    `createAndMigrateCompanyDb` now just calls this same function after its
    `mkdirSync`. Updated both real call sites (`handlers.ts`'s
    `establishSession`, `backupHandlers.ts`'s `restoreCompany`) to `await` it.
  - Fixed the `licenseHandlers.ts:49` latent `tsc` error flagged as
    pre-existing/out-of-scope since Phase 3 and never fixed across 6+ sessions —
    `LicenseActivationTable.activated_at`'s Kysely `ColumnType` update type was
    `never`, blocking the legitimate re-wrap-on-renewal `.set()` call; changed to
    `string` (matching `AppPreferenceTable.updated_at`'s existing pattern).
  - Built the installer: new `apps/desktop-shell/electron-builder.yml`
    (Windows NSIS / Mac DMG / Linux AppImage, `publish: github` so
    electron-updater has a real feed), a one-off `pngjs`-based
    `scripts/generate-placeholder-icon.mjs` producing a placeholder "M" monogram
    icon (not real branding — flagged explicitly), and `apps/desktop-shell`
    version bumped from the placeholder `0.0.0` to a real `1.0.0`.
  - Hit and resolved three real, non-obvious monorepo-packaging problems (all
    confirmed empirically via actual failing builds, not guessed) — see the four
    new 2026-09-08 Key Decisions Log rows for full detail: (1) electron-builder
    can't auto-detect the Electron version when it's hoisted to the repo-root
    `node_modules` — fixed via an explicit `electronVersion` pin; (2) moved every
    `@mhts/*` workspace package from `dependencies` to `devDependencies` in
    `apps/desktop-shell/package.json`, since electron-builder's dependency
    walker crashes resolving their `node_modules` symlinks (which point outside
    the app directory to `packages/*`) and they were never true runtime
    `require()`s anyway (`electron-vite` already bundles all of them into
    `out/main/index.js`); (3) discovered `better-sqlite3-multiple-ciphers` is an
    **N-API** module (one prebuilt binary per platform/arch, not per Node ABI
    version) — ABI-stable by design, so `npmRebuild: true` (electron-builder's
    default) was actively wrong, not just unbuildable here for lack of Visual
    Studio; set `npmRebuild: false`, the objectively correct config, not a
    workaround.
  - Built full auto-update wiring, not a stub: new `updateHandlers.ts`
    (`initAutoUpdater`/`checkForUpdate`/`quitAndInstall`), a new main→renderer
    push channel (`update:status` — the first plain `webContents.send` channel
    in this codebase; every prior IPC surface has been request/response
    `invoke`/`handle`, justified here since download progress can't be modeled
    as request/response), two new request/response IPC channels
    (`CHECK_FOR_UPDATE`/`QUIT_AND_INSTALL`) following the exact existing
    `activateLicense`-style handler/preload/ipc.ts pattern, a silent
    non-blocking startup check 10s after window creation (packaged builds only,
    failures only logged — consistent with "no phone-home dependency for core
    operation"), and a new `UpdateStatusBanner` renderer component (renders
    nothing until an update is actually downloading/ready) wired into `App.tsx`
    alongside the existing `ThemeToggle`.
  - Verified end-to-end: full workspace `nx run-many -t build -t lint` (21
    projects, cache bypassed) clean; `tsc --noEmit` on both renderer and
    main-process tsconfigs — the `licenseHandlers.ts` error is gone, only the
    same 2 pre-existing Manufacturing-era enum-widening errors remain untouched.
    A throwaway tsx script (10 checks, deleted after, run directly against real
    encrypted fixture company DBs) proved the migration fix: an "old" DB fixture
    (migrations through 019 only) gets correctly brought forward to include
    migration 020's table; a brand-new company file skips the backup step
    entirely; and a deliberately corrupted migration-bookkeeping row (forcing
    Kysely's migrator to throw a real error) proved the rollback path restores
    the company DB file to its exact pre-attempt bytes while keeping the `.bak`
    for forensics. Actually ran `npm run package:win` for real: produced a
    genuine NSIS installer (`MHTS ERP Setup 1.0.0.exe`, ~126MB); inspected the
    unpacked output and confirmed `better-sqlite3-multiple-ciphers`'s prebuilt
    binaries landed under `resources/app.asar.unpacked/node_modules/` (correctly
    unpacked from asar) and a real `app-update.yml` was emitted. Launched the
    packaged app several times in this sandboxed environment: it consistently
    reached a stable multi-process Electron memory footprint with no crash or
    immediate exit (strong evidence the bundled JS and all three real
    native/runtime dependencies resolved and loaded correctly), but
    `app.whenReady()` never actually resolved to show a window — the same
    pre-existing "no interactive desktop session" limitation Phase 0's own
    status note has carried since session 1, not a new gap. Attempted
    `npm run package:linux`: failed on a Windows-Developer-Mode/symlink-privilege
    limitation structural to AppImage packaging (disclosed, not worked around —
    see Open Questions); `package:mac` was not attempted at all, since DMG
    creation cannot run on Windows regardless of privileges.
What's still pending in this phase: Increment 2 (setup wizard) and Increment 3
  (demo mode: sample company + trial license) are next, per the sequencing
  already confirmed via AskUserQuestion this session. Within Increment 1 itself,
  see the five new Phase 10 Open Questions rows added this session for the
  explicitly-scoped gaps (no real code-signing certificate yet, Linux/Mac
  targets unverified in this environment, auto-update's real discover-and-
  install round-trip unverified without a published release, the placeholder
  icon needs real branding, and no full interactive GUI click-through was
  possible here).
Any decisions made (also add to Section 2): see the five new 2026-09-08 Key
  Decisions Log rows added this session — the increment scoping/sequencing
  choices from AskUserQuestion, the `@mhts/*` dependencies-to-devDependencies
  move, the `npmRebuild: false` N-API finding, the `signAndEditExecutable`/
  Linux/Mac disclosure, and the migration-on-login fix's design.
Any blockers (also add to Section 3): none new beyond what's already
  documented in Open Questions. Same `gh` CLI/token unavailability as every
  prior session for opening this increment's own PR; same "no interactive
  desktop session" limitation as every prior session for a full manual
  click-through; new this session — no Windows Developer Mode/symlink privilege
  (blocks the Linux AppImage target) and no code-signing certificate (blocks
  real Windows/Mac signing), both flagged in Open Questions as needing action
  outside this session (enabling a local dev setting, and a business decision
  on paying for a certificate, respectively) rather than a code fix.
Next concrete step: user opens the PR (or asks for the compare URL) for
  `phase10/installer-update-migration` -> `main`. After that: Phase 10
  Increment 2 (Setup Wizard — a guided multi-step flow wrapping the existing
  `CreateCompanyScreen` plus a path toward the first customer/item/invoice,
  targeting the Blueprint's literal "first invoice in under 15 minutes" exit
  criterion) is next, or resequence if the user wants Increment 3 (demo mode)
  first instead, or wants to address one of the newly-flagged Open Questions
  items (e.g. enabling Developer Mode to unblock a real Linux build test).
```

```
Date: 2026-09-07 (session 24)
Phase: 9 (Print + Templates), Increment 3 — drag-and-drop template designer
  (final increment; Phase 9 is now functionally complete)
What was completed:
  - User said "Start Phase 9 Increment 3". Read CLAUDE.md, the Phase Status
    Board, and Session 23's own handoff entry; confirmed via `git log`/
    `git status` that Phase 8, Increment 1, and Increment 2 were all already
    merged to `main` (PRs #18/#19/#20), so this session started clean.
  - This increment's scope ("full drag-and-drop template designer") was
    architecturally open-ended enough — new UI patterns never used before in
    this codebase, a real storage-location design fork, a DnD-vs-hand-rolled
    build choice — that it warranted a real plan pause rather than the
    infrastructure-work no-pause exception Increments 1/2 used. Entered plan
    mode: spawned an Explore agent to map the exact current shape of
    `apps/print-templates`, `company_letterhead_profile`, the `printHandlers.ts`
    IPC pattern, the renderer's (lack of a) component library, every existing
    document type's print-data-assembly function, and the `core-rules-engine`
    rule_set precedent for "config as data." Then used AskUserQuestion to
    resolve the two genuinely open forks before writing the plan: (1) all 6
    document families in one pass vs. Sales-Invoice-first — user chose all 6;
    (2) hand-rolled pointer-event drag/resize vs. adding `dnd-kit` — user
    accepted the hand-rolled recommendation (zero new dependency, matches
    Increment 1's own precedent of preferring the platform over a new lib).
  - Built the full design from the approved plan (see the new Phase 9 rows in
    the Key Decisions Log for the complete architecture — the company-DB-not-
    rule_set storage decision, the core-print-templates-can't-depend-on-
    print-templates Nx-boundary consequence, the hand-rolled-DnD choice, the
    all-6-families-at-once choice, and the live-canvas-instead-of-iframe-
    preview choice). New migration 020 (`print_template_layout`, is_active
    append-only-supersede, same pattern as `core-manufacturing`'s
    `bill_of_material`). New pure-TS package `core-print-templates`
    (`saveTemplateLayoutVersion`/`getActiveTemplateLayout`/
    `listTemplateLayoutVersions`/`revertTemplateLayout`, all audit-logged).
    `apps/print-templates` gained a generic interpreter alongside its
    existing CLASSIC/MODERN builders: `templateLayoutTypes.ts`
    (TemplateLayoutDocument/TemplateElement — text/image/line/table, all
    mm-positioned), `templateFieldCatalog.ts` (a static field-path catalog
    per family built straight from the existing `*TemplateData` interfaces),
    `customLayoutRenderer.ts` (`renderCustomLayoutHtml` — dot-path field
    resolution + absolute-positioned inline-style HTML, reusing the existing
    `escapeHtml`/`formatRupees`/`wrapHtmlDocument` helpers). `printHandlers.ts`:
    all 6 `buildXHtml` functions gained a `getActiveTemplateLayout` check
    before falling back to their existing CLASSIC/MODERN renderer, and now
    also return their assembled `data` object (not just html/fileNameBase) so
    a new `getTemplatePreviewData` handler can genuinely reuse that exact
    assembly for the designer's live canvas against the most recently
    created real document of each family (placeholder data only when a
    company has none yet). 6 new IPC channels, all gated behind the existing
    `PRINT.MANAGE_LETTERHEAD` permission — no new permission needed. New
    `TemplateDesignerScreen.tsx`: family picker, click-to-insert field
    palette, hand-rolled pointer-event drag/resize, a property panel
    (font/align/weight for text, column list for tables), Save/Revert, and
    the canvas itself shows each bound field's real resolved value live
    (doubling as the WYSIWYG preview — no separate iframe preview mode this
    pass). Wired into `App.tsx`/`DashboardScreen.tsx` behind the same
    `PRINT.MANAGE_LETTERHEAD` gate as the Company Letterhead screen.
  - Verified end-to-end (23 checks, throwaway tsx script against a real
    encrypted company DB built via `openCompanyDb`/`migrateCompanyDb`
    directly — no Electron dependency needed for this increment's own new
    logic — deleted after): migration 020 applying cleanly alongside all 19
    prior migrations; versioned save/get/list/revert against real SQLite
    (supersede-not-overwrite leaving exactly one ACTIVE row, a second
    document family staying completely independent, revert deactivating
    with history preserved, reverting an already-reverted or never-customized
    family being a safe no-op, and exactly 4 real `audit_log` rows for the 4
    actual mutating actions taken); and the interpreter itself (a bound
    field resolving to its REAL value not the raw field-path string, static
    text rendering verbatim, every row of a bound array rendering in a table
    element, a currency column going through real `₹`-formatting, mm-based
    absolute positioning matching the designer canvas's own coordinate
    system, a null bound field rendering as empty rather than the string
    "null"/"undefined", an empty array producing zero rows without throwing,
    and a missing logo being cleanly omitted rather than a broken `<img>`
    tag). Full workspace `nx run-many -t build -t lint` (22 projects, cache
    bypassed) clean; `tsc --noEmit` run separately on both
    `apps/desktop-shell/tsconfig.web.json` (renderer — clean) and
    `tsconfig.node.json` (main/preload — introduces no NEW errors; confirmed
    via `git status` that the same 3 pre-existing latent errors from Session
    23 — `licenseHandlers.ts`'s already-documented one, plus the two
    Manufacturing-era `VoucherType`/`MovementType` enum-widening gaps in
    `accountingHandlers.ts`/`inventoryHandlers.ts` — sit in files this
    session never touched), since `electron-vite build` alone (esbuild-based)
    doesn't type-check and the Nx `build` target passing is not sufficient
    proof on its own.
What's still pending in this phase: Phase 9 is now functionally complete
  against the Blueprint's one-line scope. Residual, explicitly-scoped
  simplifications (click-to-insert vs. true drag-from-palette, no QR/
  arbitrary-image elements, no cross-company layout duplication, several
  voucher types Increment 2 already left without any print path at all,
  no retroactive permission grants for pre-Phase-9 companies, no "amount in
  words" line, no separate billing/shipping address) are tracked in Section
  3 (Open Questions), not silently dropped. Phase 10 (Commercialization) is
  next per the Blueprint's phase ordering.
Any decisions made (also add to Section 2): see the five new 2026-09-07
  Phase 9 rows in the Key Decisions Log added this session (appended after
  Increment 2's own rows) — company-DB-not-rule_set storage, the Nx-boundary
  consequence for core-print-templates, hand-rolled DnD, all-6-families-at-
  once, and live-canvas-instead-of-iframe-preview.
Any blockers (also add to Section 3): none. Same `gh` CLI/token
  unavailability as every prior session — this branch would need to be
  pushed to origin and its PR opened by a human (base: main, since Phase 8
  and both prior Phase 9 increments are all already merged there).
Next concrete step: user opens the PR (or asks for the compare URL) for
  phase9/print-templates-increment3 -> main. After that: Phase 10
  (Commercialization: installer, update/migration pipeline, demo mode,
  setup wizard) is next per the Blueprint's phase ordering, or resequence if
  the user wants something else first (e.g. mopping up one of the residual
  Open Questions items, or a manual GUI click-through pass once a real
  interactive desktop session is available — this sandboxed environment has
  never had one, the same caveat Phase 0's own status note carries).
```

```
Date: 2026-09-07 (session 23)
Phase: 9 (Print + Templates), Increment 2 — extend printing to remaining
  document types + a real Print Centre register
What was completed:
  - User said "Start Phase 9 Increment 2" — read the Phase Status Board and
    Session 22's own handoff. Confirmed via `git log`/`git status` that both
    Phase 8 and Phase 9 Increment 1 are already merged to `main` (PRs #18
    and #19), so this session started clean on `main`, no rebasing needed —
    the "retarget after Phase 8 merges" step from Session 22's handoff
    resolved itself before this session began.
  - Increment 2's scope was already fully confirmed in the Phase Tracker
    from Increment 1's own planning session (Purchase Invoice, Sales/
    Purchase Orders, Journal/Payment/Receipt/Contra vouchers, Expense
    Claims, plus a real Print Centre register) — not ambiguous, so no
    further AskUserQuestion round before starting, per CLAUDE.md's
    infrastructure-work exception (printing/display, no accounting/GST/
    payroll computation changes).
  - Spawned a dedicated Explore agent first to gather exact, current facts
    (file paths, full code, real column names) on Increment 1's print
    infra, the exact shapes of purchase_invoice/sales_order/purchase_order/
    voucher/expense_claim tables, and the existing register-screen/print-
    button UI conventions — before writing any code, same reasoning as
    Session 22's own pre-planning explore pass.
  - Built Increment 2 in full (see the new Phase Status Board paragraph and
    Key Decisions Log entries for the complete design). Migration 019
    closes purchase_invoice_line's twin of Increment 1's own sales-side
    gap (item_id/quantity_thousandths/rate_paise, now persisted). Five new
    getXForPrint assembly functions across core-sales-purchase (Purchase
    Invoice, Sales Order, Purchase Order), core-accounting (a new generic
    getVoucherForPrint for Journal/Payment/Receipt/Contra — the first
    print-assembly function for a bare ledger-line voucher), and core-
    expense (Expense Claim, reusing ExpenseClaimSummary as-is). New
    listPayslipsForPrint (core-payroll-engine) for the Print Centre's
    cross-run payslip listing. Five new print-templates builders
    (purchaseInvoiceTemplate.ts gets a real CLASSIC/MODERN split;
    orderTemplate.ts/voucherTemplate.ts/expenseClaimTemplate.ts follow
    payslipTemplate.ts's own single-layout precedent). printHandlers.ts
    gained five new build/print/save triples following Increment 1's exact
    template. New PrintCentreScreen.tsx composes its unified, filterable,
    reprintable table client-side from each document type's own EXISTING
    list* IPC call — no new backend "list every printable document" query.
    Print/Save PDF buttons added to PurchaseInvoiceRegisterScreen,
    SalesOrderRegisterScreen, PurchaseOrderRegisterScreen (unconditional —
    an order is printable regardless of status), VoucherRegisterScreen
    (gated to a new PRINTABLE_VOUCHER_TYPES allow-list so only Journal/
    Payment/Receipt/Contra rows get the buttons), and
    ExpenseClaimRegisterScreen. No new permission needed — every action
    reuses the existing PRINT.PRINT_DOCUMENTS from Increment 1.
  - Verified end-to-end (31 checks, throwaway tsx script against a real
    encrypted company/system DB pair built via the exact same seed sequence
    as real company creation, deleted after) — the purchase-invoice qty/
    rate/item persistence round-trip, a genuine CLASSIC-vs-MODERN HTML diff
    for the Purchase Invoice, Sales/Purchase Order print assembly with the
    flat-tax (no CGST/SGST/IGST split) line shape, a Journal voucher's
    ledger-name resolution and Dr/Cr total, confirming getVoucherForPrint
    correctly reports a Purchase Invoice voucher's own type (proving the
    caller-side PRINTABLE_VOUCHER_TYPES guard has accurate data to gate
    on), Expense Claim print assembly, and listPayslipsForPrint running
    cleanly against the real schema with zero payroll runs (proves the
    JOIN query itself is valid, not just type-correct). Full workspace
    `nx run-many -t build -t lint` (20 projects, cache bypassed) clean
    (one transient electron-vite temp-file ENOENT on desktop-shell:lint,
    confirmed flaky and clean on an immediate retry — unrelated to this
    session's changes); `tsc --noEmit` clean on the renderer project and
    introduces no NEW errors on the main-process project (confirmed via
    `git status` that the same 3 pre-existing latent errors from Session 22
    — licenseHandlers.ts's already-documented one, plus the two
    Manufacturing-era enum-widening gaps in accountingHandlers.ts/
    inventoryHandlers.ts — sit in files this session never touched).
What's still pending in this phase:
  - Increment 3 (full drag-and-drop template designer) is confirmed-scope,
    not started. See the new Phase 9 rows in Section 3 (Open Questions) for
    every explicitly-scoped simplification within Increment 2 itself
    (single-layout templates for 4 of the 5 new document types, no
    instrument/cheque details on a printed voucher, several other voucher
    types still have no print path at all — generic or otherwise, etc.)
Any decisions made (also add to Section 2): see the five new 2026-09-07
  Phase 9 rows in the Key Decisions Log — the generic Journal/Payment/
  Receipt/Contra voucher print path with its allow-list guard, the single-
  vs-dual-layout split across the five new document types and why, the
  Print Centre's client-side aggregation approach, and migration 019's
  purchase-side schema gap closure.
Any blockers (also add to Section 3): none. Same `gh` CLI/token
  unavailability as every prior session — this branch is pushed to origin
  but the PR itself needs a human to open it on GitHub (base: main, since
  Phase 8 and Increment 1 are both already merged there — no stacking
  needed this time).
Next concrete step: user opens the PR (or asks for the compare URL) for
  phase9/print-templates-increment2 -> main. After that, either continue
  straight into Phase 9 Increment 3 (the drag-and-drop template designer),
  or resequence if the user wants something else first.
```

```
Date: 2026-09-07 (session 22)
Phase: 9 (Print + Templates), Increment 1 — print/PDF infra + Company
  Letterhead Profile + Sales Invoice/Payslip printing
What was completed:
  - User said "Start Phase 9" — read the Phase Status Board (Phase 8 done
    but not yet merged/PR'd), the Blueprint's one-line Phase 9 scope
    ("Print Centre, native OS printing, PDF, document template designer" —
    exit criterion "Invoice/payslip templates fully re-brandable without
    code"), and confirmed via a quick codebase check that apps/print-
    templates is still Phase 0's empty stub and no printing code exists
    anywhere yet.
  - Presented a three-increment sequencing plan via AskUserQuestion before
    writing code (per CLAUDE.md's spirit for a new phase, even though
    printing isn't itself accounting/GST/payroll logic): Increment 1 =
    print/PDF infra + letterhead profile + Sales Invoice/Payslip templates
    (the literal exit criterion); Increment 2 = remaining document types +
    a real Print Centre register; Increment 3 = full drag-and-drop
    template designer. Also asked config-based-rebranding vs. full WYSIWYG
    designer for v1 — user answered "Both", confirming the increment split
    (fast config-based path now, full designer later) rather than picking
    one over the other.
  - Explored (via a dedicated Explore agent, to avoid burning context on
    wide codebase reads) the exact current shape of sales_invoice/
    sales_invoice_line across every migration, business_party's columns,
    PayslipSummary's shape, the IPC/preload/handler wiring convention, the
    permissions/seeding convention, the migration-file convention, and the
    dialog/save-file precedent — before writing any code, since accurate
    column-level facts (not assumptions) were needed to plan the schema
    additions correctly.
  - Built Increment 1 in full. New migration 018: singleton
    `company_letterhead_profile` table (address/phone/email/website/bank
    details/footer note/logo BLOB — the SECOND blob column in this schema
    after Phase 6's document_attachment/per-document layout+accent), plus
    three real, pre-existing schema gaps closed: `business_party.address`
    (there was no party address column anywhere before this), a new
    `updateBusinessPartyAddress` (the party master's first-ever post-
    creation edit path), `employee.designation` (payslip header), and
    `sales_invoice_line.item_id`/`quantity_thousandths`/`rate_paise` (the
    create-invoice input already computed these for stock-posting but
    silently discarded them afterward — now persisted for printing).
  - New pure-TS package `core-company-profile` (letterhead CRUD + logo
    set/clear + permissions, same singleton-row pattern as core-payroll-
    engine's company_payroll_settings). `apps/print-templates` (Phase 0's
    stub) is now real: pure HTML/CSS string builders for a Sales Invoice
    and a Payslip, two layouts each (CLASSIC/MODERN), zero DB/Electron
    dependency. Its project.json needed `projectType` changed from
    "application" to "library" — Nx's enforce-module-boundaries has a
    separate structural rule (independent of the custom tag-based
    depConstraints) that blocks ANY "application"-type project from being
    imported by anything at all; this only surfaced once desktop-shell
    first actually imported it, since Phase 0 never wired real usage.
  - `core-sales-purchase` gained `getSalesInvoiceForPrint` (full header+
    lines+party assembly, paise/thousandths throughout — no display
    concerns of its own, same convention as every other core package).
    `core-payroll-engine` gained `getPayslipForPrint` (employee+run
    assembly, including the new designation/PAN/bank/UAN fields
    PayslipSummary deliberately never carried).
  - New `printHandlers.ts` in desktop-shell: assembles a LetterheadForPrint
    (company identity from the system DB's `company` row + presentation
    fields from the new company-DB profile — a printed document needs
    both), renders HTML via print-templates, then uses Electron's own
    built-in `webContents.print()`/`printToPDF()` against a hidden
    sandboxed BrowserWindow loaded via a data: URL — deliberately no new
    npm dependency (pdfmake/puppeteer-print), since Electron already
    embeds Chromium. Full IPC/preload/handler wiring (9 new channels), a
    new CompanyLetterheadScreen (profile edit + logo upload/clear + layout
    +accent pick), Print/Save-PDF buttons wired into
    SalesInvoiceRegisterScreen and PayrollRunScreen's payslip rows, an
    address-edit control added inline to PartiesScreen, and a designation
    field added to EmployeePayrollProfileScreen. New PRINT.MANAGE_LETTERHEAD
    /PRINT.PRINT_DOCUMENTS permissions, seeded at company creation
    alongside every other module (same "not retroactive for pre-existing
    companies" characteristic every prior module's additions have had).
  - Verified end-to-end (45 checks, throwaway tsx script against a real
    encrypted company/system DB pair, deleted after): the qty/rate/item
    persistence on a real posted sales invoice (mixed stockable + service
    lines), the party-address retrofit path for a pre-existing party,
    letterhead profile CRUD, logo blob round-trip (byte-for-byte, second
    blob column in this schema), a genuine CLASSIC-vs-MODERN HTML diff for
    IDENTICAL underlying data (the literal "fully re-brandable without
    code" exit criterion) plus the accent color flowing through with zero
    code change, and payslip print-assembly correctly joining the new
    designation/PAN/bank/UAN fields (payroll computation itself already
    verified in Phase 7, so this exercised the new print-assembly/rendering
    code specifically, not re-verified payroll math). Full workspace
    `nx run-many -t build -t lint` (20 projects, cache bypassed) clean;
    `tsc --noEmit` clean on the renderer project, and introduces no NEW
    errors on the main-process project (confirmed via `git status` that
    the 3 pre-existing latent errors — licenseHandlers.ts's already-
    documented one, plus two Manufacturing-era VoucherType/MovementType
    enum-widening gaps in shared/ipc.ts — sit in files this session never
    touched).
What's still pending in this phase:
  - Increment 2 (remaining document types + Print Centre register) and
    Increment 3 (drag-and-drop designer) are both confirmed-scope, not
    started. See the new Phase 9 rows in Section 3 (Open Questions) for
    every explicitly-scoped simplification within Increment 1 itself
    (single free-text party address, no amount-in-words, no retroactive
    permission grant, the pre-existing VoucherType/MovementType gap, etc.)
Any decisions made (also add to Section 2): see the six new 2026-09-07
  Phase 9 rows in the Key Decisions Log — the increment split, the
  Electron-native-print-API choice over pdfmake/puppeteer, the letterhead
  profile living in the company DB (not the system DB) and why, the
  print-templates app->library projectType fix and why it was needed, the
  two pre-existing schema gaps closed, and the new employee.designation
  field.
Any blockers (also add to Section 3): none for the work itself. Process
  note: this environment has no `gh` CLI and no GitHub token, so neither
  Phase 8's PR nor Phase 9's PR could be opened programmatically — both
  branches are pushed to origin; a human needs to open both PRs on GitHub
  (phase8/fixed-assets-cost-centres-budgets -> main, then
  phase9/print-templates-increment1 -> phase8's branch, since Phase 9 is
  stacked on the still-unmerged Phase 8 per the user's explicit choice).
Next concrete step: user opens both PRs (or asks for the compare URLs);
  after Phase 8 merges to main, phase9's base should be retargeted to main.
  Then either continue straight into Phase 9 Increment 2, or resequence if
  the user wants something else first.
```

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
