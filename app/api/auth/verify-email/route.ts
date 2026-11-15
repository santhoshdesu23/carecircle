import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getUsersCollection } from '@/lib/database/collections';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

  if (!token || !email) {
    return NextResponse.redirect(`${appUrl}/signin?error=invalid_verification_request`);
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const usersCol = await getUsersCollection();
    const user = await usersCol.findOne({ email: normalizedEmail });

    if (!user) {
      return NextResponse.redirect(`${appUrl}/signin?error=user_not_found`);
    }

    if (user.emailVerified) {
      return NextResponse.redirect(`${appUrl}/dashboard?verified=already`);
    }

    if (!user.emailVerificationToken || user.emailVerificationToken !== tokenHash) {
      return NextResponse.redirect(`${appUrl}/signin?error=invalid_verification_token`);
    }

    if (user.emailVerificationExpires && new Date() > new Date(user.emailVerificationExpires)) {
      return NextResponse.redirect(`${appUrl}/signin?error=verification_token_expired`);
    }

    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerified: true,
          status: 'active',
          emailVerificationToken: null,
          emailVerificationExpires: null,
          updatedAt: new Date(),
        },
      }
    );

    await logAuditEvent({
      actorUserId: user._id,
      actorName: user.name,
      actorEmail: user.email,
      action: 'EMAIL_VERIFIED',
      details: { verifiedAt: new Date() },
    });

    return NextResponse.redirect(`${appUrl}/dashboard?verified=true`);
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(`${appUrl}/signin?error=verification_failed`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, email } = body;

    if (!token || !email) {
      return NextResponse.json(
        { error: 'Verification token and email are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const tokenHash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');

    const usersCol = await getUsersCollection();
    const user = await usersCol.findOne({ email: normalizedEmail });

    if (!user) {
      return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Account email is already verified.',
      });
    }

    if (!user.emailVerificationToken || user.emailVerificationToken !== tokenHash) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token.' },
        { status: 400 }
      );
    }

    if (user.emailVerificationExpires && new Date() > new Date(user.emailVerificationExpires)) {
      return NextResponse.json(
        { error: 'Verification token has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerified: true,
          status: 'active',
          emailVerificationToken: null,
          emailVerificationExpires: null,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Email address successfully verified.',
    });
  } catch (error) {
    console.error('Email verification API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during email verification.' },
      { status: 500 }
    );
  }
}
