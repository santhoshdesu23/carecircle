import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSession } from '@/lib/auth/session';
import { elderlyProfileSchema } from '@/lib/validations';
import {
  getElderlyProfilesCollection,
  getCareCircleMembersCollection,
} from '@/lib/database/collections';
import { ElderlyProfile, CareCircleMember } from '@/types';
import { logAuditEvent } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membersCol = await getCareCircleMembersCollection();
  const memberships = await membersCol.find({ userId: session.userId, status: 'active' }).toArray();

  const profileIds = memberships.map((m) => m.elderlyProfileId);

  const profilesCol = await getElderlyProfilesCollection();
  const profiles = await profilesCol
    .find({
      $or: [{ ownerUserId: session.userId }, { _id: { $in: profileIds } }],
    })
    .toArray();

  return NextResponse.json({ profiles });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validated = elderlyProfileSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? 'Invalid profile information' },
      { status: 400 }
    );
  }

  const profileId = `prof_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const profile: ElderlyProfile = {
    _id: profileId,
    ownerUserId: session.userId,
    fullName: validated.data.fullName,
    preferredName: validated.data.preferredName || validated.data.fullName.split(' ')[0],
    dateOfBirth: validated.data.dateOfBirth,
    gender: validated.data.gender,
    emergencyContact: {
      name: validated.data.emergencyContact.name,
      relationship: validated.data.emergencyContact.relationship,
      phoneNumber: validated.data.emergencyContact.phoneNumber,
      email: validated.data.emergencyContact.email,
    },
    notes: validated.data.notes,
    timezone: validated.data.timezone || 'UTC',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profilesCol = await getElderlyProfilesCollection();
  await profilesCol.insertOne(profile as any);

  // Add owner to care circle members
  const membersCol = await getCareCircleMembersCollection();
  const ownerMember: CareCircleMember = {
    _id: `mem_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
    elderlyProfileId: profileId,
    userId: session.userId,
    userEmail: session.email,
    userName: session.name,
    role: 'owner',
    permissions: {
      canManageMedications: true,
      canRecordDoses: true,
      canManageAppointments: true,
      canViewTimeline: true,
      canInviteMembers: true,
      canLeaveNotes: true,
    },
    status: 'active',
    invitedByUserId: session.userId,
    joinedAt: new Date(),
    updatedAt: new Date(),
  };
  await membersCol.insertOne(ownerMember as any);

  await logAuditEvent({
    elderlyProfileId: profileId,
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'PROFILE_CREATED',
    details: { fullName: profile.fullName },
  });

  return NextResponse.json({ success: true, profile }, { status: 201 });
}
