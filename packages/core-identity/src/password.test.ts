import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('core-identity: hashPassword / verifyPassword', () => {
  it('round-trips: the correct password verifies against its own hash', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(verifyPassword('wrong password', hash)).toBe(false);
  });

  it('two hashes of the same password are different (random salt) but both verify', () => {
    const hashA = hashPassword('same-password');
    const hashB = hashPassword('same-password');
    expect(hashA).not.toBe(hashB);
    expect(verifyPassword('same-password', hashA)).toBe(true);
    expect(verifyPassword('same-password', hashB)).toBe(true);
  });

  it('is in the self-describing scrypt$N$r$p$salt$hash format', () => {
    const hash = hashPassword('anything');
    const parts = hash.split('$');
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe('scrypt');
  });

  it('rejects a malformed/foreign stored hash instead of throwing', () => {
    expect(verifyPassword('anything', 'not-a-real-hash')).toBe(false);
    expect(verifyPassword('anything', 'bcrypt$10$abc')).toBe(false);
  });
});
