import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { verifyProfileAccess } from '@/lib/permissions';
import { getAuditLogsCollection } from '@/lib/database/collections';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId');
  const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '50', 10), 100);

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
  }

  const access = await verifyProfileAccess(session.userId, profileId);
  if (!access.hasAccess || (!access.isOwner && !access.permissions.canViewTimeline)) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const col = await getAuditLogsCollection();
  const events = await col
    .find({ elderlyProfileId: profileId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return NextResponse.json({ events });
}
