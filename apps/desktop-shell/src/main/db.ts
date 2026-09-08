import { join } from 'node:path';
import { mkdirSync, copyFileSync, unlinkSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import type { Kysely } from 'kysely';
import {
  openSystemDb,
  openCompanyDb,
  migrateSystemDb,
  migrateCompanyDb,
  type SystemDatabase,
  type CompanyDatabase,
} from '@mhts/db-schema';
import { loadOrCreateSystemKey } from './systemKey';

export interface AppPaths {
  userDataDir: string;
  systemDbPath: string;
  systemKeyPath: string;
  companiesDir: string;
}

export function resolveAppPaths(): AppPaths {
  const userDataDir = app.getPath('userData');
  return {
    userDataDir,
    systemDbPath: join(userDataDir, 'system.db'),
    systemKeyPath: join(userDataDir, 'system.key'),
    companiesDir: join(userDataDir, 'companies'),
  };
}

export async function openAndMigrateSystemDb(paths: AppPaths): Promise<Kysely<SystemDatabase>> {
  mkdirSync(paths.userDataDir, { recursive: true });
  const rawKey = loadOrCreateSystemKey(paths.systemKeyPath);
  const db = openSystemDb({ filePath: paths.systemDbPath, rawKey });
  await migrateSystemDb(db);
  return db;
}

export function companyDbFilePath(paths: AppPaths, companyId: string): string {
  return join(paths.companiesDir, `${companyId}.db`);
}

/**
 * Opens a company DB and brings it forward to the latest schema — called on
 * every login (and by restore's own verify-after-restore step), not just at
 * creation. `migrateCompanyDb` is idempotent (Kysely's Migrator tracks which
 * migrations already ran), so this is a no-op for a DB that's already
 * current; it only does real work for a DB created on an older app version
 * that's since been updated. If the file already exists, a pre-migration
 * safety copy is made first and restored on any migration failure — same
 * copy/verify/rollback shape `restoreCompany` already uses elsewhere.
 */
export async function openExistingCompanyDb(filePath: string, rawKey: Buffer): Promise<Kysely<CompanyDatabase>> {
  const backupPath = existsSync(filePath) ? `${filePath}.pre-migration-${randomUUID()}.bak` : null;
  if (backupPath) {
    copyFileSync(filePath, backupPath);
  }

  const db = openCompanyDb({ filePath, rawKey });
  try {
    await migrateCompanyDb(db);
    if (backupPath) {
      unlinkSync(backupPath);
    }
    return db;
  } catch (error) {
    await db.destroy();
    if (backupPath) {
      copyFileSync(backupPath, filePath);
    }
    throw error;
  }
}

export async function createAndMigrateCompanyDb(filePath: string, rawKey: Buffer): Promise<Kysely<CompanyDatabase>> {
  mkdirSync(join(filePath, '..'), { recursive: true });
  return openExistingCompanyDb(filePath, rawKey);
}
