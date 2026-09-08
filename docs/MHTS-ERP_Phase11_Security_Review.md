# MHTS ERP — Phase 11 Security Review

*A code-level security audit of the current codebase (branch
`phase11/uat-security-compliance-and-test-harness`), performed as part of
Phase 11 (UAT, Security & Compliance Sign-off). This is real defensive
security work against the project's own code — not a substitute for a
licensed third-party penetration test, which is still recommended (see
Section 6) before onboarding a paying customer.*

*Companion document: `/docs/MHTS-ERP_CA_Compliance_Test_Cases.md` (the
compliance-side counterpart to this security-side pack).*

---

## 1. Scope and method

Reviewed: authentication and key management (`core-identity`), the Electron
IPC boundary (`preload/index.ts`, `shared/ipc.ts`, `main/index.ts`), SQL
construction across every `*Handlers.ts` file, the audit-trail
tamper-resistance mechanism (`core-audit`, migration triggers), the
license/permission-check surface (`licenseHandlers.ts`, the per-handler RBAC
guard), and a full-repository + full-git-history secret scan.

---

## 2. Findings

### 2.1 Auth & key management — no issues found

- **Password hashing** (`packages/core-identity/src/password.ts`): `scrypt`
  (N=16384, r=8, p=1, 64-byte output, 16-byte random salt), self-describing
  stored format, constant-time comparison via `timingSafeEqual`. No bcrypt
  needed here; scrypt with these parameters is an accepted choice.
- **DEK wrap/unwrap** (`keyWrap.ts`): AES-256-GCM for both the per-user
  password path (KEK derived via the same scrypt parameters) and the
  recovery-key path (already-random 256 bits used directly, no KDF needed).
  Both paths verified to fail closed (GCM auth-tag mismatch throws, never
  returns garbage) — this is now also covered by a persisted automated test
  (`packages/core-identity/src/keyWrap.test.ts`).
- **System DB key**: Electron's OS-keychain-backed `safeStorage`, refuses to
  start rather than falling back to a plaintext key if
  `safeStorage.isEncryptionAvailable()` is false — correct fail-closed
  behavior. (Cross-platform caveat already tracked in the Phase Tracker's
  Open Questions: headless Linux without a keyring daemon needs revisiting
  before that platform ships.)

### 2.2 IPC boundary — no issues found

- `contextIsolation: true`, `nodeIntegration: false` on the `BrowserWindow`.
- The preload script exposes a single flat `window.mhts` object via
  `contextBridge`, where every method is a typed wrapper around
  `ipcRenderer.invoke(IPC.<CHANNEL>, ...)` against a fixed channel constant —
  there is no generic/passthrough `invoke(channel, ...)` a compromised
  renderer script could use to call an arbitrary channel.
- `sandbox: false` on the `BrowserWindow` is present but undocumented as a
  deliberate choice — **flagged, not fixed** (see Section 3).

### 2.3 SQL injection — no issues found

Every data-access call site uses Kysely's parameterized query builder. A
full-repo grep for `` sql`...` `` template-literal usage (the one way raw SQL
enters this codebase) found exactly one hit outside migration files
(`backupHandlers.ts`'s `` sql`SELECT 1` `` — a hardcoded literal probe query,
no interpolated variables, not exploitable). No handler takes a raw SQL
fragment from the renderer.

### 2.4 Audit trail tamper-resistance — one real gap, now closed

Rule #5 ("no UI path may hard-delete or edit an audit log record") had a
tamper-**prevention** mechanism (the DB's `BEFORE UPDATE`/`BEFORE DELETE`
triggers on `audit_log`, `company/migrations/001_init.ts`) but no
tamper-**detection** mechanism — nothing actually walked the hash chain to
confirm it was intact, and the triggers only block UPDATE/DELETE, not a
crafted direct INSERT with a fabricated hash (which a bad actor with raw
filesystem access to the encrypted DB could in principle attempt).

**Fixed this session**: `verifyAuditChain()` (new,
`packages/core-audit/src/verifyAuditChain.ts`) walks the entire log in
insertion order, recomputes each row's hash exactly as `writeAuditLog`
originally computed it, and reports the first break — covered by 5 automated
tests (`verifyAuditChain.test.ts`), including one that directly confirms
detection of a crafted INSERT with a forged `hash`/`prev_hash`. Wired into
the app as a real, reachable action: a new `SYSTEM.VIEW_AUDIT_LOG`-gated
"Verify audit trail" button on the dashboard (IPC channel
`system:verifyAuditTrail`).

A full-repo grep confirmed `writeAuditLog` is the *only* code path that ever
inserts into `audit_log` — no handler anywhere bypasses it.

### 2.5 License/permission bypass surface — one maintainability gap, now closed

- **License verification** (`licenseHandlers.ts`): Ed25519 signature check,
  then machine-binding check (`license_activation` table) — refuses on
  mismatch, fails closed.
- **RBAC guard**: every one of 14 `*Handlers.ts` files independently declared
  a byte-for-byte identical `requireSessionWithCompanyDb(permission)`
  function. All 14 copies behaved identically (verified before touching
  anything) — this was **not a live vulnerability**, but a real
  maintainability/consistency risk: nothing prevented a future handler file
  from defining its own guard slightly differently, or forgetting to call it
  at all, since there was no single compile-time source of truth.
  **Fixed this session**: consolidated into one exported function in
  `apps/desktop-shell/src/main/session.ts`; every handler file now imports
  it instead of declaring its own copy. Re-verified: full workspace build +
  lint clean, `tsc --noEmit` shows the same 2 pre-existing (unrelated,
  already-documented) Manufacturing-era errors and nothing new.
