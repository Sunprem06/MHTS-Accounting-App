import type { Migration } from 'kysely/migration';
import * as m001Init from './001_init';
import * as m002ChartOfAccounts from './002_chart_of_accounts';
import * as m003Vouchers from './003_vouchers';
import * as m004VoucherCancellation from './004_voucher_cancellation';
import * as m005SalesPurchase from './005_sales_purchase';
import * as m006BillWiseSettlement from './006_bill_wise_settlement';
import * as m007Inventory from './007_inventory';
import * as m008Gst from './008_gst';

export const migrations: Record<string, Migration> = {
  '001_init': m001Init,
  '002_chart_of_accounts': m002ChartOfAccounts,
  '003_vouchers': m003Vouchers,
  '004_voucher_cancellation': m004VoucherCancellation,
  '005_sales_purchase': m005SalesPurchase,
  '006_bill_wise_settlement': m006BillWiseSettlement,
  '007_inventory': m007Inventory,
  '008_gst': m008Gst,
};
