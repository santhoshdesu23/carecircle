import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { verifyProfileAccess } from '@/lib/permissions';
import { getAppointmentsCollection } from '@/lib/database/collections';
import { appointmentSchema } from '@/lib/validations';
import { logAuditEvent } from '@/lib/audit';
import { scheduleAppointmentReminders, cancelAppointmentSchedules } from '@/lib/schedules';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const { appointmentId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const col = await getAppointmentsCollection();
  const appointment = await col.findOne({ _id: appointmentId });
  if (!appointment) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
  }

  const access = await verifyProfileAccess(session.userId, appointment.elderlyProfileId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  return NextResponse.json({ appointment });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const { appointmentId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const col = await getAppointmentsCollection();
  const existing = await col.findOne({ _id: appointmentId });
  if (!existing) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
  }

  const access = await verifyProfileAccess(session.userId, existing.elderlyProfileId);
  if (!access.hasAccess || (!access.isOwner && !access.permissions.canManageAppointments)) {
    return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
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
  const timeChanged =
    d.appointmentDate !== existing.appointmentDate ||
    d.appointmentTime !== existing.appointmentTime;

  await col.updateOne(
    { _id: appointmentId },
    {
      $set: {
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
        ...(timeChanged ? { remindersSent: { reminder24h: false, reminder2h: false } } : {}),
        updatedAt: new Date(),
      },
    }
  );

  if (timeChanged) {
    await cancelAppointmentSchedules(appointmentId);
    const updated = await col.findOne({ _id: appointmentId });
    if (updated) {
      await scheduleAppointmentReminders(updated, access.profile?.timezone ?? 'UTC');
    }
  }

  await logAuditEvent({
    elderlyProfileId: existing.elderlyProfileId,
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'APPOINTMENT_UPDATED',
    details: {
      appointmentId: appointmentId,
      doctorName: d.doctorName,
      appointmentDate: d.appointmentDate,
    },
  });

  return NextResponse.json({ success: true, message: 'Appointment updated.' });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const { appointmentId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const col = await getAppointmentsCollection();
  const existing = await col.findOne({ _id: appointmentId });
  if (!existing) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
  }

  const access = await verifyProfileAccess(session.userId, existing.elderlyProfileId);
  if (!access.hasAccess || (!access.isOwner && !access.permissions.canManageAppointments)) {
    return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
  }

  const body = await req.json();

  // Handle checklist item toggle or status change
  if (body.preparationChecklist) {
    await col.updateOne(
      { _id: appointmentId },
      {
        $set: {
          preparationChecklist: body.preparationChecklist,
          updatedAt: new Date(),
        },
      }
    );
    return NextResponse.json({ success: true, preparationChecklist: body.preparationChecklist });
  }

  if (body.status && ['scheduled', 'completed', 'cancelled'].includes(body.status)) {
    await col.updateOne(
      { _id: appointmentId },
      {
        $set: {
          status: body.status,
          updatedAt: new Date(),
        },
      }
    );

    if (body.status === 'cancelled' || body.status === 'completed') {
      await cancelAppointmentSchedules(appointmentId);
    }

    await logAuditEvent({
      elderlyProfileId: existing.elderlyProfileId,
      actorUserId: session.userId,
      actorName: session.name,
      actorEmail: session.email,
      action: 'APPOINTMENT_STATUS_CHANGED',
      details: {
        appointmentId: appointmentId,
        newStatus: body.status,
      },
    });

    return NextResponse.json({ success: true, status: body.status });
  }

  return NextResponse.json({ error: 'Invalid patch payload' }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const { appointmentId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const col = await getAppointmentsCollection();
  const existing = await col.findOne({ _id: appointmentId });
  if (!existing) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
  }

  const access = await verifyProfileAccess(session.userId, existing.elderlyProfileId);
  if (!access.hasAccess || (!access.isOwner && !access.permissions.canManageAppointments)) {
    return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
  }

  await col.deleteOne({ _id: appointmentId });
  await cancelAppointmentSchedules(appointmentId);

  await logAuditEvent({
    elderlyProfileId: existing.elderlyProfileId,
    actorUserId: session.userId,
    actorName: session.name,
    actorEmail: session.email,
    action: 'APPOINTMENT_DELETED',
    details: {
      appointmentId: appointmentId,
      doctorName: existing.doctorName,
    },
  });

  return NextResponse.json({ success: true, message: 'Appointment deleted.' });
}
