import { NextRequest, NextResponse } from 'next/server';
import { getSession, setSessionCookie } from '@/lib/auth/session';
import { getUsersCollection } from '@/lib/database/collections';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { enabled } = await req.json();
  const seniorModeEnabled = Boolean(enabled);

  await setSessionCookie({
    ...session,
    seniorModeEnabled,
  });

  const usersCol = await getUsersCollection();
  await usersCol.updateOne(
    { _id: session.userId },
    { $set: { seniorModeEnabled, updatedAt: new Date() } }
  );

  await logAuditEvent({
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'SENIOR_MODE_TOGGLED',
    details: { seniorModeEnabled },
  });

  return NextResponse.json({ success: true, seniorModeEnabled });
}
