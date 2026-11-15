import {
  getElderlyProfilesCollection,
  getCareCircleMembersCollection,
} from '@/lib/database/collections';
import { CareCircleMember, ElderlyProfile, MemberPermissions } from '@/types';

export interface ProfileAccessResult {
  hasAccess: boolean;
  isOwner: boolean;
  memberRecord?: CareCircleMember;
  profile?: ElderlyProfile;
  permissions: MemberPermissions;
  reason?: string;
}

export const OWNER_PERMISSIONS: MemberPermissions = {
  canManageMedications: true,
  canRecordDoses: true,
  canManageAppointments: true,
  canViewTimeline: true,
  canInviteMembers: true,
  canLeaveNotes: true,
};

export const NO_PERMISSIONS: MemberPermissions = {
  canManageMedications: false,
  canRecordDoses: false,
  canManageAppointments: false,
  canViewTimeline: false,
  canInviteMembers: false,
  canLeaveNotes: false,
};

export async function verifyProfileAccess(
  userId: string,
  elderlyProfileId: string
): Promise<ProfileAccessResult> {
  const profilesCol = await getElderlyProfilesCollection();
  const profile = await profilesCol.findOne({ _id: elderlyProfileId });

  if (!profile) {
    return {
      hasAccess: false,
      isOwner: false,
      permissions: NO_PERMISSIONS,
      reason: 'Elderly profile not found',
    };
  }

  // Check if user is the direct owner / elderly individual
  if (profile.ownerUserId === userId) {
    return {
      hasAccess: true,
      isOwner: true,
      profile,
      permissions: OWNER_PERMISSIONS,
    };
  }

  // Check if user is an active care circle member
  const membersCol = await getCareCircleMembersCollection();
  const member = await membersCol.findOne({
    elderlyProfileId,
    userId,
    status: 'active',
  });

  if (!member) {
    return {
      hasAccess: false,
      isOwner: false,
      permissions: NO_PERMISSIONS,
      reason: 'User is not an authorized member of this Care Circle',
    };
  }

  return {
    hasAccess: true,
    isOwner: false,
    profile,
    memberRecord: member,
    permissions: member.permissions,
  };
}
