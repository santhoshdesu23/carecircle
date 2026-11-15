import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { verifyProfileAccess } from '@/lib/permissions';
import { getElderlyProfilesCollection } from '@/lib/database/collections';
import { elderlyProfileSchema } from '@/lib/validations';
import { logAuditEvent } from '@/lib/audit';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await verifyProfileAccess(session.userId, profileId);
  if (!access.hasAccess || !access.profile) {
    return NextResponse.json({ error: 'Profile not found or access denied.' }, { status: 403 });
  }

  return NextResponse.json({
    profile: access.profile,
    isOwner: access.isOwner,
    permissions: access.permissions,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await verifyProfileAccess(session.userId, profileId);
  if (!access.hasAccess || !access.isOwner) {
    return NextResponse.json(
      { error: 'Only the profile owner can modify profile settings.' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validated = elderlyProfileSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? 'Invalid profile information' },
      { status: 400 }
    );
  }

  const profilesCol = await getElderlyProfilesCollection();
  await profilesCol.updateOne(
    { _id: profileId },
    {
      $set: {
        fullName: validated.data.fullName,
        preferredName: validated.data.preferredName,
        dateOfBirth: validated.data.dateOfBirth,
        gender: validated.data.gender,
        emergencyContact: validated.data.emergencyContact,
        notes: validated.data.notes,
        timezone: validated.data.timezone,
        updatedAt: new Date(),
      },
    }
  );

  await logAuditEvent({
    elderlyProfileId: profileId,
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'PROFILE_UPDATED',
    details: { fullName: validated.data.fullName },
  });

  return NextResponse.json({ success: true, message: 'Profile updated successfully.' });
}
