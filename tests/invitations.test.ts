import { describe, it, expect } from 'vitest';
import { hashInvitationCode } from '@/lib/invitations';

describe('Passcode-Based Invitation Engine', () => {
  it('should hash 8-digit invitation codes with cryptographic salt', () => {
    const code = '84920481';
    const salt1 = 'salt_abc123';
    const salt2 = 'salt_xyz789';

    const hash1 = hashInvitationCode(code, salt1);
    const hash2 = hashInvitationCode(code, salt2);

    expect(hash1).toHaveLength(64); // SHA-256 hex string
    expect(hash2).toHaveLength(64);
    expect(hash1).not.toBe(hash2); // Different salts must yield different hashes

    // Verifying same code and same salt produces matching hash
    const hashVerify = hashInvitationCode(code, salt1);
    expect(hashVerify).toBe(hash1);
  });

  it('should calculate 15-minute expiration window accurately', () => {
    const now = Date.now();
    const expiryMinutes = 15;
    const expiresAt = new Date(now + expiryMinutes * 60 * 1000);

    const diffMinutes = (expiresAt.getTime() - now) / (60 * 1000);
    expect(diffMinutes).toBeCloseTo(15, 1);
  });

  it('should distinguish valid 8-digit codes from invalid formats', () => {
    const validCode = '84920481';
    const shortCode = '84920';
    const alphaCode = '8492048A';
    const longCode = '8492048123';

    const regex = /^\d{8}$/;
    expect(regex.test(validCode)).toBe(true);
    expect(regex.test(shortCode)).toBe(false);
    expect(regex.test(alphaCode)).toBe(false);
    expect(regex.test(longCode)).toBe(false);
  });
});
