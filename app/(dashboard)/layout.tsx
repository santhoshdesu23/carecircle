import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import {
  getUsersCollection,
  getElderlyProfilesCollection,
  getCareCircleMembersCollection,
} from '@/lib/database/collections';
import { Navbar } from '@/components/layout/Navbar';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  if (!session) {
    redirect('/signin');
  }

  const usersCol = await getUsersCollection();
  const user = await usersCol.findOne({ _id: session.userId });

  if (!user) {
    redirect('/signin');
  }

  // Get authorized profiles
  const membersCol = await getCareCircleMembersCollection();
  const memberships = await membersCol.find({ userId: session.userId, status: 'active' }).toArray();

  const profileIds = memberships.map((m) => m.elderlyProfileId);

  const profilesCol = await getElderlyProfilesCollection();
  const authorizedProfiles = await profilesCol
    .find({
      $or: [{ ownerUserId: session.userId }, { _id: { $in: profileIds } }],
    })
    .toArray();

  const navbarUser = {
    name: user.name,
    email: user.email,
    role: user.defaultRole,
    activeProfileId: session.activeProfileId || authorizedProfiles[0]?._id,
    authorizedProfiles: authorizedProfiles.map((p) => ({
      id: p._id,
      fullName: p.fullName,
      preferredName: p.preferredName,
      isOwner: p.ownerUserId === user._id,
    })),
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F6]">
      <Navbar user={navbarUser} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
