import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { processReminderEvent, ScheduleEventPayload } from '@/lib/schedules';

const DEFAULT_DEV_CRON_SECRET = 'carecircle_cron_secure_token_development';

export async function POST(req: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cronSecret = process.env.CRON_SECRET;

  if (isProduction) {
    if (!cronSecret || cronSecret === DEFAULT_DEV_CRON_SECRET || cronSecret.length < 16) {
      console.error(
        'SECURITY VIOLATION: Production schedule handler invoked but CRON_SECRET is missing or insecure.'
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
  const oidcHeader = req.headers.get('x-vercel-oidc-token');

  if (isProduction && !authHeader && !oidcHeader) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing schedule trigger token' },
      { status: 401 }
    );
  }

  if (authHeader) {
    const expectedBearer = `Bearer ${effectiveSecret}`;
    const authBuffer = Buffer.from(authHeader);
    const expectedBuffer = Buffer.from(expectedBearer);

    if (
      authBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(authBuffer, expectedBuffer)
    ) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid schedule bearer secret' },
        { status: 401 }
      );
    }
  }

  try {
    const payload = (await req.json()) as ScheduleEventPayload;
    if (!payload || !payload.type) {
      return NextResponse.json({ error: 'Invalid schedule payload' }, { status: 400 });
    }

    const result = await processReminderEvent(payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing schedule event:', error);
    return NextResponse.json({ error: 'Internal schedule dispatch error' }, { status: 500 });
  }
}
