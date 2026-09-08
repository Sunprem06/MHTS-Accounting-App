# MHTS ERP — CA Compliance Test Case Pack

*Prepared for Phase 11 (UAT, Security & Compliance Sign-off). Purpose: give a
Chartered Accountant a concrete, checkable list of what the GST and payroll
engines actually compute, how each figure was verified, and every known
simplification that needs your explicit confirmation before this app is used
for a real filing. This document does not replace your professional review —
it is the starting point for it.*

*Companion documents: `/docs/MHTS-ERP_Master_Blueprint.md` (full spec),
`/docs/MHTS-ERP_Phase_Tracker.md` (build history and the authoritative Open
Questions list this pack draws from), `/docs/MHTS-ERP_Phase11_Security_Review.md`
(the security-side companion to this compliance-side pack).*

---

## 1. How to read this document

- **Section 2 (GST)** and **Section 3 (Payroll)** each list the real
  computations the app performs, followed by a table of specific test
  scenarios. Each scenario is marked:
  - ✅ **Automated** — a real, committed, re-runnable test exists (file:line
    given) that will fail loudly if this behavior ever regresses.
  - 📋 **Manually verified, not yet automated** — this exact scenario was
    checked by hand against real data during the phase that built it (see the
    cited Phase Tracker session), but there is no persisted test guarding it
    yet. Still real verification, just not regression-protected.
- **Section 4** is the actual sign-off checklist — every simplification this
  codebase makes, in one place, each needing your initial/date once you've
  confirmed it's acceptable (or flagged what needs to change before go-live).
- **Section 5** tells you how to see real numbers yourself: the app's
  built-in Demo Mode company, not a hypothetical example.

---

## 2. GST Engine

### What it computes
- **Rate resolution** (`packages/core-gst-engine/src/gstRates.ts`): HSN/SAC →
  GST rate, versioned and date-effective (never a hardcoded constant — a rate
  change is a new dated row, and an old invoice keeps resolving to the rate
  that was actually in force on its own date).
- **Place-of-supply split** (`gstSplit.ts`): same state → CGST+SGST 50/50;
  different state → full rate as IGST. Cess is always a separate line.
- **Set-off** (`gstSetOff.ts`): standard textbook utilization order (IGST →
  IGST/CGST/SGST liability, then CGST → CGST/IGST, then SGST → SGST/IGST,
  cess isolated) — **not** the fully cash-optimal algorithm the law permits
  some discretion for (see Section 4).
- **ITC eligibility, RCM, composition scheme** (`core-sales-purchase`'s
  invoice posting + `core-gst-engine`): per-line eligibility flag, blocked
  credit folds into cost instead of an Input ledger; reverse-charge purchases
  self-assess Input/RCM-Liability excluded from the vendor's payable;
  composition-scheme companies get zero output tax and zero ITC by
  construction.
- **GSTR-1/3B/9/9C prep** (`core-sales-purchase/src/gstReturns.ts`):
  CA-facing reference reports (on-screen + CSV export via the GST Returns
  screen) — **explicitly not** the GST portal's upload-ready JSON schema.

### Test scenarios

| # | Scenario | Status | Reference |
|---|---|---|---|
| G1 | Rate-change simulation — an old invoice keeps its old rate, a new invoice picks up the new rate, zero code change | ✅ Automated | `packages/core-rules-engine/src/ruleSet.test.ts` — *"rate-change simulation"* |
| G2 | Intra-state split (CGST+SGST, rounding absorbed so the two halves always sum to the exact total) | ✅ Automated | `packages/core-gst-engine/src/gstSplit.test.ts` |
| G3 | Inter-state split (full rate as IGST) | ✅ Automated | `packages/core-gst-engine/src/gstSplit.test.ts` |
| G4 | Cess applies as its own line, both intra- and inter-state | ✅ Automated | `packages/core-gst-engine/src/gstSplit.test.ts` |
| G5 | Current GST 2.0 slabs (5/18/40%, 3% gold-silver) compute correctly | ✅ Automated | `packages/core-gst-engine/src/gstSplit.test.ts` |
| G6 | Set-off: IGST credit exhausts IGST liability first, then spills to CGST, then SGST | ✅ Automated | `packages/core-gst-engine/src/gstSetOff.test.ts` |
| G7 | Set-off: CGST/SGST credit never cross-utilizes with each other, only spills to IGST | ✅ Automated | `packages/core-gst-engine/src/gstSetOff.test.ts` |
| G8 | Set-off: cess never cross-utilizes with CGST/SGST/IGST | ✅ Automated | `packages/core-gst-engine/src/gstSetOff.test.ts` |
| G9 | ITC eligible vs. blocked-credit routing | 📋 Manually verified | Phase Tracker, Phase 4 Increment 2 session (2026-09-06) — 27-check verification pass |
| G10 | RCM purchase (Input+RCM-Payable pair, excluded from vendor payable) and RCM sale (zero output tax) | 📋 Manually verified | same session as G9 |
| G11 | Composition sale (zero tax, HSN still recorded) and composition purchase (forced ITC-ineligible) | 📋 Manually verified | same session as G9 |
| G12 | GSTR-1 B2B/B2C classification + HSN-summary aggregation | 📋 Manually verified | same session as G9 |
| G13 | GSTR-3B net payable cross-checked against an independent `computeGstSetOff` call | 📋 Manually verified | same session as G9 |
| G14 | GSTR-9 full-year aggregation cross-checked against a wide-range GSTR-3B call | 📋 Manually verified | same session as G9 |
| G15 | Cancellation reverses output+input GST to exactly zero | 📋 Manually verified | same session as G9 |
| G16 | Vendor TDS (194C/194J/194Q/194I) threshold-aware computation: under threshold (₹0), the invoice that crosses it (partial), every invoice after (full rate) | ✅ Automated | `packages/core-sales-purchase/src/tds.test.ts` |

