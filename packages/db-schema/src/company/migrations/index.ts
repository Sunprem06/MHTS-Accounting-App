import type { Migration } from 'kysely/migration';
import * as m001Init from './001_init';
import * as m002ChartOfAccounts from './002_chart_of_accounts';
import * as m003Vouchers from './003_vouchers';

export const migrations: Record<string, Migration> = {
  '001_init': m001Init,
  '002_chart_of_accounts': m002ChartOfAccounts,
  '003_vouchers': m003Vouchers,
};
