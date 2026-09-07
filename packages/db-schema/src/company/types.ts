import type { ColumnType, Generated } from 'kysely';

/**
 * Company DB: one encrypted SQLite file per company (Rule #3). Holds
 * company-scoped RBAC, this company's append-only audit trail, and (from
 * Phase 1) the accounting core: chart of accounts and vouchers. Amounts are
 * stored as integers in paise everywhere, never REAL/float.
 */

export interface RoleTable {
  id: string;
  name: string;
  is_system_role: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface PermissionTable {
  id: string;
  code: string;
  description: string | null;
}

export interface RolePermissionTable {
  role_id: string;
  permission_id: string;
}

export interface AuditLogTable {
  /** Autoincrement integer, not a uuid — ordering by primary key is what makes the hash chain meaningful. */
  id: Generated<number>;
  actor_user_id: string | null;
  /** AuditAction from @mhts/shared-types. */
  action: string;
  entity_type: string;
  entity_id: string;
  before_data: string | null;
  after_data: string | null;
  timestamp: ColumnType<string, string | undefined, never>;
  /** Hash of the previous row (null for the very first row) — chained for tamper evidence. */
  prev_hash: string | null;
  /** Hash of this row's own payload + prev_hash. Computed by the audit-writing service, not the DB. */
  hash: string;
}

export interface AccountGroupTable {
  id: string;
  name: string;
  parent_group_id: string | null;
  /** 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE' — see @mhts/core-accounting. */
  nature: string;
  is_system_group: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface LedgerAccountTable {
  id: string;
  name: string;
  group_id: string;
  /** Paise. */
  opening_balance: number;
  /** 'DEBIT' | 'CREDIT'. */
  opening_balance_side: string;
  is_system_ledger: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface VoucherTable {
  id: string;
  /** 'JOURNAL' | 'PAYMENT' | 'RECEIPT' | 'CONTRA' — see @mhts/core-accounting. */
  voucher_type: string;
  /** e.g. '2026-27'. */
  financial_year: string;
  voucher_number: number;
  voucher_date: string;
  narration: string | null;
  /** AppUser.id from the system DB — not a foreign key here (cross-file). */
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
  /** Set when this voucher has been cancelled — see cancelled_by_voucher_id. Cancellation is a reversal voucher, never a destructive edit. */
  cancelled_at: string | null;
  /** The reversal voucher that cancels this one, once cancelled_at is set. */
  cancelled_by_voucher_id: string | null;
  /** Set on a reversal voucher itself, pointing back at the voucher it reverses. */
  reverses_voucher_id: string | null;
}

export interface VoucherLineTable {
  id: string;
  voucher_id: string;
  ledger_id: string;
  /** Paise. Exactly one of debit_amount/credit_amount is non-zero per line. */
  debit_amount: number;
  credit_amount: number;
  line_narration: string | null;
  /** Phase 8 (Advanced ERP) — optional dimension tag, see @mhts/core-accounting's costCentres.ts. Null for any voucher line not tagged to a cost centre. */
  cost_centre_id: string | null;
  /** Phase 8 Increment 2 — optional dimension tag, see @mhts/core-accounting's branches.ts. Unlike cost_centre_id, valid on Contra lines too (a branch is a balance-sheet dimension, not just P&L). */
  branch_id: string | null;
  /** Phase 8 Increment 2 (multi-currency) — all three of foreign_currency/foreign_amount/exchange_rate_micros are set together or not at all. See @mhts/core-accounting's fx.ts. */
  foreign_currency: string | null;
  /** Minor units of foreign_currency (e.g. USD cents) — same "integer, never float" convention as paise. */
  foreign_amount: number | null;
  /** Base-currency units per 1 foreign unit, scaled x1,000,000 (e.g. 83.25 -> 83250000). */
  exchange_rate_micros: number | null;
}

export interface BusinessPartyTable {
  id: string;
  /** 'CUSTOMER' | 'SUPPLIER' | 'BOTH' — see @mhts/core-sales-purchase. */
  party_type: string;
  name: string;
  gstin: string | null;
  state_code: string | null;
  /** Section 43B(h) — Udyam-registered MSME vendors unpaid past 45 days are tax-disallowed. */
  is_msme_udyam_registered: ColumnType<boolean, boolean | number, boolean | number>;
  udyam_registration_number: string | null;
  credit_period_days: number | null;
  /** This party's own sub-ledger under Sundry Debtors/Sundry Creditors — its balance IS the party's outstanding amount. */
  ledger_account_id: string;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
  /** Phase 8 Increment 2 — this party's usual transaction currency. A UX default only (pre-fills invoice currency), never enforced. */
  default_currency: string | null;
}

export interface SalesInvoiceTable {
  id: string;
  party_id: string;
  invoice_date: string;
  narration: string | null;
  /** The invoice number IS voucher.voucher_number, joined via this id — never duplicated. */
  voucher_id: string;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
  /** Phase 8 Increment 2 (multi-currency). Null (or equal to the company's base currency) means an ordinary base-currency invoice — the existing, unchanged path. */
  currency: string | null;
  /** Base-currency units per 1 foreign unit x1,000,000. Set only when currency is a foreign currency. */
  exchange_rate_micros: number | null;
  /** Phase 8 Increment 2 (multi-branch) — which branch made this sale. Carried onto every line of the generated voucher. */
  branch_id: string | null;
}

export interface SalesInvoiceLineTable {
  id: string;
  sales_invoice_id: string;
  description: string;
  income_ledger_id: string;
  /** Paise. Taxable value — always base-currency, authoritative for GL regardless of invoice currency. */
  amount: number;
  /** Manual tax entry (pre-Phase-4). Mutually exclusive with hsn_sac_code — see core-sales-purchase's lineValidation. */
  tax_ledger_id: string | null;
  tax_amount: number;
  line_narration: string | null;
  /** Phase 4 (GST). Set only when this line's tax was auto-computed (never together with tax_ledger_id/tax_amount). */
  hsn_sac_code: string | null;
  /** Rate% * 100, e.g. 1800 for 18% — stored for audit/display only, the amount columns below are the source of truth. */
  gst_rate_basis_points: number | null;
  cess_rate_basis_points: number | null;
  /** Paise. Exactly one of cgst_amount/sgst_amount OR igst_amount is non-zero, per place-of-supply. */
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  /** Phase 4 increment 2 (RCM) — true means the buyer self-assesses; this line collects zero tax from the customer. */
  is_reverse_charge: ColumnType<boolean, boolean | number, boolean | number>;
  /** Phase 8 Increment 2 (multi-currency) — this line's taxable value in the invoice's own currency, for display only; `amount` (paise) is the authoritative base-currency figure it's derived from. Null for a base-currency invoice. */
  foreign_amount: number | null;
}

export interface PurchaseInvoiceTable {
  id: string;
  party_id: string;
  invoice_date: string;
  narration: string | null;
  voucher_id: string;
  /** Snapshot of business_party.is_msme_udyam_registered at creation time. */
  is_msme_vendor: ColumnType<boolean, boolean | number, boolean | number>;
  due_date: string;
  /** e.g. '194C'. Null if no TDS deducted. Rate resolved from rule_set (system DB), never hardcoded. */
  tds_section: string | null;
  tds_amount: number;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
  /** Phase 8 Increment 2 (multi-currency). Null (or equal to the company's base currency) means an ordinary base-currency invoice. */
  currency: string | null;
  exchange_rate_micros: number | null;
  /** Phase 8 Increment 2 (multi-branch). */
  branch_id: string | null;
}

export interface PurchaseInvoiceLineTable {
  id: string;
  purchase_invoice_id: string;
  description: string;
  expense_ledger_id: string;
  /** Paise. Taxable value — always base-currency, authoritative for GL regardless of invoice currency. */
  amount: number;
  tax_ledger_id: string | null;
  tax_amount: number;
  line_narration: string | null;
  /** Phase 4 (GST) — see SalesInvoiceLineTable's identical fields for the full explanation. */
  hsn_sac_code: string | null;
  gst_rate_basis_points: number | null;
  cess_rate_basis_points: number | null;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  /** Phase 4 increment 2 (ITC). Default true. False (Section 17(5) blocked credit, or the company itself is on the composition scheme) folds this line's GST into its own expense/stock ledger debit (cost) instead of an Input GST ledger. */
  itc_eligible: ColumnType<boolean, boolean | number, boolean | number>;
  itc_ineligibility_reason: string | null;
  /** Phase 4 increment 2 (RCM) — true means WE self-assess this purchase's GST; see core-sales-purchase's buildPurchaseVoucherLines. */
  is_reverse_charge: ColumnType<boolean, boolean | number, boolean | number>;
  /** Phase 8 Increment 2 (multi-currency) — this line's taxable value in the invoice's own currency, display only. Null for a base-currency invoice. */
  foreign_amount: number | null;
}

export interface SalesOrderTable {
  id: string;
  financial_year: string;
  order_number: number;
  party_id: string;
  order_date: string;
  /** 'DRAFT' | 'CONFIRMED' | 'CONVERTED' | 'CANCELLED'. */
  status: string;
  narration: string | null;
  converted_to_invoice_id: string | null;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SalesOrderLineTable {
  id: string;
  sales_order_id: string;
  description: string;
  income_ledger_id: string;
  amount: number;
  tax_ledger_id: string | null;
  tax_amount: number;
  line_narration: string | null;
  /** Phase 3 (Inventory) — nullable, all four set together or not at all. Carried into the invoice at conversion time. */
  item_id: string | null;
  warehouse_id: string | null;
  /** Thousandths of a unit. */
  quantity_thousandths: number | null;
  /** Paise, per whole unit. */
  rate_paise: number | null;
  /** Phase 4 (GST) — carried into the invoice at conversion time, same as the Phase 3 item fields above. */
  hsn_sac_code: string | null;
}

export interface PurchaseOrderTable {
  id: string;
  financial_year: string;
  order_number: number;
  party_id: string;
  order_date: string;
  status: string;
  narration: string | null;
  tds_section: string | null;
  converted_to_invoice_id: string | null;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface PurchaseOrderLineTable {
  id: string;
  purchase_order_id: string;
  description: string;
  expense_ledger_id: string;
  amount: number;
  tax_ledger_id: string | null;
  tax_amount: number;
  line_narration: string | null;
  /** Phase 3 (Inventory) — nullable, all four set together or not at all. Carried into the invoice at conversion time. */
  item_id: string | null;
  warehouse_id: string | null;
  /** Thousandths of a unit. */
  quantity_thousandths: number | null;
  /** Paise, per whole unit. */
  rate_paise: number | null;
  /** Phase 4 (GST) — carried into the invoice at conversion time, same as the Phase 3 item fields above. */
  hsn_sac_code: string | null;
}

export interface SalesInvoiceSettlementTable {
  id: string;
  sales_invoice_id: string;
  /** The Receipt voucher that applies this amount against the invoice. */
  voucher_id: string;
  /** Paise. Always > 0. The invoice's ORIGINAL booked base-currency value for the portion settled — clears AR at its booked value regardless of rate movement. See @mhts/core-multi-currency's realized gain/loss handling. */
  amount_applied: number;
  created_at: ColumnType<string, string | undefined, never>;
  /** Phase 8 Increment 2 (multi-currency) — how much of the invoice's foreign-currency amount this settles. Null for a base-currency invoice. */
  foreign_amount_applied: number | null;
}

export interface PurchaseInvoiceSettlementTable {
  id: string;
  purchase_invoice_id: string;
  /** The Payment voucher that applies this amount against the invoice. */
  voucher_id: string;
  amount_applied: number;
  created_at: ColumnType<string, string | undefined, never>;
  /** Phase 8 Increment 2 (multi-currency). Null for a base-currency invoice. */
  foreign_amount_applied: number | null;
}

export interface UnitOfMeasureTable {
  id: string;
  name: string;
  symbol: string;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface WarehouseTable {
  id: string;
  name: string;
  address: string | null;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface ItemTable {
  id: string;
  item_code: string;
  name: string;
  /** 'STOCKABLE' | 'SERVICE' — see @mhts/core-inventory. */
  item_type: string;
  unit_id: string | null;
  /** Captured now, used from Phase 4 (GST engine). */
  hsn_sac_code: string | null;
  is_batch_tracked: ColumnType<boolean, boolean | number, boolean | number>;
  /** 'FIFO' | 'WEIGHTED_AVERAGE' — null for SERVICE items. */
  valuation_method: string | null;
  default_sales_ledger_id: string | null;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface ItemBatchTable {
  id: string;
  item_id: string;
  batch_number: string;
  expiry_date: string | null;
  manufacture_date: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface StockMovementTable {
  id: string;
  item_id: string;
  warehouse_id: string;
  batch_id: string | null;
  /** 'OPENING_STOCK' | 'PURCHASE_RECEIPT' | 'SALES_ISSUE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER_OUT' | 'TRANSFER_IN'. */
  movement_type: string;
  /** Thousandths of a unit. Always positive — direction comes from movement_type. */
  quantity_thousandths: number;
  /** Paise, per whole unit. */
  rate_paise: number;
  /** Paise. Stored explicitly — this is an append-only historical ledger, never recomputed. */
  value_paise: number;
  reference_type: string | null;
  reference_id: string | null;
  movement_date: string;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface StockReceiptLayerTable {
  id: string;
  item_id: string;
  warehouse_id: string;
  batch_id: string | null;
  source_movement_id: string;
  quantity_remaining_thousandths: number;
  /** Paise. See migration comment — absorbs rounding remainder on the draw that fully drains this layer. */
  value_remaining_paise: number;
  rate_paise: number;
  received_at: string;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface StockMovementLayerConsumptionTable {
  id: string;
  movement_id: string;
  layer_id: string;
  quantity_consumed_thousandths: number;
  value_consumed_paise: number;
}

export interface BankAccountTable {
  id: string;
  /** This bank's own dedicated ledger under the Bank Accounts group — its balance IS the bank's book balance. */
  ledger_account_id: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  branch_name: string | null;
  /** 'SAVINGS' | 'CURRENT' | 'CC' | 'OD' — see @mhts/core-banking. */
  account_type: string;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
  /** Phase 8 Increment 2 — set only when this account is actually held/tracked in a foreign currency. */
  account_currency: string | null;
}

export interface VoucherPaymentInstrumentTable {
  id: string;
  voucher_id: string;
  /** 'CASH' | 'CHEQUE' | 'NEFT' | 'RTGS' | 'UPI' | 'IMPS' | 'DD' | 'CARD' — see @mhts/core-banking. */
  instrument_type: string;
  cheque_number: string | null;
  cheque_date: string | null;
  utr_reference: string | null;
  /** 'PENDING' | 'PRESENTED' | 'CLEARED' | 'BOUNCED' | 'CANCELLED'. */
  instrument_status: string;
  status_date: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface BankReconciliationTable {
  id: string;
  voucher_line_id: string;
  is_reconciled: ColumnType<boolean, boolean | number, boolean | number>;
  reconciled_at: string | null;
  reconciled_by: string | null;
  /** The real date this movement appeared on the bank statement — can differ from voucher_date. */
  bank_statement_date: string | null;
  /** 'MANUAL' | 'IMPORT'. */
  matched_via: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface BankStatementImportTable {
  id: string;
  bank_account_id: string;
  file_name: string;
  imported_at: ColumnType<string, string | undefined, never>;
  /** AppUser.id from the system DB — not a foreign key here (cross-file). */
  imported_by: string | null;
  total_lines: number;
  matched_lines: number;
  unmatched_lines: number;
}

export interface BankStatementLineTable {
  id: string;
  import_id: string;
  bank_account_id: string;
  statement_date: string;
  description: string;
  /** Always positive. Paise. */
  amount_paise: number;
  /** 'CREDIT' | 'DEBIT' — the BANK's own terminology, the OPPOSITE sense of our ledger's debit/credit on an asset ledger. See migration 010_banking.ts. */
  direction: string;
  /** 'MATCHED' | 'UNMATCHED' | 'IGNORED'. */
  match_status: string;
  matched_voucher_line_id: string | null;
  is_likely_duplicate: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface EmployeeTable {
  id: string;
  employee_code: string;
  name: string;
  department: string | null;
  /** This employee's own dedicated ledger under "Employee Reimbursements Payable" — its balance IS the amount currently owed to them. */
  ledger_account_id: string;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
  /** Phase 7 (Payroll) — payroll profile fields added onto the same identity Phase 6 anchored, not a new employee concept. */
  date_of_birth: string | null;
  date_of_joining: string | null;
  date_of_leaving: string | null;
  /** 'PERMANENT' | 'FIXED_TERM' | 'CONTRACTUAL' | 'CONSULTANT' — see @mhts/core-payroll-engine. Drives gratuity's 1yr-vs-5yr eligibility rule. */
  employment_type: string | null;
  pan: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  uan: string | null;
  esi_number: string | null;
  /** DB default 0 — optional on insert so Phase 6's existing createEmployee (which never set this) still type-checks. */
  pf_voluntary_opt_out: ColumnType<boolean, boolean | number | undefined, boolean | number>;
  /** A SECOND dedicated ledger, distinct from ledger_account_id (which stays scoped to expense reimbursements) — under "Salaries Payable". Null until a salary structure is first assigned. */
  salary_payable_ledger_id: string | null;
}

export interface CompanyPayrollSettingsTable {
  id: string;
  /** 'AUTO' | 'ALWAYS' | 'NEVER' — see @mhts/core-payroll-engine's applicability.ts. */
  pf_applicability: string;
  esi_applicability: string;
  gratuity_applicability: string;
  pt_jurisdiction: string | null;
  /** 'NEW' | 'OLD'. */
  tds_regime: string;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
}

export interface SalaryComponentDefinitionTable {
  id: string;
  name: string;
  /** 'EARNING' | 'DEDUCTION'. */
  component_type: string;
  /** 'FLAT' | 'PCT_OF_BASIC' | 'PCT_OF_CTC'. */
  calculation_type: string;
  /** Paise. Set only when calculation_type = 'FLAT'. */
  flat_amount_paise: number | null;
  /** Basis points (e.g. 4000 = 40.00%). Set only for the PCT_* calculation types. */
  percent_basis_points: number | null;
  is_statutory_wage_base: ColumnType<boolean, boolean | number, boolean | number>;
  display_order: number;
  /** Null defaults to the shared "Salaries & Wages" ledger. */
  expense_ledger_id: string | null;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SalaryStructureTable {
  id: string;
  employee_id: string;
  effective_from: string;
  effective_to: string | null;
  /** Paise. */
  annual_ctc: number;
  /** 'ACTIVE' | 'SUPERSEDED'. */
  status: string;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SalaryStructureLineTable {
  id: string;
  salary_structure_id: string;
  component_id: string;
  /** Paise. Resolved and frozen at structure-creation time. */
  monthly_amount: number;
}

export interface LeaveTypeTable {
  id: string;
  name: string;
  is_paid: ColumnType<boolean, boolean | number, boolean | number>;
  annual_entitlement_days: number;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
}

export interface LeaveApplicationTable {
  id: string;
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  days: number;
  /** 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'. */
  status: string;
  reason: string | null;
  approved_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface LeaveBalanceTable {
  id: string;
  employee_id: string;
  leave_type_id: string;
  financial_year: string;
  opening_balance_days: number;
  accrued_days: number;
  availed_days: number;
}

export interface AttendanceRecordTable {
  id: string;
  employee_id: string;
  attendance_date: string;
  /** 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKLY_OFF'. */
  status: string;
  leave_application_id: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface PayrollRunTable {
  id: string;
  financial_year: string;
  period_month: number;
  period_year: number;
  /** 'DRAFT' | 'PROCESSED' | 'POSTED' | 'CANCELLED'. */
  status: string;
  /** The one balanced 'PAYROLL' voucher for the whole run — set at POSTED time. */
  voucher_id: string | null;
  processed_at: string | null;
  posted_at: string | null;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface PayslipTable {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  /** Tenths of a day (e.g. 305 = 30.5 days) — see migration 012's doc comment. */
  paid_days: number;
  lop_days: number;
  /** Paise. */
  gross_earnings: number;
  total_deductions: number;
  /** Paise. Informational only — not deducted from net pay. */
  employer_contributions: number;
  net_pay: number;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface PayslipLineTable {
  id: string;
  payslip_id: string;
  /** 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION'. */
  line_type: string;
  label: string;
  component_id: string | null;
  /** Paise. */
  amount: number;
}

export interface PayslipSettlementTable {
  id: string;
  payslip_id: string;
  /** The PAYMENT voucher disbursing this amount to the employee. */
  voucher_id: string;
  amount_applied: number;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface GratuityProvisionRunTable {
  id: string;
  period_year: number;
  period_month: number;
  voucher_id: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface GratuityProvisionLineTable {
  id: string;
  gratuity_provision_run_id: string;
  employee_id: string;
  days_of_service_snapshot: number;
  /** Paise. */
  provisioned_amount: number;
  cumulative_provision_after: number;
}

export interface GratuityRecordTable {
  id: string;
  employee_id: string;
  separation_date: string;
  is_eligible: ColumnType<boolean, boolean | number, boolean | number>;
  eligibility_reason: string;
  years_of_service_days: number;
  /** Paise. Formula estimate (15/26 x last-drawn wage-base x years of service) — not an actuarial valuation. */
  formula_amount: number;
  cumulative_provision_at_separation: number;
  /** Paise. Positive = top-up booked before settlement; negative = release of excess provision. */
  adjustment_amount: number;
  adjustment_voucher_id: string | null;
  settlement_voucher_id: string | null;
  /** 'DRAFT' | 'SETTLED'. */
  status: string;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface ExpenseClaimTable {
  id: string;
  employee_id: string;
  financial_year: string;
  claim_number: number;
  claim_date: string;
  purpose: string | null;
  /** 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'CANCELLED' — see @mhts/core-expense. */
  status: string;
  /** The EXPENSE_CLAIM voucher posted at APPROVAL time — null before that. */
  voucher_id: string | null;
  rejected_reason: string | null;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface ExpenseClaimLineTable {
  id: string;
  expense_claim_id: string;
  /** Must resolve to an EXPENSE-nature ledger — validated in core-expense. */
  expense_ledger_id: string;
  description: string;
  expense_date: string;
  /** Paise. */
  amount: number;
  line_narration: string | null;
}

export interface ExpenseClaimSettlementTable {
  id: string;
  expense_claim_id: string;
  /** The PAYMENT voucher that reimburses this amount against the claim. */
  voucher_id: string;
  amount_applied: number;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface DocumentAttachmentTable {
  id: string;
  /** Free string, same convention as audit_log.entity_type. */
  entity_type: string;
  entity_id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  file_data: Buffer;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: ColumnType<string, string | undefined, never>;
}

export interface CostCentreTable {
  id: string;
  name: string;
  code: string | null;
  parent_cost_centre_id: string | null;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface BudgetTable {
  id: string;
  name: string;
  financial_year: string;
  /** At least one of ledger_id/cost_centre_id is set — validated in core-accounting. */
  ledger_id: string | null;
  cost_centre_id: string | null;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface BudgetLineTable {
  id: string;
  budget_id: string;
  /** 1-12, calendar month number. */
  period_month: number;
  /** Paise. */
  amount_paise: number;
}

export interface AssetClassTable {
  id: string;
  name: string;
  /** Matches a rule_set payload key for rule_type FIXED_ASSET_SCHEDULE2_RATE (system DB). */
  schedule2_rate_category: string;
  /** Matches a rule_set payload key for rule_type FIXED_ASSET_IT_WDV_BLOCK_RATE (system DB). */
  it_wdv_block_category: string;
  /** This class's own dedicated ledger under "Fixed Assets" — its balance IS the gross block for every unit of this class. */
  gross_block_ledger_id: string;
  /** This class's own dedicated ledger under "Accumulated Depreciation" — a contra-asset ledger. */
  accumulated_depreciation_ledger_id: string;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface FixedAssetTable {
  id: string;
  asset_class_id: string;
  name: string;
  asset_code: string;
  purchase_date: string;
  /** Paise. */
  purchase_cost_paise: number;
  salvage_value_paise: number;
  cost_centre_id: string | null;
  /** 'ACTIVE' | 'DISPOSED' — see @mhts/core-fixed-assets. */
  status: string;
  disposed_at: string | null;
  acquisition_voucher_id: string | null;
  disposal_voucher_id: string | null;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface AssetDepreciationEntryTable {
  id: string;
  asset_id: string;
  /** 'SCHEDULE2' | 'IT_WDV' — the two independent depreciation books. */
  book: string;
  financial_year: string;
  /** Paise, all three. */
  opening_wdv_paise: number;
  depreciation_amount_paise: number;
  closing_wdv_paise: number;
  /** Only ever set for book = 'SCHEDULE2' — IT_WDV is memo-only, never GL-posted. */
  voucher_id: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface FxRevaluationRunTable {
  id: string;
  run_date: string;
  financial_year: string;
  /** Null only when every exposure's adjustment computed to zero — no voucher was needed (idempotent re-run). */
  voucher_id: string | null;
  created_by: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface FxRevaluationLineTable {
  id: string;
  run_id: string;
  ledger_id: string;
  currency: string;
  /** Foreign-currency minor units, debit-positive. */
  foreign_balance: number;
  /** Paise, all three. */
  base_balance_before: number;
  base_balance_after: number;
  adjustment_amount: number;
}

export interface BranchTable {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  /** This branch's own dedicated "Inter-Branch Current Account" ledger under the "Inter-Branch Accounts" group — same own-ledger-per-record pattern as business_party/bank_account/employee/asset_class. */
  inter_branch_ledger_id: string;
  is_active: ColumnType<boolean, boolean | number, boolean | number>;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface CompanyDatabase {
  role: RoleTable;
  permission: PermissionTable;
  role_permission: RolePermissionTable;
  audit_log: AuditLogTable;
  account_group: AccountGroupTable;
  ledger_account: LedgerAccountTable;
  voucher: VoucherTable;
  voucher_line: VoucherLineTable;
  business_party: BusinessPartyTable;
  sales_invoice: SalesInvoiceTable;
  sales_invoice_line: SalesInvoiceLineTable;
  purchase_invoice: PurchaseInvoiceTable;
  purchase_invoice_line: PurchaseInvoiceLineTable;
  sales_order: SalesOrderTable;
  sales_order_line: SalesOrderLineTable;
  purchase_order: PurchaseOrderTable;
  purchase_order_line: PurchaseOrderLineTable;
  sales_invoice_settlement: SalesInvoiceSettlementTable;
  purchase_invoice_settlement: PurchaseInvoiceSettlementTable;
  unit_of_measure: UnitOfMeasureTable;
  warehouse: WarehouseTable;
  item: ItemTable;
  item_batch: ItemBatchTable;
  stock_movement: StockMovementTable;
  stock_receipt_layer: StockReceiptLayerTable;
  stock_movement_layer_consumption: StockMovementLayerConsumptionTable;
  bank_account: BankAccountTable;
  voucher_payment_instrument: VoucherPaymentInstrumentTable;
  bank_reconciliation: BankReconciliationTable;
  bank_statement_import: BankStatementImportTable;
  bank_statement_line: BankStatementLineTable;
  employee: EmployeeTable;
  expense_claim: ExpenseClaimTable;
  expense_claim_line: ExpenseClaimLineTable;
  expense_claim_settlement: ExpenseClaimSettlementTable;
  document_attachment: DocumentAttachmentTable;
  company_payroll_settings: CompanyPayrollSettingsTable;
  salary_component_definition: SalaryComponentDefinitionTable;
  salary_structure: SalaryStructureTable;
  salary_structure_line: SalaryStructureLineTable;
  leave_type: LeaveTypeTable;
  leave_application: LeaveApplicationTable;
  leave_balance: LeaveBalanceTable;
  attendance_record: AttendanceRecordTable;
  payroll_run: PayrollRunTable;
  payslip: PayslipTable;
  payslip_line: PayslipLineTable;
  payslip_settlement: PayslipSettlementTable;
  gratuity_provision_run: GratuityProvisionRunTable;
  gratuity_provision_line: GratuityProvisionLineTable;
  gratuity_record: GratuityRecordTable;
  cost_centre: CostCentreTable;
  budget: BudgetTable;
  budget_line: BudgetLineTable;
  asset_class: AssetClassTable;
  fixed_asset: FixedAssetTable;
  asset_depreciation_entry: AssetDepreciationEntryTable;
  fx_revaluation_run: FxRevaluationRunTable;
  fx_revaluation_line: FxRevaluationLineTable;
  branch: BranchTable;
}
