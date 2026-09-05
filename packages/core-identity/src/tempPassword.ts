import { randomInt } from 'node:crypto';

/**
 * Human-communicable temporary password for an admin-initiated reset (read
 * aloud, texted, written down) — not a cryptographic key, so it uses a
 * shorter, unambiguous alphabet rather than raw hex. Excludes visually
 * confusable characters (0/O, 1/I/l). ~12 chars from a 32-symbol alphabet is
 * ~60 bits of entropy, comfortably more than a typical human-chosen password,
 * and the account carrying it forces a real password change on first use.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateTemporaryPassword(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return chars.join('').match(/.{1,4}/g)!.join('-');
}
