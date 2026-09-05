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
| 0 | Foundation | Shell, DB, auth, RBAC, audit trail, backup framework, theme, license/white-label plumbing | 🟨 In progress | | Electron+React shell (real packaged app relaunch-verified, not just build-verified) with a real IPC boundary; multi-company creation, per-company login credentials, offline account lockout, offline Super Admin password reset, and recovery-key-based recovery, all verified end-to-end against real encrypted files. Backup framework, theme engine, and license/white-label plumbing still pending. |
| 1 | Accounting Core | Chart of accounts, ledgers, vouchers, double-entry, TB/P&L/BS | ✅ Done | | Every item in the Blueprint's Phase 1 line is built, verified end-to-end, and has a real working UI: Chart of Accounts, ledgers, double-entry vouchers (unbalanced/malformed entries impossible — the exit criterion is a real tested code path), Trial Balance, Profit & Loss, and Balance Sheet (Assets = Liabilities + Equity proven to balance, incl. a Current Earnings roll-up). The two items previously deferred beyond the Blueprint's literal scope are now also done: voucher cancellation (via an auto-generated reversal voucher, not a destructive edit, with a new Voucher Register screen to find and cancel one) and dedicated Payment/Receipt/Contra voucher forms (auto-balancing, alongside the generic Journal form). Still open, not oversights (see Open Questions): opening-balance netting across ledgers. |
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
| 2026-09-05 | **Dedicated Payment/Receipt/Contra voucher screens**, alongside the existing generic Journal form (renamed `JournalVoucherScreen` for clarity) — no backend changes needed, since `createVoucher` already accepts arbitrary lines for any voucher type. Payment: pick one "paid from" ledger (auto-credited for the total) + one or more "paid to" lines (debited). Receipt: the mirror image. Contra: a plain two-ledger transfer, one amount. | The whole point is auto-balancing: previously every voucher, regardless of type, required manually entering both a debit and a credit that summed to the same total — easy to get wrong by hand. These forms compute the counter-ledger's amount automatically, so the user only ever enters one side. Server-side validation in `createVoucher` (debits must equal credits) is unchanged and still the actual authority — the auto-balancing is a UX convenience, not a weakening of the correctness guarantee. Verified end-to-end: Payment and Contra vouchers built exactly the way their screens construct lines post correctly and the resulting Trial Balance ties out to the paisa. | 1 |

---

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
- [ ] There is no "invite a new user" flow yet — `listCompanyUsers`/`adminResetPassword` assume a `company_access` row already exists for the target (currently only created by `createCompany`'s admin bootstrap). Needed before Manage Users is actually usable for onboarding a second real person, not just resetting one.
- [x] Phase 1: P&L and Balance Sheet reports — **done 2026-09-05**, built on a new shared `computeLedgerBalances` helper alongside a refactored Trial Balance (see Key Decisions Log). Turned out not to need a recursive group-hierarchy rollup after all — every `account_group` row (including sub-groups) already carries its own `nature` directly, so a flat `WHERE nature IN (...)` join was sufficient; the anticipated complexity wasn't actually there.
- [x] Phase 1: voucher cancellation and Payment/Receipt/Contra-specific UX — **done 2026-09-05** (see Key Decisions Log). Cancellation posts an automatic, cross-linked reversal voucher (never a destructive edit); a new Voucher Register screen lists vouchers and is where cancellation is triggered from. Payment/Receipt/Contra now have dedicated auto-balancing forms; Journal (renamed `JournalVoucherScreen`) remains the generic multi-line form for anything else. Direct in-place voucher *editing* (as opposed to cancellation) is still not offered — intentionally: real accounting practice favors correction-by-reversal over rewriting posted history, so this isn't tracked as a gap.
- [ ] Phase 1: `computeTrialBalance` does not require opening balances to net to zero across ledgers (only vouchers are forced to balance, via `createVoucher`). A business entering ad hoc opening balances that don't net out will see a Trial Balance that doesn't balance either — real accounting software absorbs this via an opening "Suspense"/equity adjustment ledger, which this pass doesn't build.

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
