import { NextRequest, NextResponse } from 'next/server';
import { getSession, setSessionCookie } from '@/lib/auth/session';
import { redeemInvitationSchema } from '@/lib/validations';
import { redeemInvitationCode } from '@/lib/invitations';
import { checkRateLimit } from '@/lib/auth/rate-limiter';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'You must be signed in to redeem an invitation code.' },
      { status: 401 }
    );
  }

  // Rate limit invitation attempts: 5 per 15 minutes per user/IP
  const ip = req.headers.get('x-forwarded-for') || 'local';
  const rateLimit = await checkRateLimit(`redeem_${session.userId}_${ip}`, 5, 900);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many incorrect attempts. Please wait 15 minutes before trying again.' },
      { status: 429 }
    );
  }

  const body = await req.json();
  const validated = redeemInvitationSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? 'Please enter an 8-digit numeric code.' },
      { status: 400 }
    );
  }

  const result = await redeemInvitationCode(validated.data.code, {
    id: session.userId,
    name: session.name,
    email: session.email,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  // Switch active profile to the newly joined profile
  if (result.profileId) {
    await setSessionCookie({
      ...session,
      activeProfileId: result.profileId,
    });
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    profileId: result.profileId,
  });
}