---

## 3. Payroll Engine

### What it computes
- **Wage-cap reclassification** (`wageClassification.ts`): the Nov-2025
  Labour Codes' unified wages definition — allowances above X% (RuleSet-driven,
  default 50%) of total pay get reclassified into the statutory wage base
  used for PF/ESI/gratuity.
- **PF** (`pf.ts`): 12%/12% (EE/ER, RuleSet default), capped at a wage
  ceiling — contributes on the wage base up to the ceiling, never above it.
- **ESI** (`esi.ts`): 0.75%/3.25% (RuleSet default), an **all-or-nothing**
  gross-wage-ceiling gate — above the ceiling, an employee is entirely
  outside the scheme for that month, not capped-and-contributing.
- **Professional Tax** (`pt.ts`): slab-based, state-jurisdiction-keyed, no
  national default (an unconfigured state correctly resolves to ₹0).
- **Salary TDS, new regime only** (`salaryTds.ts`): progressive slabs (FY
  2025-26 defaults) with Section 87A rebate and 4% cess. **Old regime is
  deliberately not computed** — see Section 4.
- **Headcount-driven applicability** (`applicability.ts`): PF needs 20+
  employees, ESI/Gratuity need 10+, each independently
  AUTO/ALWAYS/NEVER-configurable; gratuity's AUTO mode is **sticky** (once
  crossed, stays applicable even if headcount later drops).
- **Gratuity** (`gratuity.ts`): formula-based (15/26 × last-drawn monthly
  wage × rounded years of service, "part thereof in excess of six months"
  rounds up) — **not** an actuarial AS-15/Ind AS-19 valuation. Permanent
  employees need 5 years, fixed-term need 1 year (Nov-2025 Labour Code
  provision); consultants are never eligible.

### Test scenarios

| # | Scenario | Status | Reference |
|---|---|---|---|
| P1 | The literal Section 3.2 wage-cap test: allowances above the cap reclassify, allowances within the cap don't | ✅ Automated | `packages/core-payroll-engine/src/wageClassification.test.ts` |
| P2 | Wage-cap rate-change simulation (changing the cap % changes the result, zero code change) | ✅ Automated | `packages/core-payroll-engine/src/wageClassification.test.ts` |
| P3 | PF: contributes on actual wage below the ceiling, capped exactly at the ceiling above it | ✅ Automated | `packages/core-payroll-engine/src/statutoryDeductions.test.ts` |
| P4 | ESI: all-or-nothing gate (applicable below/at the ceiling, entirely inapplicable above it) | ✅ Automated | `packages/core-payroll-engine/src/statutoryDeductions.test.ts` |
| P5 | PT: unconfigured state resolves to ₹0; slab selection is order-independent | ✅ Automated | `packages/core-payroll-engine/src/statutoryDeductions.test.ts` |
| P6 | New-regime TDS: Section 87A rebate below/at threshold, full worked progressive-slab example above it, matched to hand-computed tax + cess | ✅ Automated | `packages/core-payroll-engine/src/statutoryDeductions.test.ts` |
| P7 | Headcount thresholds: 1/10/20 employees each cross a different scheme's applicability boundary | ✅ Automated | `packages/core-payroll-engine/src/applicability.test.ts` |
| P8 | Sticky gratuity: crossing 10 employees then dropping back below still leaves gratuity applicable, while ESI (no sticky rule) correctly turns back off | ✅ Automated | `packages/core-payroll-engine/src/applicability.test.ts` |
| P9 | Explicit ALWAYS/NEVER settings override headcount-driven AUTO | ✅ Automated | `packages/core-payroll-engine/src/applicability.test.ts` |
| P10 | Gratuity eligibility: fixed-term (1yr) vs. permanent (5yr) at the identical 400-day tenure — one eligible, one not | ✅ Automated | `packages/core-payroll-engine/src/gratuity.test.ts` |
| P11 | Gratuity's "part thereof in excess of six months" rounding rule (4yr7mo rounds up to 5, 4yr5mo does not) | ✅ Automated | `packages/core-payroll-engine/src/gratuity.test.ts` |
| P12 | Consultants never eligible for gratuity regardless of tenure | ✅ Automated | `packages/core-payroll-engine/src/gratuity.test.ts` |
| P13 | Monthly gratuity provisioning increment never goes negative (over-provisioning clamps to zero) | ✅ Automated | `packages/core-payroll-engine/src/gratuity.test.ts` |
| P14 | A real two-employee payroll run with PF/ESI/PT/TDS all live, voucher Dr/Cr totals matched to the paise | 📋 Manually verified | Phase Tracker, Phase 7 session (2026-09-07) — 76-check verification pass |
| P15 | Full gratuity lifecycle: provisioning run, zero-adjustment same-tenure separation, settlement, settlement correctly refused for an ineligible employee | 📋 Manually verified | same session as P14 |
| P16 | Salary-structure revision is append-only (old row SUPERSEDED, new row ACTIVE) | 📋 Manually verified | same session as P14 |

