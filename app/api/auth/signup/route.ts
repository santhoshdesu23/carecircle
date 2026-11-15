import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { signUpSchema } from '@/lib/validations';
import {
  getUsersCollection,
  getElderlyProfilesCollection,
  getCareCircleMembersCollection,
} from '@/lib/database/collections';
import { hashPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/auth/rate-limiter';
import { ensureDatabaseIndexes } from '@/lib/database/indexes';
import { logAuditEvent } from '@/lib/audit';
import { User, ElderlyProfile, CareCircleMember } from '@/types';

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseIndexes();

    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rateLimit = await checkRateLimit(`signup_${ip}`, 10, 900);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validated = signUpSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.issues[0]?.message ?? 'Invalid input data' },
        { status: 400 }
      );
    }

    const { name, email, password, role } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();

    const usersCol = await getUsersCollection();
    const existing = await usersCol.findOne({ email: normalizedEmail });

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const userId = `usr_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    let activeProfileId: string | undefined = undefined;

    // If user signs up as elderly individual, automatically create their initial healthcare profile
    if (role === 'elderly') {
      const profilesCol = await getElderlyProfilesCollection();
      const profileId = `prof_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const profile: ElderlyProfile = {
        _id: profileId,
        ownerUserId: userId,
        fullName: name,
        preferredName: name.split(' ')[0],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        emergencyContact: {
          name: '',
          relationship: '',
          phoneNumber: '',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await profilesCol.insertOne(profile as any);

      // Create owner member record
      const membersCol = await getCareCircleMembersCollection();
      const ownerMember: CareCircleMember = {
        _id: `mem_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
        elderlyProfileId: profileId,
        userId,
        userEmail: normalizedEmail,
        userName: name,
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
        invitedByUserId: userId,
        joinedAt: new Date(),
        updatedAt: new Date(),
      };
      await membersCol.insertOne(ownerMember as any);
      activeProfileId = profileId;
    }

    const newUser: User = {
      _id: userId,
      name,
      email: normalizedEmail,
      passwordHash,
      emailVerified: true, // Auto-verified for seamless demonstration
      defaultRole: role,
      seniorModeEnabled: role === 'elderly',
      activeProfileId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await usersCol.insertOne(newUser as any);

    await setSessionCookie({
      userId,
      email: normalizedEmail,
      name,
      role,
      seniorModeEnabled: role === 'elderly',
      activeProfileId,
    });

    await logAuditEvent({
      actorUserId: userId,
      actorName: name,
      actorEmail: normalizedEmail,
      action: 'USER_REGISTERED',
      details: { role, autoCreatedProfileId: activeProfileId },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        name,
        email: normalizedEmail,
        role,
        seniorModeEnabled: role === 'elderly',
        activeProfileId,
      },
    });
  } catch (error: unknown) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during signup.' },
      { status: 500 }
    );
  }
}
