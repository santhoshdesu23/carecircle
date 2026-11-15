import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { verifyProfileAccess } from '@/lib/permissions';
import { syncDosesForDate } from '@/lib/doses';
import { getTodayDateString } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId');
  const date = searchParams.get('date') || getTodayDateString();

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
  }

  const access = await verifyProfileAccess(session.userId, profileId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const doses = await syncDosesForDate(profileId, date);

  return NextResponse.json({
    date,
    doses,
    canRecordDoses: access.isOwner || access.permissions.canRecordDoses,
  });
}
