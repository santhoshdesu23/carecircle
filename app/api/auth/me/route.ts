import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getUsersCollection,
  getElderlyProfilesCollection,
  getCareCircleMembersCollection,
} from '@/lib/database/collections';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const usersCol = await getUsersCollection();
  const user = await usersCol.findOne({ _id: session.userId });

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  // Get all profiles the user has access to
  const membersCol = await getCareCircleMembersCollection();
  const memberships = await membersCol.find({ userId: session.userId, status: 'active' }).toArray();

  const profileIds = memberships.map((m) => m.elderlyProfileId);

  const profilesCol = await getElderlyProfilesCollection();
  const authorizedProfiles = await profilesCol
    .find({
      $or: [{ ownerUserId: session.userId }, { _id: { $in: profileIds } }],
    })
    .toArray();

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.defaultRole,
      seniorModeEnabled: !!user.seniorModeEnabled,
      activeProfileId: session.activeProfileId || authorizedProfiles[0]?._id,
      authorizedProfiles: authorizedProfiles.map((p) => ({
        id: p._id,
        fullName: p.fullName,
        preferredName: p.preferredName,
        isOwner: p.ownerUserId === user._id,
      })),
    },
  });
}
