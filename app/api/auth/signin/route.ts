import { NextRequest, NextResponse } from 'next/server';
import { signInSchema } from '@/lib/validations';
import { getUsersCollection, getCareCircleMembersCollection } from '@/lib/database/collections';
import { verifyPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/auth/rate-limiter';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rateLimit = await checkRateLimit(`signin_${ip}`, 10, 900);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many signin attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validated = signInSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Please provide valid credentials.' }, { status: 400 });
    }

    const { email, password } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();

    const usersCol = await getUsersCollection();
    const user = await usersCol.findOne({ email: normalizedEmail });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Determine active profile ID
    let activeProfileId = user.activeProfileId;
    if (!activeProfileId) {
      const membersCol = await getCareCircleMembersCollection();
      const firstMembership = await membersCol.findOne({
        userId: user._id,
        status: 'active',
      });
      if (firstMembership) {
        activeProfileId = firstMembership.elderlyProfileId;
      }
    }

    await setSessionCookie({
      userId: user._id,
      email: user.email,
      name: user.name,
      role: user.defaultRole,
      seniorModeEnabled: !!user.seniorModeEnabled,
      activeProfileId,
    });

    await logAuditEvent({
      actorUserId: user._id,
      actorName: user.name,
      actorEmail: user.email,
      action: 'USER_SIGNED_IN',
      details: { role: user.defaultRole },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.defaultRole,
        seniorModeEnabled: !!user.seniorModeEnabled,
        activeProfileId,
      },
    });
  } catch (error: unknown) {
    console.error('Signin error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during signin.' },
      { status: 500 }
    );
  }
}
