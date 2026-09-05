import type { Kysely } from 'kysely';
import type { CompanyDatabase } from '@mhts/db-schema';
import type { SessionInfo } from '../shared/ipc';

/**
 * Single active session, held only in main-process memory — the renderer only
 * ever sees the plain SessionInfo snapshot over IPC, never the open Company DB
 * handle or any key material (Rule #1 boundary + key-wrap design). The raw DEK
 * is kept alongside it (never exposed over IPC) so a permission-holding user
 * can re-wrap it for someone else (admin password reset) without needing that
 * person's recovery key — this doesn't weaken anything, since SQLCipher
 * already keeps the derived key resident in memory for the life of the open
 * `companyDb` connection.
 */
class SessionManager {
  private info: SessionInfo | null = null;
  private companyDb: Kysely<CompanyDatabase> | null = null;
  private dek: Buffer | null = null;

  set(info: SessionInfo, companyDb: Kysely<CompanyDatabase>, dek: Buffer): void {
    this.info = info;
    this.companyDb = companyDb;
    this.dek = dek;
  }

  get(): SessionInfo | null {
    return this.info;
  }

  getCompanyDb(): Kysely<CompanyDatabase> | null {
    return this.companyDb;
  }

  getDek(): Buffer | null {
    return this.dek;
  }

  async clear(): Promise<void> {
    await this.companyDb?.destroy();
    this.info = null;
    this.companyDb = null;
    this.dek = null;
  }
}

export const session = new SessionManager();
