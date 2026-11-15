import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSession } from '@/lib/auth/session';
import { verifyProfileAccess } from '@/lib/permissions';
import { appointmentSchema } from '@/lib/validations';
import { getAppointmentsCollection } from '@/lib/database/collections';
import { Appointment } from '@/types';
import { logAuditEvent } from '@/lib/audit';
import { scheduleAppointmentReminders } from '@/lib/schedules';

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

  const col = await getAppointmentsCollection();
  const appointments = await col
    .find({ elderlyProfileId: profileId })
    .sort({ appointmentDate: 1, appointmentTime: 1 })
    .toArray();

  return NextResponse.json({
    appointments,
    canManageAppointments: access.isOwner || access.permissions.canManageAppointments,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validated = appointmentSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? 'Invalid appointment details' },
      { status: 400 }
    );
  }

  const d = validated.data;
  const access = await verifyProfileAccess(session.userId, d.elderlyProfileId);

  if (!access.hasAccess || (!access.isOwner && !access.permissions.canManageAppointments)) {
    return NextResponse.json(
      { error: 'You do not have permission to manage appointments for this profile.' },
      { status: 403 }
    );
  }

  const apptId = `appt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const appointment: Appointment = {
    _id: apptId,
    elderlyProfileId: d.elderlyProfileId,
    doctorName: d.doctorName,
    specialty: d.specialty,
    hospitalClinicName: d.hospitalClinicName,
    appointmentDate: d.appointmentDate,
    appointmentTime: d.appointmentTime,
    location: d.location,
    reason: d.reason,
    notes: d.notes,
    followUpDate: d.followUpDate || undefined,
    preparationChecklist: d.preparationChecklist,
    status: 'scheduled',
    remindersSent: {
      reminder24h: false,
      reminder2h: false,
    },
    createdByUserId: session.userId,
    createdByName: session.name,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const col = await getAppointmentsCollection();
  await col.insertOne(appointment as any);

  // Register one-time schedules for 24h and 2h appointment reminders
  await scheduleAppointmentReminders(appointment, access.profile?.timezone ?? 'UTC');

  await logAuditEvent({
    elderlyProfileId: d.elderlyProfileId,
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'APPOINTMENT_CREATED',
    details: {
      appointmentId: apptId,
      doctorName: d.doctorName,
      hospitalClinicName: d.hospitalClinicName,
      appointmentDate: d.appointmentDate,
      appointmentTime: d.appointmentTime,
    },
  });

  return NextResponse.json({ success: true, appointment }, { status: 201 });
}
