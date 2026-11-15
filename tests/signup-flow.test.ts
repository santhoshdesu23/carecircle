import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/signup/route';
import { POST as verifyPost } from '@/app/api/auth/verify-email/route';
import { User, ElderlyProfile, CareCircleMember } from '@/types';
import { hashPassword } from '@/lib/auth/password';

// In-memory mock storage
const mockUsers = new Map<string, User>();
const mockProfiles = new Map<string, ElderlyProfile>();
const mockMembers = new Map<string, CareCircleMember>();

let mockDbFails = false;
let mockInsertFails = false;
let mockSessionFails = false;

// Mock Brevo email sender
const mockSendEmail = vi.fn();

vi.mock('@/lib/email', () => ({
  sendAccountVerificationEmail: vi.fn().mockImplementation((params) => mockSendEmail(params)),
  sendTransactionalEmail: vi.fn(),
  getEmailSender: vi
    .fn()
    .mockReturnValue({ name: 'CareCircle', email: 'notifications@carecircle.app' }),
}));

// Mock Database Collections
vi.mock('@/lib/database/collections', () => ({
  getUsersCollection: vi.fn().mockImplementation(async () => {
    if (mockDbFails) {
      const err = new Error('querySrv ENOTFOUND _mongodb._tcp.23Db');
      (err as any).name = 'MongoServerSelectionError';
      (err as any).code = 'ENOTFOUND';
      throw err;
    }
    return {
      findOne: vi.fn().mockImplementation(async (query: { email?: string; _id?: string }) => {
        if (query.email) {
          for (const u of mockUsers.values()) {
            if (u.email === query.email) return { ...u };
          }
        }
        if (query._id) {
          return mockUsers.get(query._id) ? { ...mockUsers.get(query._id)! } : null;
        }
        return null;
      }),
      insertOne: vi.fn().mockImplementation(async (doc: User) => {
        if (mockInsertFails) {
          throw new Error('Mongo write concern error: disk full');
        }
        mockUsers.set(doc._id, { ...doc });
        return { acknowledged: true, insertedId: doc._id };
      }),
      updateOne: vi
        .fn()
        .mockImplementation(async (query: { _id?: string }, update: { $set: Partial<User> }) => {
          if (query._id && mockUsers.has(query._id)) {
            const existing = mockUsers.get(query._id)!;
            mockUsers.set(query._id, { ...existing, ...update.$set });
          }
          return { acknowledged: true, modifiedCount: 1 };
        }),
    };
  }),
  getElderlyProfilesCollection: vi.fn().mockImplementation(async () => ({
    insertOne: vi.fn().mockImplementation(async (doc: ElderlyProfile) => {
      mockProfiles.set(doc._id, { ...doc });
      return { acknowledged: true, insertedId: doc._id };
    }),
  })),
  getCareCircleMembersCollection: vi.fn().mockImplementation(async () => ({
    insertOne: vi.fn().mockImplementation(async (doc: CareCircleMember) => {
      mockMembers.set(doc._id, { ...doc });
      return { acknowledged: true, insertedId: doc._id };
    }),
  })),
}));

// Mock Index Assurance
vi.mock('@/lib/database/indexes', () => ({
  ensureDatabaseIndexes: vi.fn().mockImplementation(async () => {
    if (mockDbFails) {
      const err = new Error('querySrv ENOTFOUND _mongodb._tcp.23Db');
      (err as any).name = 'MongoServerSelectionError';
      (err as any).code = 'ENOTFOUND';
      throw err;
    }
    return Promise.resolve();
  }),
}));

// Mock Session Cookie
vi.mock('@/lib/auth/session', () => ({
  setSessionCookie: vi.fn().mockImplementation(async () => {
    if (mockSessionFails) {
      throw new Error('JWT token encryption failure');
    }
    return Promise.resolve();
  }),
}));

// Mock Audit
vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

let testSeq = 1;
function createSignupRequest(body: Record<string, unknown>, ip?: string): NextRequest {
  const requestIp = ip || `127.0.0.${testSeq++}`;
  return new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': requestIp,
    },
    body: JSON.stringify(body),
  });
}

