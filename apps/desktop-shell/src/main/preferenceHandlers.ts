import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import type { ThemePreference } from '../shared/ipc';

/**
 * Installation-wide UI preference, not tied to a logged-in session — the
 * theme needs to apply even on the Company List / Login screens, before any
 * company is opened. No permission check for the same reason ManageUsers
 * checks don't apply here: nothing sensitive is being read or written.
 */
export async function getThemePreference(systemDb: Kysely<SystemDatabase>): Promise<ThemePreference> {
  const row = await systemDb.selectFrom('app_preference').select('theme').where('id', '=', 'default').executeTakeFirstOrThrow();
  return row.theme as ThemePreference;
}

export async function setThemePreference(systemDb: Kysely<SystemDatabase>, theme: ThemePreference): Promise<void> {
  await systemDb.updateTable('app_preference').set({ theme, updated_at: new Date().toISOString() }).where('id', '=', 'default').execute();
}
