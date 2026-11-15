import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { signUpSchema } from '@/lib/validations';
import {
  getUsersCollection,
  getElderlyProfilesCollection,
  getCareCircleMembersCollection,
} from '@/lib/database/collections';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/auth/rate-limiter';
import { ensureDatabaseIndexes } from '@/lib/database/indexes';
import { classifyMongoError } from '@/lib/database/client';
import { sendAccountVerificationEmail } from '@/lib/email';
import { logAuditEvent } from '@/lib/audit';
import { User, ElderlyProfile, CareCircleMember } from '@/types';

export async function POST(req: NextRequest) {
  const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  try {
    // 1. Rate Limiting Check
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const rateLimit = await checkRateLimit(`signup_${ip}`, 10, 900);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many signup attempts. Please try again later.',
          requestId,
        },
        { status: 429 }
      );
    }

    // 2. Request Body Parsing & Zod Validation
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request payload.', requestId },
        { status: 400 }
      );
    }

    const validated = signUpSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: validated.error.issues[0]?.message ?? 'Invalid input data',
          details: validated.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
          requestId,
        },
        { status: 400 }
      );
    }

    const { name, email, password, role } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 3. Database Index Assurance & Connection Verification
    await ensureDatabaseIndexes();

    const usersCol = await getUsersCollection();
    const existing = await usersCol.findOne({ email: normalizedEmail });

    // 4. Existing Account State Machine & Recovery Handling
    if (existing) {
      // Scenario A: Account already verified / active
      if (existing.emailVerified || existing.status === 'active') {
        return NextResponse.json(
          {
            error: 'An account with this email address already exists. Please sign in.',
            requestId,
          },
          { status: 409 }
        );
      }

      // Scenario B: Account is disabled by administration
      if (existing.status === 'disabled') {
        return NextResponse.json(
          {
            error: 'This account has been disabled. Please contact support.',
            requestId,
          },
          { status: 403 }
        );
      }

      // Scenario C: Account pending verification - allow recovery if credentials match
      const passwordMatches = await verifyPassword(password, existing.passwordHash);
      if (passwordMatches) {
        const rawVerificationToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await usersCol.updateOne(
          { _id: existing._id },
          {
            $set: {
              emailVerificationToken: tokenHash,
              emailVerificationExpires: tokenExpires,
              updatedAt: new Date(),
            },
          }
        );

        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
        const verificationUrl = `${appUrl}/api/auth/verify-email?token=${rawVerificationToken}&email=${encodeURIComponent(normalizedEmail)}`;

        let emailResStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
        let emailError: string | undefined = undefined;

        try {
          const emailRes = await sendAccountVerificationEmail({
            to: normalizedEmail,
            name: existing.name,
            verificationUrl,
            userId: existing._id,
            expiresInMinutes: 1440,
          });
          emailResStatus = emailRes.status;
          if (!emailRes.success && emailRes.status === 'failed') {
            emailError = emailRes.error;
          }
        } catch (err: unknown) {
          console.warn(`[Signup ${requestId}] Brevo verification resend failed:`, err);
          emailResStatus = 'failed';
          emailError = err instanceof Error ? err.message : 'Email delivery failure';
        }

        return NextResponse.json({
          success: true,
          status: 'pending_verification',
          message:
            emailResStatus === 'sent'
              ? 'Your account is pending verification. A fresh verification email has been sent.'
              : emailResStatus === 'skipped'
                ? 'Your account is pending verification (development email simulated).'
                : 'Your account is pending verification, but email delivery encountered an issue. You can resend anytime.',
          requiresVerification: true,
          emailDelivery: {
            status: emailResStatus,
            ...(emailError ? { error: emailError } : {}),
          },
          user: {
            id: existing._id,
            name: existing.name,
            email: existing.email,
            role: existing.defaultRole,
            status: 'pending_verification',
            emailVerified: false,
          },
          requestId,
        });
      }

      // Password did not match existing unverified account
      return NextResponse.json(
        {
          error:
            'An account with this email address already exists. Please sign in or reset your password.',
          requestId,
        },
        { status: 409 }
      );
    }

    // 5. Creation of Brand New User
    const passwordHash = await hashPassword(password);
    const userId = `usr_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let activeProfileId: string | undefined = undefined;

    // Automatically initialize healthcare profile for elderly individual role
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
      emailVerified: false,
      status: 'pending_verification',
      emailVerificationToken: tokenHash,
      emailVerificationExpires: tokenExpires,
      defaultRole: role,
      seniorModeEnabled: role === 'elderly',
      activeProfileId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await usersCol.insertOne(newUser as any);

    // 6. Safe Brevo Transactional Email Dispatch
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const verificationUrl = `${appUrl}/api/auth/verify-email?token=${rawVerificationToken}&email=${encodeURIComponent(normalizedEmail)}`;

    let emailDeliveryStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
    let emailDeliveryError: string | undefined = undefined;

    try {
      const emailRes = await sendAccountVerificationEmail({
        to: normalizedEmail,
        name,
        verificationUrl,
        userId,
        expiresInMinutes: 1440,
      });
      emailDeliveryStatus = emailRes.status;
      if (!emailRes.success && emailRes.status === 'failed') {
        emailDeliveryError = emailRes.error;
      }
    } catch (emailErr: unknown) {
      console.warn(`[Signup ${requestId}] Brevo verification email dispatch failed:`, emailErr);
      emailDeliveryStatus = 'failed';
      emailDeliveryError =
        emailErr instanceof Error ? emailErr.message : 'Provider delivery failure';
    }

    // 7. Establish Authorized Session Cookie
    await setSessionCookie({
      userId,
      email: normalizedEmail,
      name,
      role,
      seniorModeEnabled: role === 'elderly',
      activeProfileId,
    });

    // 8. Audit Logging
    await logAuditEvent({
      actorUserId: userId,
      actorName: name,
      actorEmail: normalizedEmail,
      action: 'USER_REGISTERED',
      details: { role, autoCreatedProfileId: activeProfileId, emailDeliveryStatus },
    });

    return NextResponse.json(
      {
        success: true,
        status: 'pending_verification',
        message:
          emailDeliveryStatus === 'sent'
            ? 'Account created successfully. Please check your email to verify your address.'
            : emailDeliveryStatus === 'skipped'
              ? 'Account created successfully (development email simulated).'
              : 'Account created. We encountered an issue delivering your verification email, but you can request a new one anytime.',
        requiresVerification: true,
        emailDelivery: {
          status: emailDeliveryStatus,
          ...(emailDeliveryError ? { error: emailDeliveryError } : {}),
        },
        user: {
          id: userId,
          name,
          email: normalizedEmail,
          role,
          seniorModeEnabled: role === 'elderly',
          activeProfileId,
          status: 'pending_verification',
          emailVerified: false,
        },
        requestId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const isDbError =
      (error as any)?.name === 'MongoServerSelectionError' ||
      (error as any)?.code === 'ENOTFOUND' ||
      (error as any)?.name === 'MongoNetworkError' ||
      (error as any)?.name === 'MongoTimeoutError' ||
      (error as any)?.name === 'MongoServerError' ||
      (error as any)?.message?.includes('querySrv') ||
      (error as any)?.message?.includes('ECONNREFUSED') ||
      (error as any)?.message?.includes('Index creation failed');

    if (isDbError) {
      const classified = classifyMongoError(error);
      console.error(
        `[Signup ${requestId}] Database Error [${classified.kind}]: ${classified.diagnosticMessage}`
      );
      return NextResponse.json(
        {
          error: classified.userSafeMessage,
          code: classified.kind,
          requestId,
        },
        { status: classified.statusCode }
      );
    }

    if ((error as any)?.code === 11000) {
      return NextResponse.json(
        {
          error: 'An account with this email address already exists. Please sign in.',
          requestId,
        },
        { status: 409 }
      );
    }

    console.error(`[Signup ${requestId}] Unexpected internal error:`, error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred during signup.',
        requestId,
      },
      { status: 500 }
    );
  }
}
