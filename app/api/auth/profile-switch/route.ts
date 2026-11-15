import { NextRequest, NextResponse } from 'next/server';
import { getSession, setSessionCookie } from '@/lib/auth/session';
import { getUsersCollection } from '@/lib/database/collections';
import { verifyProfileAccess } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { profileId } = await req.json();
  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
  }

  const access = await verifyProfileAccess(session.userId, profileId);
  if (!access.hasAccess) {
    return NextResponse.json(
      { error: 'You are not authorized to view this profile' },
      { status: 403 }
    );
  }

  await setSessionCookie({
    ...session,
    activeProfileId: profileId,
  });

  const usersCol = await getUsersCollection();
  await usersCol.updateOne(
    { _id: session.userId },
    { $set: { activeProfileId: profileId, updatedAt: new Date() } }
  );

  return NextResponse.json({ success: true, activeProfileId: profileId });
}
