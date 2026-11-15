import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSession } from '@/lib/auth/session';
import { medicationSchema } from '@/lib/validations';
import { verifyProfileAccess } from '@/lib/permissions';
import { getMedicationsCollection } from '@/lib/database/collections';
import { Medication } from '@/types';
import { logAuditEvent } from '@/lib/audit';
import { scheduleMedicationTimeSlots } from '@/lib/schedules';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get('profileId');

  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
  }

  const access = await verifyProfileAccess(session.userId, profileId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const col = await getMedicationsCollection();
  const medications = await col
    .find({ elderlyProfileId: profileId })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({ medications });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validated = medicationSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? 'Invalid medication details' },
      { status: 400 }
    );
  }

  const data = validated.data;
  const access = await verifyProfileAccess(session.userId, data.elderlyProfileId);
  if (!access.hasAccess || (!access.isOwner && !access.permissions.canManageMedications)) {
    return NextResponse.json(
      { error: 'You do not have permission to add medications for this profile.' },
      { status: 403 }
    );
  }

  const medId = `med_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const medication: Medication = {
    _id: medId,
    elderlyProfileId: data.elderlyProfileId,
    name: data.name,
    dosage: data.dosage,
    form: data.form,
    instructions: data.instructions,
    frequency: data.frequency,
    scheduledTimes: data.scheduledTimes,
    startDate: data.startDate,
    endDate: data.endDate || null,
    status: 'active',
    reminderMinutesBefore: data.reminderMinutesBefore,
    notes: data.notes,
    prescribingDoctor: data.prescribingDoctor,
    color: data.color || '#0D9488',
    createdByUserId: session.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const col = await getMedicationsCollection();
  await col.insertOne(medication as any);

  // Register recurring schedules for medication time slots
  await scheduleMedicationTimeSlots(medication, access.profile?.timezone ?? 'UTC');

  await logAuditEvent({
    elderlyProfileId: data.elderlyProfileId,
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'MEDICATION_CREATED',
    details: {
      medicationId: medId,
      name: data.name,
      dosage: data.dosage,
      frequency: data.frequency,
      scheduledTimes: data.scheduledTimes,
    },
  });

  return NextResponse.json({ success: true, medication }, { status: 201 });
}
