import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { verifyProfileAccess } from '@/lib/permissions';
import { notificationPreferenceSchema } from '@/lib/validations';
import { getNotificationPreferencesCollection } from '@/lib/database/collections';
import { NotificationPreference } from '@/types';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId');

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
  }

  const access = await verifyProfileAccess(session.userId, profileId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const col = await getNotificationPreferencesCollection();
  const pref = await col.findOne({
    elderlyProfileId: profileId,
    userId: session.userId,
  });

  const defaultPref: NotificationPreference = {
    _id: `pref_${profileId}_${session.userId}`,
    elderlyProfileId: profileId,
    userId: session.userId,
    userEmail: session.email,
    userName: session.name,
    emailUpcomingDoses: true,
    emailMissedDoses: true,
    emailAppointments: true,
    emailHandoverNotes: true,
    updatedAt: new Date(),
  };

  return NextResponse.json({ preferences: pref ?? defaultPref });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validated = notificationPreferenceSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? 'Invalid preferences' },
      { status: 400 }
    );
  }

  const {
    elderlyProfileId,
    emailUpcomingDoses,
    emailMissedDoses,
    emailAppointments,
    emailHandoverNotes,
  } = validated.data;
  const access = await verifyProfileAccess(session.userId, elderlyProfileId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const col = await getNotificationPreferencesCollection();
  await col.updateOne(
    {
      elderlyProfileId,
      userId: session.userId,
    },
    {
      $set: {
        userEmail: session.email,
        userName: session.name,
        emailUpcomingDoses,
        emailMissedDoses,
        emailAppointments,
        emailHandoverNotes,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ success: true, message: 'Notification preferences updated.' });
}
