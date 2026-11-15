import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit';

export async function POST() {
  const session = await getSession();
  if (session) {
    await logAuditEvent({
      actorUserId: session.userId,
      actorName: session.name,
      actorEmail: session.email,
      action: 'USER_SIGNED_OUT',
      details: {},
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ success: true, message: 'Signed out successfully.' });
}
