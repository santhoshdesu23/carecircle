import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { verifyProfileAccess } from '@/lib/permissions';
import { calculateAdherenceStats } from '@/lib/doses';
import { getDoseLogsCollection } from '@/lib/database/collections';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId');
  const days = Number.parseInt(searchParams.get('days') ?? '7', 10);

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
  }

  const access = await verifyProfileAccess(session.userId, profileId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const stats = await calculateAdherenceStats(profileId, days);

  // Also get day-by-day trend data for the chart
  const doseLogsCol = await getDoseLogsCollection();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const recentDoses = await doseLogsCol
    .find({
      elderlyProfileId: profileId,
      scheduledDate: { $gte: startStr, $lte: endStr },
    })
    .sort({ scheduledDate: 1 })
    .toArray();

  const dailyMap: Record<string, { date: string; taken: number; missed: number; skipped: number }> =
    {};

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    dailyMap[dStr] = {
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
      taken: 0,
      missed: 0,
      skipped: 0,
    };
  }

  for (const dose of recentDoses) {
    if (dailyMap[dose.scheduledDate]) {
      if (dose.status === 'taken') dailyMap[dose.scheduledDate].taken++;
      else if (dose.status === 'missed') dailyMap[dose.scheduledDate].missed++;
      else if (dose.status === 'skipped') dailyMap[dose.scheduledDate].skipped++;
    }
  }

  const chartData = Object.values(dailyMap);

  return NextResponse.json({
    stats,
    chartData,
  });
}
