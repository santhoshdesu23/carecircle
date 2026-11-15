import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createInvitationSchema } from '@/lib/validations';
import { verifyProfileAccess } from '@/lib/permissions';
import { createInvitationCode } from '@/lib/invitations';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validated = createInvitationSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? 'Invalid invitation parameters' },
      { status: 400 }
    );
  }

  const { elderlyProfileId, role, relationship, permissions } = validated.data;

  // Authorization check: Only owner or members with `canInviteMembers` permission
  const access = await verifyProfileAccess(session.userId, elderlyProfileId);
  if (!access.hasAccess || (!access.isOwner && !access.permissions.canInviteMembers)) {
    return NextResponse.json(
      { error: 'You do not have permission to invite new members to this Care Circle.' },
      { status: 403 }
    );
  }

  const result = await createInvitationCode({
    elderlyProfileId,
    elderlyName: access.profile?.preferredName ?? access.profile?.fullName ?? 'Elderly Individual',
    role,
    relationship,
    permissions,
    createdByUserId: session.userId,
    createdByName: session.name,
  });

  return NextResponse.json({
    success: true,
    passcode: result.rawCode,
    expiresAt: result.expiresAt,
    invitationId: result.invitationId,
  });
}
