import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { verifyProfileAccess } from '@/lib/permissions';
import { getCareCircleMembersCollection } from '@/lib/database/collections';
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
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const membersCol = await getCareCircleMembersCollection();
  const members = await membersCol
    .find({ elderlyProfileId: profileId, status: 'active' })
    .sort({ joinedAt: 1 })
    .toArray();

  return NextResponse.json({ members, isOwner: access.isOwner });
}

export async function DELETE(
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
      { error: 'Only the profile owner can revoke member access.' },
      { status: 403 }
    );
  }

  const { memberId } = await req.json();
  if (!memberId) {
    return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
  }

  const membersCol = await getCareCircleMembersCollection();
  const memberToRevoke = await membersCol.findOne({
    _id: memberId,
    elderlyProfileId: profileId,
  });

  if (!memberToRevoke) {
    return NextResponse.json({ error: 'Member record not found.' }, { status: 404 });
  }

  if (memberToRevoke.role === 'owner') {
    return NextResponse.json({ error: 'Cannot revoke the owner account.' }, { status: 400 });
  }

  await membersCol.updateOne(
    { _id: memberId },
    { $set: { status: 'revoked', updatedAt: new Date() } }
  );

  await logAuditEvent({
    elderlyProfileId: profileId,
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'MEMBER_REVOKED',
    details: {
      revokedMemberId: memberId,
      revokedUserName: memberToRevoke.userName,
      revokedUserEmail: memberToRevoke.userEmail,
      revokedRole: memberToRevoke.role,
    },
  });

  return NextResponse.json({ success: true, message: 'Member access revoked.' });
}