describe('CareCircle Comprehensive Signup Flow & Verification State Machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsers.clear();
    mockProfiles.clear();
    mockMembers.clear();
    mockDbFails = false;
    mockInsertFails = false;
    mockSessionFails = false;
    process.env.MONGODB_URI =
      'mongodb+srv://mockuser:mockpass@cluster0.demo.mongodb.net/carecircle';
    mockSendEmail.mockResolvedValue({ success: true, status: 'sent', messageId: '<mock-msg-id>' });
  });

  it('1. Successful elderly registration auto-creates healthcare profile & member record', async () => {
    const req = createSignupRequest({
      name: 'Eleanor Vance',
      email: 'eleanor@carecircle.demo',
      password: 'Password123!',
      role: 'elderly',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.status).toBe('pending_verification');
    expect(data.user.role).toBe('elderly');
    expect(data.user.seniorModeEnabled).toBe(true);
    expect(data.user.activeProfileId).toBeDefined();

    // Verify user stored in DB
    const savedUser = Array.from(mockUsers.values()).find(
      (u) => u.email === 'eleanor@carecircle.demo'
    );
    expect(savedUser).toBeDefined();
    expect(savedUser?.emailVerified).toBe(false);
    expect(savedUser?.emailVerificationToken).toBeDefined();

    // Verify profile auto-created for elderly role
    expect(mockProfiles.size).toBe(1);
    const profile = Array.from(mockProfiles.values())[0];
    expect(profile.ownerUserId).toBe(savedUser?._id);

    // Verify owner membership created
    expect(mockMembers.size).toBe(1);
    const member = Array.from(mockMembers.values())[0];
    expect(member.role).toBe('owner');
    expect(member.permissions.canManageMedications).toBe(true);
  });

  it('2. Successful family member registration does not auto-create an elderly profile', async () => {
    const req = createSignupRequest({
      name: 'Alice Vance',
      email: 'alice@carecircle.demo',
      password: 'Password123!',
      role: 'family',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.user.role).toBe('family');
    expect(data.user.seniorModeEnabled).toBe(false);
    expect(data.user.activeProfileId).toBeUndefined();
    expect(mockProfiles.size).toBe(0);
  });

  it('3. Successful caretaker registration', async () => {
    const req = createSignupRequest({
      name: 'Nurse David',
      email: 'david@carecircle.demo',
      password: 'Password123!',
      role: 'caretaker',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.user.role).toBe('caretaker');
    expect(mockProfiles.size).toBe(0);
  });

  it('4. Rejects invalid email format with HTTP 400', async () => {
    const req = createSignupRequest({
      name: 'Invalid Email User',
      email: 'not-an-email',
      password: 'Password123!',
      role: 'family',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error).toBeDefined();
    expect(mockUsers.size).toBe(0);
  });

  it('5. Rejects weak password with HTTP 400', async () => {
    const req = createSignupRequest({
      name: 'Weak Pass User',
      email: 'weak@carecircle.demo',
      password: 'pass', // Too short, no caps/numbers
      role: 'family',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error).toContain('at least 8');
  });

  it('6. Rejects missing name with HTTP 400', async () => {
    const req = createSignupRequest({
      name: '',
      email: 'noname@carecircle.demo',
      password: 'Password123!',
      role: 'family',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('7. Rejects duplicate email for active account with HTTP 409', async () => {
    const hashed = await hashPassword('Password123!');
    mockUsers.set('usr_existing_1', {
      _id: 'usr_existing_1',
      name: 'Existing Active User',
      email: 'active@carecircle.demo',
      passwordHash: hashed,
      emailVerified: true,
      status: 'active',
      defaultRole: 'family',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = createSignupRequest({
      name: 'Active Duplicate',
      email: 'active@carecircle.demo',
      password: 'Password123!',
      role: 'family',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain('already exists');
  });

  it('8. Handles MongoDB connection failure with HTTP 503 instead of generic 500', async () => {
    mockDbFails = true; // Simulating "querySrv ENOTFOUND _mongodb._tcp.23Db"

    const req = createSignupRequest({
      name: 'DB Fail User',
      email: 'dbfail@carecircle.demo',
      password: 'Password123!',
      role: 'elderly',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.code).toBe('DNS_RESOLUTION_FAILURE');
    expect(data.error).toContain('Database service is temporarily unavailable');
    expect(data.requestId).toBeDefined();
  });

  it('9. Handles MongoDB insert failure gracefully', async () => {
    mockInsertFails = true;

    const req = createSignupRequest({
      name: 'Insert Fail User',
      email: 'insertfail@carecircle.demo',
      password: 'Password123!',
      role: 'family',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('An unexpected error occurred during signup.');
    expect(data.requestId).toBeDefined();
  });

  it('10. Handles Brevo API authentication failure (401) without crashing signup or orphaning account', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('Brevo API key unauthorized (401)'));

    const req = createSignupRequest({
      name: 'Brevo Auth Fail',
      email: 'brevoauth@carecircle.demo',
      password: 'Password123!',
      role: 'family',
    });

    const res = await POST(req);
    const data = await res.json();

    // Signup must still succeed and inform user about verification email issue
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.emailDelivery.status).toBe('failed');
    expect(mockUsers.size).toBe(1);
  });

  it('11. Handles Brevo rate limiting (429) cleanly', async () => {
    mockSendEmail.mockResolvedValueOnce({
      success: false,
      status: 'failed',
      error: 'Brevo rate limit exceeded (429)',
    });

    const req = createSignupRequest({
      name: 'Rate Limit User',
      email: 'ratelimit@carecircle.demo',
      password: 'Password123!',
      role: 'family',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.emailDelivery.status).toBe('failed');
    expect(data.emailDelivery.error).toContain('rate limit');
  });

  it('12. Handles Brevo network timeout safely', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('Brevo request timed out after 5000ms'));

    const req = createSignupRequest({
      name: 'Timeout User',
      email: 'timeout@carecircle.demo',
      password: 'Password123!',
      role: 'elderly',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.emailDelivery.status).toBe('failed');
  });

  it('13. Allows existing unverified user to resend verification email via signup endpoint', async () => {
    const hashed = await hashPassword('Password123!');
    mockUsers.set('usr_unverified_1', {
      _id: 'usr_unverified_1',
      name: 'Unverified Eleanor',
      email: 'unverified@carecircle.demo',
      passwordHash: hashed,
      emailVerified: false,
      status: 'pending_verification',
      defaultRole: 'elderly',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Submitting signup again with the same credentials
    const req = createSignupRequest({
      name: 'Unverified Eleanor',
      email: 'unverified@carecircle.demo',
      password: 'Password123!',
      role: 'elderly',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('fresh verification email has been sent');
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('14. Verification token expiration handling', async () => {
    // User with expired token (expired yesterday)
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rawToken = 'expired_raw_token_123';
    const crypto = await import('node:crypto');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    mockUsers.set('usr_expired_1', {
      _id: 'usr_expired_1',
      name: 'Expired Token User',
      email: 'expired@carecircle.demo',
      passwordHash: 'hash',
      emailVerified: false,
      status: 'pending_verification',
      emailVerificationToken: tokenHash,
      emailVerificationExpires: expiredDate,
      defaultRole: 'family',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = new NextRequest('http://localhost:3000/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, email: 'expired@carecircle.demo' }),
    });

    const res = await verifyPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('expired');
  });

  it('15. Valid verification token activates account and sets emailVerified to true', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const rawToken = 'valid_raw_token_xyz';
    const crypto = await import('node:crypto');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    mockUsers.set('usr_valid_1', {
      _id: 'usr_valid_1',
      name: 'Valid Token User',
      email: 'valid@carecircle.demo',
      passwordHash: 'hash',
      emailVerified: false,
      status: 'pending_verification',
      emailVerificationToken: tokenHash,
      emailVerificationExpires: futureDate,
      defaultRole: 'family',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = new NextRequest('http://localhost:3000/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, email: 'valid@carecircle.demo' }),
    });

    const res = await verifyPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('successfully verified');

    const updated = mockUsers.get('usr_valid_1');
    expect(updated?.emailVerified).toBe(true);
    expect(updated?.status).toBe('active');
    expect(updated?.emailVerificationToken).toBeNull();
  });

  it('16. Handles session creation failure gracefully', async () => {
    mockSessionFails = true;

    const req = createSignupRequest({
      name: 'Session Fail User',
      email: 'sessfail@carecircle.demo',
      password: 'Password123!',
      role: 'family',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('An unexpected error occurred during signup.');
  });

  it('17. Existing unverified account recovery rejects incorrect password with HTTP 409', async () => {
    const hashed = await hashPassword('CorrectPassword123!');
    mockUsers.set('usr_unverified_wrong_pass', {
      _id: 'usr_unverified_wrong_pass',
      name: 'Unverified User',
      email: 'recovery@carecircle.demo',
      passwordHash: hashed,
      emailVerified: false,
      status: 'pending_verification',
      defaultRole: 'family',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = createSignupRequest({
      name: 'Attacker Attempting Hijack',
      email: 'recovery@carecircle.demo',
      password: 'WrongPassword999!',
      role: 'family',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain('already exists');
  });
});
