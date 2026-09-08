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

/**
 * The single source of truth for "is someone logged in, with the right
 * permission, to do this" — every handler file used to declare its own
 * byte-for-byte identical copy of this function (14 of them, confirmed via
 * `grep -rn "function requireSessionWithCompanyDb"`), which meant a future
 * handler could in principle define its own guard slightly differently (or
 * forget to call it) with nothing to catch the drift at compile time. Phase
 * 11's security review flagged this as a real maintainability/consistency
 * risk, not a live vulnerability — every existing copy already behaved
 * identically — so this consolidates them into one shared implementation
 * every handler file now imports instead.
 */
export function requireSessionWithCompanyDb(requiredPermission: string): { info: SessionInfo; companyDb: Kysely<CompanyDatabase> } {
  const info = session.get();
  const companyDb = session.getCompanyDb();
  if (!info || !companyDb) {
    throw new Error('Not logged in');
  }
  if (!info.permissions.includes(requiredPermission)) {
    throw new Error(`You do not have permission (${requiredPermission}) for this action`);
  }
  return { info, companyDb };
}
