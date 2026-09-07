import type { Migration } from 'kysely/migration';
import * as m001Init from './001_init';
import * as m002ChartOfAccounts from './002_chart_of_accounts';
import * as m003Vouchers from './003_vouchers';
import * as m004VoucherCancellation from './004_voucher_cancellation';
import * as m005SalesPurchase from './005_sales_purchase';
import * as m006BillWiseSettlement from './006_bill_wise_settlement';
import * as m007Inventory from './007_inventory';
import * as m008Gst from './008_gst';
import * as m009GstItcRcm from './009_gst_itc_rcm';
import * as m010Banking from './010_banking';
import * as m011ExpensesDocuments from './011_expenses_documents';
import * as m012Payroll from './012_payroll';
import * as m013CostCentresBudgets from './013_cost_centres_budgets';
import * as m014FixedAssets from './014_fixed_assets';
import * as m015MultiCurrency from './015_multi_currency';
import * as m016MultiBranch from './016_multi_branch';
import * as m017Manufacturing from './017_manufacturing';
import * as m018PrintTemplates from './018_print_templates';

export const migrations: Record<string, Migration> = {
  '001_init': m001Init,
  '002_chart_of_accounts': m002ChartOfAccounts,
  '003_vouchers': m003Vouchers,
  '004_voucher_cancellation': m004VoucherCancellation,
  '005_sales_purchase': m005SalesPurchase,
  '006_bill_wise_settlement': m006BillWiseSettlement,
  '007_inventory': m007Inventory,
  '008_gst': m008Gst,
  '009_gst_itc_rcm': m009GstItcRcm,
  '010_banking': m010Banking,
  '011_expenses_documents': m011ExpensesDocuments,
  '012_payroll': m012Payroll,
  '013_cost_centres_budgets': m013CostCentresBudgets,
  '014_fixed_assets': m014FixedAssets,
  '015_multi_currency': m015MultiCurrency,
  '016_multi_branch': m016MultiBranch,
  '017_manufacturing': m017Manufacturing,
  '018_print_templates': m018PrintTemplates,
};
