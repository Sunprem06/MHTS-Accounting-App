import type { Kysely, Selectable } from 'kysely';
import type { CompanyAccessTable, SystemDatabase } from '@mhts/db-schema';

/** Thrown for both "locked out" and "too soon, back off" — the caller just surfaces the message. */
export class LockedOutError extends Error {}

export async function loadSecurityPolicy(systemDb: Kysely<SystemDatabase>) {
  const policy = await systemDb.selectFrom('security_policy').selectAll().where('id', '=', 'default').executeTakeFirst();
  if (!policy) {
    throw new Error('Security policy is not configured (security_policy row missing)');
  }
  return policy;
}

/** Throws LockedOutError if login should be refused right now — checked BEFORE looking at the supplied password. */
export function assertNotLocked(
  access: Pick<Selectable<CompanyAccessTable>, 'locked_until' | 'failed_login_count' | 'last_failed_attempt_at'>,
  policy: { lockout_duration_seconds: number; backoff_base_seconds: number },
  now: Date = new Date(),
): void {
  if (access.locked_until) {
    const lockedUntil = new Date(access.locked_until);
    if (now < lockedUntil) {
      const remaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
      throw new LockedOutError(`Too many failed attempts. Try again in ${remaining} second(s).`);
    }
  }

  if (access.failed_login_count > 0 && access.last_failed_attempt_at) {
    const requiredWaitSeconds = policy.backoff_base_seconds * 2 ** (access.failed_login_count - 1);
    const elapsedSeconds = (now.getTime() - new Date(access.last_failed_attempt_at).getTime()) / 1000;
    if (elapsedSeconds < requiredWaitSeconds) {
      const remaining = Math.ceil(requiredWaitSeconds - elapsedSeconds);
      throw new LockedOutError(`Please wait ${remaining} second(s) before trying again.`);
    }
  }
}

/** Call after a wrong-password (or failed-unwrap) attempt. */
export async function recordFailedAttempt(
  systemDb: Kysely<SystemDatabase>,
  accessId: string,
  currentFailedCount: number,
  policy: { max_failed_attempts: number; lockout_duration_seconds: number },
  now: Date = new Date(),
): Promise<void> {
  const newCount = currentFailedCount + 1;
  const lockedUntil = newCount >= policy.max_failed_attempts
    ? new Date(now.getTime() + policy.lockout_duration_seconds * 1000).toISOString()
    : null;

  await systemDb
    .updateTable('company_access')
    .set({ failed_login_count: newCount, last_failed_attempt_at: now.toISOString(), locked_until: lockedUntil })
    .where('id', '=', accessId)
    .execute();
}

/** Call after any successful credential check (login, recovery reset, admin reset, change-password). */
export function clearedLockoutColumns() {
  return { failed_login_count: 0, locked_until: null, last_failed_attempt_at: null } as const;
}
