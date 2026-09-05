import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { SessionInfo } from '../shared/ipc';

/**
 * Single active session, held only in main-process memory — the renderer only
 * ever sees the plain SessionInfo snapshot over IPC, never the open Company DB
 * handle or any key material (Rule #1 boundary + key-wrap design).
 */
class SessionManager {
  private info: SessionInfo | null = null;
  private companyDb: Kysely<CompanyDatabase> | null = null;

  set(info: SessionInfo, companyDb: Kysely<CompanyDatabase>): void {
    this.info = info;
    this.companyDb = companyDb;
  }

  get(): SessionInfo | null {
    return this.info;
  }

  getCompanyDb(): Kysely<CompanyDatabase> | null {
    return this.companyDb;
  }

  async clear(): Promise<void> {
    await this.companyDb?.destroy();
    this.info = null;
    this.companyDb = null;
  }
}

export const session = new SessionManager();
