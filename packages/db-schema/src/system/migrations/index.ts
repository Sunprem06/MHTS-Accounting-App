import type { Migration } from 'kysely/migration';
import * as m001Init from './001_init';
import * as m002CompanyAccessKeyWrap from './002_company_access_key_wrap';

export const migrations: Record<string, Migration> = {
  '001_init': m001Init,
  '002_company_access_key_wrap': m002CompanyAccessKeyWrap,
};