---

## 4. Known Simplifications Requiring CA Confirmation

Every row below is a **deliberate, disclosed** scope choice, not an
oversight — each one is already logged in `/docs/MHTS-ERP_Phase_Tracker.md`'s
Open Questions section with the reasoning behind it. Please initial each row
to confirm you've reviewed it and it's acceptable for your client base, or
flag what needs to change.

| # | Simplification | Sign-off |
|---|---|---|
| S1 | GST: cess is a single flat rate per HSN/SAC — not the tiered/per-unit structure real compensation cess sometimes uses (e.g. a fixed rupee amount per cigarette). | ☐ |
| S2 | GST: a null company/party state code defaults to intra-state (CGST+SGST) — no export/SEZ zero-rating concept exists yet. | ☐ |
| S3 | GST: composition scheme is fixed at company creation with no in-app path to switch later (a real switch has its own statutory ITC-reversal/availing rules, not modeled). | ☐ |
| S4 | GST: no CMP-08 auto-posting for a composition dealer's own flat-rate quarterly liability — must be recorded manually via a plain Payment voucher. | ☐ |
| S5 | GST: `computeGstSetOff`'s utilization order is the standard textbook rule, not the fully cash-minimizing algorithm the law permits some discretion for. | ☐ |
| S6 | GST: GSTR-9's Part V (prior-year amendments declared in a later year's return) is not modeled — no return-period concept separate from invoice date. | ☐ |
| S7 | GST: GSTR-1/3B/9/9C are CA-facing reference reports (CSV export), **not** the GST portal's exact upload-ready JSON schema. | ☐ |
| S8 | Vendor TDS: 194Q's buyer-turnover eligibility gate (>₹10cr preceding-year turnover) is not enforced — the app will let a company apply 194Q regardless of actual eligibility. | ☐ |
| S9 | Vendor TDS: Section 43B(h) MSME due date always assumes the 45-day cap, never the 15-day fallback that applies when no written supplier agreement exists. | ☐ |
| S10 | Vendor TDS: no Form 26Q/16A generation — `tds_section`/`tds_amount` are captured but the quarterly return/certificate isn't built. | ☐ |
| S11 | Payroll: old tax regime is **not computed** at all (no HRA/80C/80D/home-loan data collected) — deliberately manual-entry-only rather than an actively misleading invented figure. | ☐ |
| S12 | Payroll: TDS regime is a company-wide setting, not per-employee (real law allows each employee their own annual choice). | ☐ |
| S13 | Payroll: gratuity is a formula estimate (15/26 rule), not an actuarial AS-15/Ind AS-19 valuation. | ☐ |
| S14 | Payroll: no Form 16/Form 24Q generation, and no PF/ESI government e-filing (ECR/challan) integration — remittance to the actual portal is a manual step outside the app. | ☐ |
| S15 | Payroll: leave entitlement is a flat annual grant, not accrued month-by-month or pro-rated for a mid-year joiner. | ☐ |
| S16 | Payroll: no half-day leave applications (only attendance's own tenths-of-a-day LOP adjustment). | ☐ |

---

## 5. Seeing real numbers: use the built-in Demo Mode company

Rather than a fabricated example in this document, open the app and click
**"Try Demo"** on the company list screen — it builds a fresh company with 5
parties, 8 items (5 stockable + 3 service, real HSN/SAC codes), 2 purchase +
4 sales invoices, and a receipt + payment voucher, all posted through the
exact same code path a real user's click would take (see Phase Tracker's
Phase 10 Increment 3 detail for the full seeding design). From there:

- **GST Returns screen** → run GSTR-1/3B for the demo period, export the CSV,
  review actual computed figures against the scenarios in Section 2.
- **Payroll Runs screen** → create/process a run against demo employees (if
  seeded), export the CSV (Phase 11 addition — see Section 3), review actual
  figures against Section 3.
- **Trial Balance / P&L / Balance Sheet** → confirm the whole company still
  balances to the paisa with all of the above posted.

Every "Try Demo" click wipes and recreates a fresh demo company, so this is
safe to explore repeatedly without affecting any real company data.
