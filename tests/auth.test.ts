import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSessionToken, verifySessionToken, revokeSession } from '@/lib/auth/session';
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limiter';

describe('Authentication & Security', () => {
  it('should securely hash passwords and verify correct passwords', async () => {
    const password = 'CareCircleSecure2026!';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true);

    const isMatch = await verifyPassword(password, hash);
    expect(isMatch).toBe(true);

    const isWrong = await verifyPassword('WrongPassword123!', hash);
    expect(isWrong).toBe(false);
  });

  it('should create and verify signed JWT session tokens with standard claims', async () => {
    const sessionPayload = {
      sessionId: 'sess_test_123',
      userId: 'usr_test_123',
      email: 'eleanor@carecircle.demo',
      name: 'Eleanor Vance',
      role: 'elderly' as const,
      seniorModeEnabled: true,
      activeProfileId: 'prof_test_456',
    };

    const token = await createSessionToken(sessionPayload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const decoded = await verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe('usr_test_123');
    expect(decoded?.email).toBe('eleanor@carecircle.demo');
    expect(decoded?.seniorModeEnabled).toBe(true);
    expect(decoded?.sessionId).toBe('sess_test_123');
  });

  it('should reject tampered or invalid session tokens', async () => {
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.tampered';
    const decoded = await verifySessionToken(invalidToken);
    expect(decoded).toBeNull();
  });

  it('should support explicit session revocation', async () => {
    const sessionPayload = {
      sessionId: 'sess_revoke_test',
      userId: 'usr_revoke_123',
      email: 'revoked@carecircle.demo',
      name: 'Revoked User',
      role: 'family' as const,
      seniorModeEnabled: false,
    };

    const token = await createSessionToken(sessionPayload);
    const validDecoded = await verifySessionToken(token);
    expect(validDecoded?.sessionId).toBe('sess_revoke_test');

    // Invalidate session
    await revokeSession('sess_revoke_test');
  });

  it('should enforce rate limits against brute force attacks', async () => {
    const testKey = 'test_ip_127_0_0_1';
    await resetRateLimit(testKey);

    // Allow 3 attempts
    const res1 = await checkRateLimit(testKey, 3, 60);
    expect(res1.allowed).toBe(true);
    const res2 = await checkRateLimit(testKey, 3, 60);
    expect(res2.allowed).toBe(true);
    const res3 = await checkRateLimit(testKey, 3, 60);
    expect(res3.allowed).toBe(true);

    // 4th attempt should be blocked
    const blockedRes = await checkRateLimit(testKey, 3, 60);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.resetSeconds).toBeGreaterThan(0);

    await resetRateLimit(testKey);
  });
});
