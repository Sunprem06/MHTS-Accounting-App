import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
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

export async function createAndMigrateCompanyDb(filePath: string, rawKey: Buffer): Promise<Kysely<CompanyDatabase>> {
  mkdirSync(join(filePath, '..'), { recursive: true });
  const db = openCompanyDb({ filePath, rawKey });
  await migrateCompanyDb(db);
  return db;
}

export function openExistingCompanyDb(filePath: string, rawKey: Buffer): Kysely<CompanyDatabase> {
  return openCompanyDb({ filePath, rawKey });
}
