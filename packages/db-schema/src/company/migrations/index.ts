import type { Migration } from 'kysely/migration';
import * as m001Init from './001_init';

export const migrations: Record<string, Migration> = {
  '001_init': m001Init,
};
