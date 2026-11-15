import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { verifyProfileAccess } from '@/lib/permissions';
import { recordDoseSchema } from '@/lib/validations';
import { recordDoseEvent } from '@/lib/doses';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validated = recordDoseSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? 'Invalid dose record data' },
      { status: 400 }
    );
  }

  const data = validated.data;
  const access = await verifyProfileAccess(session.userId, data.elderlyProfileId);

  if (!access.hasAccess || (!access.isOwner && !access.permissions.canRecordDoses)) {
    return NextResponse.json(
      { error: 'You do not have permission to record doses for this profile.' },
      { status: 403 }
    );
  }

  const userRole = access.isOwner ? 'owner' : (access.memberRecord?.role ?? 'caretaker');

  const dose = await recordDoseEvent({
    elderlyProfileId: data.elderlyProfileId,
    medicationId: data.medicationId,
    scheduledDate: data.scheduledDate,
    scheduledTime: data.scheduledTime,
    status: data.status,
    recordedByUserId: session.userId,
    recordedByName: session.name,
    recordedRole: userRole,
    notes: data.notes,
  });

  return NextResponse.json({ success: true, dose });
}
