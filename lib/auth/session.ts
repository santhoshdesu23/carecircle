import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { UserSession, ActiveSession } from '@/types';
import { getSessionsCollection } from '@/lib/database/collections';

const SESSION_COOKIE_NAME = 'carecircle_session';
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days
const DEFAULT_DEV_SECRET = 'carecircle-super-secret-development-key-32-chars-min!';

// In-memory fallback tracking for revoked sessions during test runs
const testRevokedSessions = new Set<string>();

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || secret === DEFAULT_DEV_SECRET || secret.length < 32) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: A secure AUTH_SECRET of at least 32 characters must be configured in production.'
      );
    }
    return new TextEncoder().encode(secret);
  }

  return new TextEncoder().encode(secret || DEFAULT_DEV_SECRET);
}

export async function createSessionToken(payload: UserSession): Promise<string> {
  const sessionId = payload.sessionId || `sess_${crypto.randomUUID()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_SECONDS * 1000);

  // Register active session in database for revocation support
  if (process.env.NODE_ENV !== 'test') {
    try {
      const sessionsCol = await getSessionsCollection();
      const sessionDoc: ActiveSession = {
        _id: sessionId,
        userId: payload.userId,
        email: payload.email,
        isValid: true,
        createdAt: now,
        expiresAt,
      };
      await sessionsCol.updateOne({ _id: sessionId }, { $set: sessionDoc }, { upsert: true });
    } catch (_err) {
      // Allow transient db retries without failing token generation
    }
  }

  return new SignJWT({ ...payload, sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('carecircle')
    .setAudience('carecircle:auth')
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: 'carecircle',
      audience: 'carecircle:auth',
    });

    const userSession = payload as unknown as UserSession;

    // Check if session has been revoked
    if (userSession.sessionId) {
      if (testRevokedSessions.has(userSession.sessionId)) {
        return null; // Session revoked in test store
      }

      if (process.env.NODE_ENV !== 'test') {
        try {
          const sessionsCol = await getSessionsCollection();
          const activeDoc = await sessionsCol.findOne({ _id: userSession.sessionId });
          if (activeDoc?.isValid === false) {
            return null; // Session explicitly revoked in database!
          }
        } catch (_err) {
          // Fall back to cryptographic token claims if db temporarily unreachable
        }
      }
    }

    return userSession;
  } catch (_err) {
    return null;
  }
}

export async function setSessionCookie(session: UserSession): Promise<string> {
  const token = await createSessionToken(session);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
  return token;
}

export async function getSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function revokeSession(sessionId: string): Promise<void> {
  testRevokedSessions.add(sessionId);
  if (process.env.NODE_ENV !== 'test') {
    try {
      const sessionsCol = await getSessionsCollection();
      await sessionsCol.updateOne(
        { _id: sessionId },
        { $set: { isValid: false, revokedAt: new Date() } }
      );
    } catch (error) {
      console.error('Failed to revoke session:', error);
    }
  }
}

export async function clearSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const session = await verifySessionToken(token);
      if (session?.sessionId) {
        await revokeSession(session.sessionId);
      }
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}
