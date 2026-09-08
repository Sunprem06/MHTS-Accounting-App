import type { Kysely } from 'kysely';
import type { SystemDatabase } from '@mhts/db-schema';
import type { TrialStatus } from '../shared/ipc';

const TRIAL_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Called once at every app bootstrap. Idempotent — the trial clock starts at genuine first-ever launch on this install and is never reset afterward, short of deleting the system DB itself. */
export async function ensureTrialStarted(systemDb: Kysely<SystemDatabase>): Promise<void> {
  const existing = await systemDb.selectFrom('trial_activation').select('id').where('id', '=', 'default').executeTakeFirst();
  if (!existing) {
    await systemDb.insertInto('trial_activation').values({ id: 'default', started_at: new Date().toISOString() }).execute();
  }
}

/** `ensureTrialStarted` always runs before this at bootstrap, so the row is guaranteed to exist by the time anything calls this. */
export async function checkTrialStatus(systemDb: Kysely<SystemDatabase>): Promise<TrialStatus> {
  const row = await systemDb.selectFrom('trial_activation').select('started_at').where('id', '=', 'default').executeTakeFirstOrThrow();
  const elapsedDays = (Date.now() - new Date(row.started_at).getTime()) / MS_PER_DAY;
  const daysRemaining = Math.max(0, Math.ceil(TRIAL_DAYS - elapsedDays));
  return { active: daysRemaining > 0, daysRemaining };
}
