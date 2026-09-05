import type { Kysely } from 'kysely';
import { Migrator, type Migration, type MigrationProvider, type MigrationResultSet } from 'kysely/migration';
import { migrations as systemMigrations } from './system/migrations';
import { migrations as companyMigrations } from './company/migrations';

/**
 * Migrations are bundled as plain TS modules (not scanned from disk) so this
 * works unmodified inside an Electron asar package, where filesystem
 * directory scanning of source files is unreliable.
 */
class StaticMigrationProvider implements MigrationProvider {
  constructor(private readonly migrations: Record<string, Migration>) {}
  async getMigrations(): Promise<Record<string, Migration>> {
    return this.migrations;
  }
}

async function runToLatest(db: Kysely<any>, migrations: Record<string, Migration>): Promise<MigrationResultSet> {
  const migrator = new Migrator({ db, provider: new StaticMigrationProvider(migrations) });
  const resultSet = await migrator.migrateToLatest();
  if (resultSet.error) {
    throw resultSet.error;
  }
  return resultSet;
}

export function migrateSystemDb(db: Kysely<any>): Promise<MigrationResultSet> {
  return runToLatest(db, systemMigrations);
}

export function migrateCompanyDb(db: Kysely<any>): Promise<MigrationResultSet> {
  return runToLatest(db, companyMigrations);
}
