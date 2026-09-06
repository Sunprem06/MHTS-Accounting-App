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
