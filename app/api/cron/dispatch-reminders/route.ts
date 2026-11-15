import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { runReminderDispatcher } from '@/lib/reminders/dispatcher';

const DEFAULT_DEV_CRON_SECRET = 'carecircle_cron_secure_token_development';

export async function GET(req: NextRequest) {
  return handleDispatch(req);
}

export async function POST(req: NextRequest) {
  return handleDispatch(req);
}

async function handleDispatch(req: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cronSecret = process.env.CRON_SECRET;

  if (isProduction) {
    if (!cronSecret || cronSecret === DEFAULT_DEV_CRON_SECRET || cronSecret.length < 16) {
      console.error(
        'SECURITY VIOLATION: Production cron invoked but CRON_SECRET is missing or using an insecure default.'
      );
      return NextResponse.json(
        {
          error: 'Server security misconfiguration: CRON_SECRET is not configured for production.',
        },
        { status: 500 }
      );
    }
  }

  const effectiveSecret = cronSecret ?? DEFAULT_DEV_CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const expectedBearer = `Bearer ${effectiveSecret}`;

  // Constant-time comparison to prevent timing attacks on cron secret
  if (!authHeader) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing or invalid Vercel Cron authorization token.' },
      { status: 401 }
    );
  }

  const authBuffer = Buffer.from(authHeader);
  const expectedBuffer = Buffer.from(expectedBearer);
  if (
    authBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(authBuffer, expectedBuffer)
  ) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing or invalid Vercel Cron authorization token.' },
      { status: 401 }
    );
  }

  const summary = await runReminderDispatcher();
  return NextResponse.json({
    success: true,
    triggeredBy: 'vercel_cron',
    summary,
  });
}
