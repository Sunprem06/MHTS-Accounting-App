import { Kysely, sql } from 'kysely';

/**
 * Phase 7 (Payroll).
 *
 * `employee` (migration 011) is extended, not duplicated — the payroll
 * profile is more data about the same person Phase 6 already anchored, not a
 * new identity concept (resolves the gap Phase 6's handoff explicitly
 * flagged: "revisit once Phase 7's employee model exists"). A SECOND
 * dedicated ledger (`salary_payable_ledger_id`) is added rather than reusing
 * Phase 6's `ledger_account_id` — that one stays scoped to expense
 * reimbursements under "Employee Reimbursements Payable"; net salary payable
 * is a different economic obligation and gets its own ledger under a new
 * group (see core-payroll-engine's seedPayrollLedgers), so the two balances
 * never blend on one account.
 *
 * `salary_component_definition`/`salary_structure`/`salary_structure_line`
 * model the CTC breakup engine (Blueprint §3.2). `salary_structure` is
 * append-only/supersede-on-change, same discipline as `rule_set` itself — a
 * raise is a new row, never an edit of history.
 *
 * `company_payroll_settings` is a singleton (one row) holding the
 * applicability overrides (PF/ESI/Gratuity each AUTO/ALWAYS/NEVER — AUTO
 * compares live headcount against the RuleSet-configured threshold) and the
 * TDS regime choice — see core-payroll-engine's applicability.ts.
 *
 * `attendance_record`/`leave_type`/`leave_balance`/`leave_application` are
 * the attendance/leave subsystem; an approved leave within balance marks the
 * day ON_LEAVE (paid), anything else uncovered on a working day is
 * Loss-of-Pay, feeding payslip proration.
 *
 * `payroll_run`/`payslip`/`payslip_line`/`payslip_settlement` mirror the
 * accrual-then-settlement shape already established by
 * `expense_claim`/`expense_claim_settlement` (migration 011): PROCESSED
 * posts one balanced 'PAYROLL' voucher for the whole run; disbursement is a
 * separate 'PAYMENT' voucher settling each payslip via `payslip_settlement`.
 *
 * `gratuity_provision_run`/`gratuity_provision_line`/`gratuity_record` are
 * the gratuity subsystem — monthly formula-based provisioning (NOT an
 * actuarial AS-15/Ind AS-19 valuation — flagged in the UI) plus a
 * separation-time eligibility/formula calculator and settlement.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('employee').addColumn('date_of_birth', 'text').execute();
  await db.schema.alterTable('employee').addColumn('date_of_joining', 'text').execute();
  await db.schema.alterTable('employee').addColumn('date_of_leaving', 'text').execute();
  /** 'PERMANENT' | 'FIXED_TERM' | 'CONTRACTUAL' | 'CONSULTANT' — drives the gratuity 1yr-vs-5yr eligibility rule. Null until set. */
  await db.schema.alterTable('employee').addColumn('employment_type', 'text').execute();
  await db.schema.alterTable('employee').addColumn('pan', 'text').execute();
  await db.schema.alterTable('employee').addColumn('bank_account_number', 'text').execute();
  await db.schema.alterTable('employee').addColumn('bank_ifsc', 'text').execute();
  await db.schema.alterTable('employee').addColumn('uan', 'text').execute();
  await db.schema.alterTable('employee').addColumn('esi_number', 'text').execute();
  await db.schema.alterTable('employee').addColumn('pf_voluntary_opt_out', 'integer', (col) => col.notNull().defaultTo(0)).execute();
  /** Second, distinct ledger from ledger_account_id — see module doc comment above. Null until a salary structure is first assigned. */
  await db.schema.alterTable('employee').addColumn('salary_payable_ledger_id', 'text', (col) => col.references('ledger_account.id')).execute();

  await db.schema
    .createTable('company_payroll_settings')
    .addColumn('id', 'text', (col) => col.primaryKey())
    /** 'AUTO' | 'ALWAYS' | 'NEVER'. AUTO compares live headcount against the RuleSet threshold; flips to ALWAYS automatically once gratuity's sticky-applicability rule is triggered. */
    .addColumn('pf_applicability', 'text', (col) => col.notNull().defaultTo('AUTO'))
    .addColumn('esi_applicability', 'text', (col) => col.notNull().defaultTo('AUTO'))
    .addColumn('gratuity_applicability', 'text', (col) => col.notNull().defaultTo('AUTO'))
    .addColumn('pt_jurisdiction', 'text')
    /** 'NEW' | 'OLD'. Old regime gets no slab auto-computation — see core-payroll-engine/salaryTds.ts. */
    .addColumn('tds_regime', 'text', (col) => col.notNull().defaultTo('NEW'))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('salary_component_definition')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    /** 'EARNING' | 'DEDUCTION'. */
    .addColumn('component_type', 'text', (col) => col.notNull())
    /** 'FLAT' | 'PCT_OF_BASIC' | 'PCT_OF_CTC'. Exactly one of flat_amount_paise/percent_basis_points is set, matching this. */
    .addColumn('calculation_type', 'text', (col) => col.notNull())
    .addColumn('flat_amount_paise', 'integer')
    /** e.g. 4000 = 40.00%. */
    .addColumn('percent_basis_points', 'integer')
    /** Whether this component counts as "wages" under the Labour Code's unified definition, before the 50%-allowance-cap reclassification runs (core-payroll-engine/wageClassification.ts). */
    .addColumn('is_statutory_wage_base', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('display_order', 'integer', (col) => col.notNull().defaultTo(0))
    /** Null defaults to the shared "Salaries & Wages" ledger — avoids a ledger-per-component explosion, same simplification precedent GST used for HSN codes. */
    .addColumn('expense_ledger_id', 'text', (col) => col.references('ledger_account.id'))
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable('salary_structure')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('employee_id', 'text', (col) => col.notNull().references('employee.id'))
    .addColumn('effective_from', 'text', (col) => col.notNull())
    .addColumn('effective_to', 'text')
    .addColumn('annual_ctc', 'integer', (col) => col.notNull())
    /** 'ACTIVE' | 'SUPERSEDED' — a raise is a new row, never an edit of history (same discipline as rule_set). */
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('ACTIVE'))
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
  await db.schema.createIndex('salary_structure_employee_idx').on('salary_structure').column('employee_id').execute();

  await db.schema
    .createTable('salary_structure_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('salary_structure_id', 'text', (col) => col.notNull().references('salary_structure.id'))
    .addColumn('component_id', 'text', (col) => col.notNull().references('salary_component_definition.id'))
    /** Paise. The resolved monthly amount — frozen at structure-creation time, not recomputed from the component's percent formula later. */
    .addColumn('monthly_amount', 'integer', (col) => col.notNull())
    .execute();
  await db.schema.createIndex('salary_structure_line_structure_idx').on('salary_structure_line').column('salary_structure_id').execute();

  await db.schema
    .createTable('leave_type')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('is_paid', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('annual_entitlement_days', 'integer', (col) => col.notNull())
    .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
    .execute();

  await db.schema
    .createTable('leave_application')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('employee_id', 'text', (col) => col.notNull().references('employee.id'))
    .addColumn('leave_type_id', 'text', (col) => col.notNull().references('leave_type.id'))
    .addColumn('from_date', 'text', (col) => col.notNull())
    .addColumn('to_date', 'text', (col) => col.notNull())
    .addColumn('days', 'integer', (col) => col.notNull())
    /** 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'. */
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('PENDING'))
    .addColumn('reason', 'text')
    .addColumn('approved_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
  await db.schema.createIndex('leave_application_employee_idx').on('leave_application').column('employee_id').execute();

  await db.schema
    .createTable('leave_balance')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('employee_id', 'text', (col) => col.notNull().references('employee.id'))
    .addColumn('leave_type_id', 'text', (col) => col.notNull().references('leave_type.id'))
    .addColumn('financial_year', 'text', (col) => col.notNull())
    .addColumn('opening_balance_days', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('accrued_days', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('availed_days', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
  await db.schema.createIndex('leave_balance_unique_idx').on('leave_balance').columns(['employee_id', 'leave_type_id', 'financial_year']).unique().execute();

  await db.schema
    .createTable('attendance_record')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('employee_id', 'text', (col) => col.notNull().references('employee.id'))
    .addColumn('attendance_date', 'text', (col) => col.notNull())
    /** 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKLY_OFF'. Only ON_LEAVE (within an approved, balance-covered application) and HOLIDAY/WEEKLY_OFF are treated as paid non-working days; ABSENT/HALF_DAY reduce the payslip via LOP. */
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('leave_application_id', 'text', (col) => col.references('leave_application.id'))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
  await db.schema.createIndex('attendance_record_unique_idx').on('attendance_record').columns(['employee_id', 'attendance_date']).unique().execute();

  await db.schema
    .createTable('payroll_run')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('financial_year', 'text', (col) => col.notNull())
    .addColumn('period_month', 'integer', (col) => col.notNull())
    .addColumn('period_year', 'integer', (col) => col.notNull())
    /** 'DRAFT' | 'PROCESSED' | 'POSTED' | 'CANCELLED'. PROCESSED computes payslips (no GL impact yet); POSTED posts the one balanced 'PAYROLL' voucher for the whole run. */
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('DRAFT'))
    .addColumn('voucher_id', 'text', (col) => col.references('voucher.id'))
    .addColumn('processed_at', 'text')
    .addColumn('posted_at', 'text')
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
  await db.schema.createIndex('payroll_run_period_unique_idx').on('payroll_run').columns(['period_year', 'period_month']).unique().execute();

  await db.schema
    .createTable('payslip')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('payroll_run_id', 'text', (col) => col.notNull().references('payroll_run.id'))
    .addColumn('employee_id', 'text', (col) => col.notNull().references('employee.id'))
    /** Tenths of a day (e.g. 305 = 30.5 days) — a HALF_DAY attendance status contributes a fractional day, and money is never stored as REAL/float, so day-counts that feed a paise computation use the same fixed-point convention core-inventory uses for quantities (thousandths of a unit). */
    .addColumn('paid_days', 'integer', (col) => col.notNull())
    .addColumn('lop_days', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('gross_earnings', 'integer', (col) => col.notNull())
    .addColumn('total_deductions', 'integer', (col) => col.notNull())
    /** Paise. Informational only — employer PF/ESI contributions are a company cost, not deducted from the employee's net pay. */
    .addColumn('employer_contributions', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('net_pay', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
  await db.schema.createIndex('payslip_unique_idx').on('payslip').columns(['payroll_run_id', 'employee_id']).unique().execute();

  await db.schema
    .createTable('payslip_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('payslip_id', 'text', (col) => col.notNull().references('payslip.id'))
    /** 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION'. */
    .addColumn('line_type', 'text', (col) => col.notNull())
    .addColumn('label', 'text', (col) => col.notNull())
    .addColumn('component_id', 'text', (col) => col.references('salary_component_definition.id'))
    .addColumn('amount', 'integer', (col) => col.notNull())
    .execute();
  await db.schema.createIndex('payslip_line_payslip_idx').on('payslip_line').column('payslip_id').execute();

  await db.schema
    .createTable('payslip_settlement')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('payslip_id', 'text', (col) => col.notNull().references('payslip.id'))
    /** The PAYMENT voucher disbursing this amount to the employee. */
    .addColumn('voucher_id', 'text', (col) => col.notNull().references('voucher.id'))
    .addColumn('amount_applied', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
  await db.schema.createIndex('payslip_settlement_payslip_idx').on('payslip_settlement').column('payslip_id').execute();

  await db.schema
    .createTable('gratuity_provision_run')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('period_year', 'integer', (col) => col.notNull())
    .addColumn('period_month', 'integer', (col) => col.notNull())
    .addColumn('voucher_id', 'text', (col) => col.references('voucher.id'))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
  await db.schema.createIndex('gratuity_provision_run_period_unique_idx').on('gratuity_provision_run').columns(['period_year', 'period_month']).unique().execute();

  await db.schema
    .createTable('gratuity_provision_line')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('gratuity_provision_run_id', 'text', (col) => col.notNull().references('gratuity_provision_run.id'))
    .addColumn('employee_id', 'text', (col) => col.notNull().references('employee.id'))
    .addColumn('days_of_service_snapshot', 'integer', (col) => col.notNull())
    .addColumn('provisioned_amount', 'integer', (col) => col.notNull())
    .addColumn('cumulative_provision_after', 'integer', (col) => col.notNull())
    .execute();
  await db.schema.createIndex('gratuity_provision_line_run_idx').on('gratuity_provision_line').column('gratuity_provision_run_id').execute();

  await db.schema
    .createTable('gratuity_record')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('employee_id', 'text', (col) => col.notNull().unique().references('employee.id'))
    .addColumn('separation_date', 'text', (col) => col.notNull())
    .addColumn('is_eligible', 'integer', (col) => col.notNull())
    .addColumn('eligibility_reason', 'text', (col) => col.notNull())
    .addColumn('years_of_service_days', 'integer', (col) => col.notNull())
    /** Paise. Formula estimate (15/26 x last-drawn wage-base x years of service) — NOT an actuarial AS-15/Ind AS-19 valuation. */
    .addColumn('formula_amount', 'integer', (col) => col.notNull())
    .addColumn('cumulative_provision_at_separation', 'integer', (col) => col.notNull())
    /** Paise. Positive = top-up (Dr Gratuity Expense, Cr Gratuity Provision) booked before settlement; negative = release of excess provision. */
    .addColumn('adjustment_amount', 'integer', (col) => col.notNull())
    .addColumn('adjustment_voucher_id', 'text', (col) => col.references('voucher.id'))
    .addColumn('settlement_voucher_id', 'text', (col) => col.references('voucher.id'))
    /** 'DRAFT' | 'SETTLED'. */
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('DRAFT'))
    .addColumn('created_by', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('gratuity_record').execute();
  await db.schema.dropTable('gratuity_provision_line').execute();
  await db.schema.dropTable('gratuity_provision_run').execute();
  await db.schema.dropTable('payslip_settlement').execute();
  await db.schema.dropTable('payslip_line').execute();
  await db.schema.dropTable('payslip').execute();
  await db.schema.dropTable('payroll_run').execute();
  await db.schema.dropTable('attendance_record').execute();
  await db.schema.dropTable('leave_balance').execute();
  await db.schema.dropTable('leave_application').execute();
  await db.schema.dropTable('leave_type').execute();
  await db.schema.dropTable('salary_structure_line').execute();
  await db.schema.dropTable('salary_structure').execute();
  await db.schema.dropTable('salary_component_definition').execute();
  await db.schema.dropTable('company_payroll_settings').execute();

  await db.schema.alterTable('employee').dropColumn('salary_payable_ledger_id').execute();
  await db.schema.alterTable('employee').dropColumn('pf_voluntary_opt_out').execute();
  await db.schema.alterTable('employee').dropColumn('esi_number').execute();
  await db.schema.alterTable('employee').dropColumn('uan').execute();
  await db.schema.alterTable('employee').dropColumn('bank_ifsc').execute();
  await db.schema.alterTable('employee').dropColumn('bank_account_number').execute();
  await db.schema.alterTable('employee').dropColumn('pan').execute();
  await db.schema.alterTable('employee').dropColumn('employment_type').execute();
  await db.schema.alterTable('employee').dropColumn('date_of_leaving').execute();
  await db.schema.alterTable('employee').dropColumn('date_of_joining').execute();
  await db.schema.alterTable('employee').dropColumn('date_of_birth').execute();
}
