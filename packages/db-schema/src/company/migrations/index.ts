import type { Migration } from 'kysely/migration';
import * as m001Init from './001_init';
import * as m002ChartOfAccounts from './002_chart_of_accounts';
import * as m003Vouchers from './003_vouchers';
import * as m004VoucherCancellation from './004_voucher_cancellation';

export const migrations: Record<string, Migration> = {
  '001_init': m001Init,
  '002_chart_of_accounts': m002ChartOfAccounts,
  '003_vouchers': m003Vouchers,
  '004_voucher_cancellation': m004VoucherCancellation,
};
