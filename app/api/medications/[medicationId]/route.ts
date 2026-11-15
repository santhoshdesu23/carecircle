import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { verifyProfileAccess } from '@/lib/permissions';
import { getMedicationsCollection } from '@/lib/database/collections';
import { medicationSchema } from '@/lib/validations';
import { logAuditEvent } from '@/lib/audit';
import { cancelPendingDosesForMedication } from '@/lib/doses';
import { scheduleMedicationTimeSlots, cancelMedicationSchedules } from '@/lib/schedules';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ medicationId: string }> }
) {
  const { medicationId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const col = await getMedicationsCollection();
  const medication = await col.findOne({ _id: medicationId });
  if (!medication) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 });
  }

  const access = await verifyProfileAccess(session.userId, medication.elderlyProfileId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  return NextResponse.json({ medication });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ medicationId: string }> }
) {
  const { medicationId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const col = await getMedicationsCollection();
  const existing = await col.findOne({ _id: medicationId });
  if (!existing) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 });
  }

  const access = await verifyProfileAccess(session.userId, existing.elderlyProfileId);
  if (!access.hasAccess || (!access.isOwner && !access.permissions.canManageMedications)) {
    return NextResponse.json(
      { error: 'You do not have permission to edit medications for this profile.' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validated = medicationSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? 'Invalid medication details' },
      { status: 400 }
    );
  }

  const d = validated.data;
  await col.updateOne(
    { _id: medicationId },
    {
      $set: {
        name: d.name,
        dosage: d.dosage,
        form: d.form,
        instructions: d.instructions,
        frequency: d.frequency,
        scheduledTimes: d.scheduledTimes,
        startDate: d.startDate,
        endDate: d.endDate || null,
        reminderMinutesBefore: d.reminderMinutesBefore,
        notes: d.notes,
        prescribingDoctor: d.prescribingDoctor,
        color: d.color,
        updatedAt: new Date(),
      },
    }
  );

  // If times changed, cancel outdated pending doses and reschedule
  await cancelPendingDosesForMedication(medicationId, existing.elderlyProfileId);
  await cancelMedicationSchedules(medicationId);
  const updatedMed = await col.findOne({ _id: medicationId });
  if (updatedMed) {
    await scheduleMedicationTimeSlots(updatedMed, access.profile?.timezone ?? 'UTC');
  }

  await logAuditEvent({
    elderlyProfileId: existing.elderlyProfileId,
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'MEDICATION_UPDATED',
    details: {
      medicationId: medicationId,
      name: d.name,
      dosage: d.dosage,
    },
  });

  return NextResponse.json({ success: true, message: 'Medication updated.' });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ medicationId: string }> }
) {
  const { medicationId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const col = await getMedicationsCollection();
  const existing = await col.findOne({ _id: medicationId });
  if (!existing) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 });
  }

  const access = await verifyProfileAccess(session.userId, existing.elderlyProfileId);
  if (!access.hasAccess || (!access.isOwner && !access.permissions.canManageMedications)) {
    return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
  }

  const { status } = await req.json();
  if (!['active', 'paused', 'discontinued'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await col.updateOne({ _id: medicationId }, { $set: { status, updatedAt: new Date() } });

  // If paused or discontinued, clear upcoming pending dose alerts and cancel schedules
  if (status === 'paused' || status === 'discontinued') {
    await cancelPendingDosesForMedication(medicationId, existing.elderlyProfileId);
    await cancelMedicationSchedules(medicationId);
  } else if (status === 'active') {
    const activatedMed = await col.findOne({ _id: medicationId });
    if (activatedMed) {
      await scheduleMedicationTimeSlots(activatedMed, access.profile?.timezone ?? 'UTC');
    }
  }

  await logAuditEvent({
    elderlyProfileId: existing.elderlyProfileId,
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'MEDICATION_STATUS_CHANGED',
    details: {
      medicationId: medicationId,
      medicationName: existing.name,
      newStatus: status,
    },
  });

  return NextResponse.json({ success: true, status });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ medicationId: string }> }
) {
  const { medicationId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const col = await getMedicationsCollection();
  const existing = await col.findOne({ _id: medicationId });
  if (!existing) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 });
  }

  const access = await verifyProfileAccess(session.userId, existing.elderlyProfileId);
  if (!access.hasAccess || (!access.isOwner && !access.permissions.canManageMedications)) {
    return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
  }

  // Cancel any upcoming scheduled reminders and delete medication
  await cancelPendingDosesForMedication(medicationId, existing.elderlyProfileId);
  await cancelMedicationSchedules(medicationId);
  await col.deleteOne({ _id: medicationId });

  await logAuditEvent({
    elderlyProfileId: existing.elderlyProfileId,
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'MEDICATION_DELETED',
    details: {
      medicationId: medicationId,
      medicationName: existing.name,
    },
  });

  return NextResponse.json({ success: true, message: 'Medication deleted.' });
}
