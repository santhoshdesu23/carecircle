import crypto from 'node:crypto';
import {
  getInvitationCodesCollection,
  getCareCircleMembersCollection,
  getElderlyProfilesCollection,
} from '@/lib/database/collections';
import { InvitationCode, CareCircleMember, MemberPermissions, CircleMemberRole } from '@/types';
import { logAuditEvent } from '@/lib/audit';

export function hashInvitationCode(code: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(code.trim()).digest('hex');
}

export interface GenerateInvitationParams {
  elderlyProfileId: string;
  elderlyName: string;
  role: CircleMemberRole;
  relationship?: string;
  permissions: MemberPermissions;
  createdByUserId: string;
  createdByName: string;
}

export interface GeneratedInvitationResult {
  invitationId: string;
  rawCode: string; // ONLY returned once to the creator, NEVER stored in plaintext in DB
  expiresAt: Date;
}

export async function createInvitationCode(
  params: GenerateInvitationParams
): Promise<GeneratedInvitationResult> {
  // Cryptographically secure 8-digit random integer [10000000, 99999999]
  const rawCode = crypto.randomInt(10000000, 100000000).toString();
  const salt = crypto.randomBytes(32).toString('hex');
  const codeHash = hashInvitationCode(rawCode, salt);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Strict 15 minutes expiry

  const invitationId = `inv_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const invitation: InvitationCode = {
    _id: invitationId,
    elderlyProfileId: params.elderlyProfileId,
    elderlyName: params.elderlyName,
    role: params.role,
    relationship: params.relationship,
    permissions: params.permissions,
    codeHash,
    salt,
    createdByUserId: params.createdByUserId,
    createdByName: params.createdByName,
    expiresAt,
    maxUses: 1,
    usesCount: 0,
    status: 'pending',
    failedAttempts: 0,
    createdAt: new Date(),
  };

  const col = await getInvitationCodesCollection();
  await col.insertOne(invitation as any);

  await logAuditEvent({
    elderlyProfileId: params.elderlyProfileId,
    actorUserId: params.createdByUserId,
    actorName: params.createdByName,
    actorEmail: '',
    action: 'INVITATION_GENERATED',
    details: {
      invitationId,
      role: params.role,
      expiresAt,
    },
  });

  return {
    invitationId,
    rawCode,
    expiresAt,
  };
}

export interface RedeemInvitationResult {
  success: boolean;
  message: string;
  profileId?: string;
  role?: CircleMemberRole;
}

export async function redeemInvitationCode(
  rawCode: string,
  joiningUser: { id: string; name: string; email: string }
): Promise<RedeemInvitationResult> {
  const col = await getInvitationCodesCollection();
  const now = new Date();

  // Find all pending invitations
  const pendingInvitations = await col
    .find({
      status: 'pending',
      usesCount: { $lt: 1 },
    })
    .toArray();

  if (pendingInvitations.length === 0) {
    return {
      success: false,
      message: 'Invalid or expired invitation code. Please request a new code.',
    };
  }

  // Filter out expired in application logic (not relying solely on MongoDB TTL)
  const expiredInvitations = pendingInvitations.filter((inv) => inv.expiresAt <= now);
  if (expiredInvitations.length > 0) {
    col
      .updateMany(
        { _id: { $in: expiredInvitations.map((inv) => inv._id) } },
        { $set: { status: 'expired' } }
      )
      .catch((_err) => {
        // Expected: background expiration cleanup, failures are non-blocking
      });
  }

  const validInvitations = pendingInvitations.filter((inv) => inv.expiresAt > now);

  if (validInvitations.length === 0) {
    return {
      success: false,
      message: 'This invitation code has expired. Codes are only valid for 15 minutes.',
    };
  }

  // Revoke any invitations exceeding maximum failed attempts (5)
  const excessiveAttempts = validInvitations.filter((inv) => inv.failedAttempts >= 5);
  if (excessiveAttempts.length > 0) {
    await col.updateMany(
      { _id: { $in: excessiveAttempts.map((inv) => inv._id) } },
      { $set: { status: 'revoked' } }
    );
  }

  const eligibleInvitations = validInvitations.filter((inv) => inv.failedAttempts < 5);

  // Find matching invitation by computing hash with each invitation's salt
  let matchedInvitation: InvitationCode | null = null;
  for (const inv of eligibleInvitations) {
    const testHash = hashInvitationCode(rawCode, inv.salt);
    if (crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(inv.codeHash))) {
      matchedInvitation = inv;
      break;
    }
  }

  if (!matchedInvitation) {
    // Increment failed attempts on all active pending invitations to thwart automated brute-force spray
    await col.updateMany(
      { status: 'pending', expiresAt: { $gt: now } },
      { $inc: { failedAttempts: 1 } }
    );

    return {
      success: false,
      message: 'Invalid invitation code. Please verify the code and try again.',
    };
  }

  // Check if user is already an active member of this circle or profile owner
  const profilesCol = await getElderlyProfilesCollection();
  const profile = await profilesCol.findOne({ _id: matchedInvitation.elderlyProfileId });
  if (!profile) {
    return { success: false, message: 'Elderly profile no longer exists.' };
  }

  if (profile.ownerUserId === joiningUser.id) {
    return {
      success: false,
      message: 'You are already the owner of this Care Circle.',
    };
  }

  const membersCol = await getCareCircleMembersCollection();
  const existingMember = await membersCol.findOne({
    elderlyProfileId: matchedInvitation.elderlyProfileId,
    userId: joiningUser.id,
    status: 'active',
  });

  if (existingMember) {
    return {
      success: false,
      message: 'You are already an active member of this Care Circle.',
    };
  }

  // Atomically update invitation status to prevent race conditions (single-use constraint)
  const updateResult = await col.updateOne(
    {
      _id: matchedInvitation._id,
      status: 'pending',
      usesCount: 0,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: 'used',
        usedByUserId: joiningUser.id,
        usedAt: new Date(),
      },
      $inc: {
        usesCount: 1,
      },
    }
  );

  if (updateResult.modifiedCount === 0) {
    return {
      success: false,
      message: 'This invitation code has already been redeemed or expired.',
    };
  }

  // Add user to CareCircleMembers
  const newMemberId = `mem_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const newMember: CareCircleMember = {
    _id: newMemberId,
    elderlyProfileId: matchedInvitation.elderlyProfileId,
    userId: joiningUser.id,
    userEmail: joiningUser.email,
    userName: joiningUser.name,
    role: matchedInvitation.role,
    relationshipToElderly:
      matchedInvitation.relationship ||
      (matchedInvitation.role === 'caretaker' ? 'Caretaker' : 'Family Member'),
    permissions: matchedInvitation.permissions,
    status: 'active',
    invitedByUserId: matchedInvitation.createdByUserId,
    joinedAt: new Date(),
    updatedAt: new Date(),
  };

  await membersCol.insertOne(newMember as any);

  // Log audit event
  await logAuditEvent({
    elderlyProfileId: matchedInvitation.elderlyProfileId,
    actorUserId: joiningUser.id,
    actorName: joiningUser.name,
    actorEmail: joiningUser.email,
    action: 'MEMBER_JOINED_VIA_PASSCODE',
    details: {
      role: matchedInvitation.role,
      invitedBy: matchedInvitation.createdByUserId,
      invitationId: matchedInvitation._id,
    },
  });

  return {
    success: true,
    message: `Successfully joined ${matchedInvitation.elderlyName}'s Care Circle!`,
    profileId: matchedInvitation.elderlyProfileId,
    role: matchedInvitation.role,
  };
}

export async function revokeInvitation(
  invitationId: string,
  revokedByUserId: string,
  revokedByName: string
): Promise<boolean> {
  const col = await getInvitationCodesCollection();
  const invitation = await col.findOne({ _id: invitationId });
  if (!invitation || invitation.status !== 'pending') return false;

  await col.updateOne(
    { _id: invitationId },
    { $set: { status: 'revoked', updatedAt: new Date() } }
  );

  await logAuditEvent({
    elderlyProfileId: invitation.elderlyProfileId,
    actorUserId: revokedByUserId,
    actorName: revokedByName,
    actorEmail: '',
    action: 'INVITATION_REVOKED',
    details: { invitationId },
  });

  return true;
}