- **Demo-mode password bypass** (`demoHandlers.ts`'s
  `createDemoCompanyAndLogin`, added Phase 10): deliberately skips password
  verification, calling `establishSession` directly with a freshly-generated
  DEK. Confirmed: the only renderer-reachable entry point
  (`IPC.CREATE_DEMO_COMPANY`) takes no arguments, so it cannot be repurposed
  to hijack an existing company's session — every call generates a brand-new
  company/DEK/user and deletes any prior demo first. **Residual, low-severity
  nuisance vector** (see Section 3): the channel has no rate limit, so a
  compromised renderer could repeatedly wipe/recreate the demo company — a
  DoS against demo data only, not a confidentiality break against real
  company data.

### 2.6 Secrets in repo — no issues found

- `git ls-files` (current tree) and `git log --all -p` (full history) for
  `.env`, `.pem`, `.key`, and private-key PEM headers (`BEGIN ... PRIVATE
  KEY`) both returned zero matches.
- The Ed25519 **public** key is correctly committed in `core-licensing`
  (expected — it's meant to be distributed with the verifier).
  `scripts/generate-license.mjs` (vendor-only tooling, never bundled into the
  shipped app) reads the **private** key from a CLI argument, never embeds
  or writes it.

---

## 3. Findings NOT fixed this session (documented, not auto-fixed)

These are real, but either a deliberate tradeoff worth the project owner's
own confirmation, or low-severity enough that fixing them shouldn't happen
silently inside a broader session:

| Finding | Severity | Recommendation |
|---|---|---|
| `sandbox: false` on the `BrowserWindow` is present but not documented as a deliberate choice. Electron's OS-level renderer sandbox is an additional confinement layer beyond `contextIsolation`. | Low–Medium | Confirm whether this was set for a specific reason (e.g. a native-module/preload requirement) and document it, or test whether `sandbox: true` still works and switch. |
| The demo-mode `CREATE_DEMO_COMPANY` channel has no rate limiting. | Low | A minor hardening pass (debounce/cooldown) if this ever becomes an actual reported nuisance — not urgent given it only affects disposable demo data. |
| The trial clock (`trial_activation` table) is not tied to any hardware fingerprint — deleting just the system DB file (not reinstalling) restarts the 14-day trial. Already flagged in the Phase Tracker's Open Questions since Phase 10. | Low (business, not security) | Same class of limitation almost all desktop trial software has; not worth hardening unless it becomes a real revenue-impacting pattern. |
| The raw-JSON rate-editor gap (TDS/GST/Payroll/Fixed-Assets/Exchange-Rates admin screens each reinvent rate editing, GST's is the only one with a proper form) is a UX/consistency issue flagged repeatedly since Phase 2 — not itself a security bug, but a wrong rate entered via a raw JSON textarea has real financial-correctness consequences. | N/A (correctness, not security) | Worth a dedicated generic-rate-editor pass, out of scope for this security review. |
| `apps/desktop-shell/src/main/licenseHandlers.ts` and the other 13 handler files were only spot-checked for the *guard-call pattern itself*, not every single exported function's actual permission-code correctness (i.e. that each handler asks for the *right* permission, not just *a* permission). | N/A (scope note) | A dedicated line-by-line permission-code audit across all ~14 handler files, matching each handler to its intended permission, would be a good follow-up — this review confirmed the *mechanism* is sound and consistent, not that every individual permission string is the intentionally correct one. |

---

## 4. What this review does NOT cover

- **Electron/Chromium/Node CVEs** in the pinned dependency versions — a
  standard `npm audit`/Dependabot-style scan is a separate, ongoing exercise,
  not a one-time code review.
- **Physical/OS-level attacks** (an attacker with admin access to the machine
  itself, cold-boot memory attacks, etc.) — out of scope for an offline
  desktop app's threat model at this stage.
- **Social engineering / phishing** against end users.
- **The installer/update pipeline's supply-chain integrity** (e.g. what
  happens if `GH_TOKEN`-based release publishing is ever compromised) — flag
  for a future review once real releases are being published (currently
  blocked on a `GH_TOKEN`, per Phase 10's own Open Questions).

---

## 5. Verification

- Full workspace `nx run-many -t build -t lint -t test` clean after every
  change in this section.
- `tsc --noEmit` on both `apps/desktop-shell` tsconfigs: identical to the
  pre-existing baseline (2 already-documented Manufacturing-era enum-widening
  errors, unrelated to this review, nothing new).
- `verifyAuditChain` has 5 dedicated automated tests
  (`packages/core-audit/src/verifyAuditChain.test.ts`), including empty-log,
  a real multi-entry chain, and two tamper-simulation cases (a forged hash, a
  broken prev_hash link).
- The consolidated `requireSessionWithCompanyDb` guard was verified
  byte-for-byte identical across all 14 original copies *before* consolidating
  them, so this change is a pure de-duplication with no behavior change.

---

## 6. Recommendation

This pass found the security posture genuinely sound in the areas it
covered: no SQL injection surface, no committed secrets (current tree or
history), fail-closed cryptography throughout, and a minimal/typed IPC
boundary with no passthrough channel. The one real gap (audit-chain
detection) and one real risk (guard duplication) are both fixed and tested
in this same session.

**Before onboarding a first paying customer**, still get: (1) a licensed
third-party penetration test — this review is real but is one person's
code-level pass, not an adversarial external test; (2) a decision on
`sandbox: false` (Section 3); (3) the code-signing certificate already
flagged in Phase 10's Open Questions (an unsigned installer is itself a
trust/security-perception issue, separate from the code-level findings
here).
