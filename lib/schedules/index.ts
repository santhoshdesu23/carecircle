import { Schedules } from '@vercel/schedules';
import {
  getCollection,
  getMedicationsCollection,
  getElderlyProfilesCollection,
  getAppointmentsCollection,
  getDoseLogsCollection,
  getNotificationPreferencesCollection,
  getCareCircleMembersCollection,
} from '@/lib/database/collections';
import { Medication, Appointment, ScheduledEvent } from '@/types';
import { sendTransactionalEmail } from '@/lib/email';
import {
  renderUpcomingDoseEmail,
  renderMissedDoseEmail,
  renderAppointmentReminderEmail,
} from '@/lib/email/templates';
import { parseDateTimeInTimezone } from '@/lib/utils';

export interface ScheduleEventPayload {
  type: 'medication_dose' | 'missed_dose_followup' | 'appointment_24h' | 'appointment_2h';
  elderlyProfileId: string;
  referenceId: string; // medicationId or appointmentId
  timeSlot?: string;
  dateStr?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Transactional Outbox + Vercel Schedules Client
 * Manages recurring medication time slots and one-time appointment triggers.
 */
export async function scheduleMedicationTimeSlots(
  medication: Medication,
  profileTimezone: string = 'UTC'
): Promise<void> {
  const col = await getCollection<ScheduledEvent>('schedules');

  // Cancel any existing schedules for this medication first (rescheduling consistency)
  await cancelMedicationSchedules(medication._id);

  if (
    medication.status !== 'active' ||
    !medication.scheduledTimes ||
    medication.scheduledTimes.length === 0
  ) {
    return;
  }

  await Promise.all(
    medication.scheduledTimes.map(async (slot) => {
      const [h, m] = slot.split(':').map((n) => Number.parseInt(n, 10));
      const cron = `${m} ${h} * * *`;
      const scheduleName = `med_${medication._id}_${slot.replace(':', '')}`;

      const eventDoc: ScheduledEvent = {
        _id: scheduleName,
        name: scheduleName,
        type: 'medication_dose',
        elderlyProfileId: medication.elderlyProfileId,
        referenceId: medication._id,
        cronExpression: cron,
        timezone: profileTimezone,
        status: 'active',
        payload: {
          type: 'medication_dose',
          elderlyProfileId: medication.elderlyProfileId,
          referenceId: medication._id,
          timeSlot: slot,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 1. Persist schedule in MongoDB outbox
      await col.updateOne({ _id: scheduleName }, { $set: eventDoc }, { upsert: true });

      // 2. Register with Vercel Schedules beta SDK (gracefully fallback if OIDC token is absent in non-Vercel environment)
      try {
        if (process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_SCHEDULE_TOKEN) {
          await Schedules.create({
            name: scheduleName,
            expression: { type: 'cron', cron },
            timezone: profileTimezone,
            target: { topic: 'carecircle-reminders' },
            payload: eventDoc.payload,
          });
        }
      } catch (err) {
        // Outbox ensures reconciliation even if external API dispatch fails
        console.warn(
          `[Vercel Schedules Beta] Dynamic schedule creation deferred to reconciliation outbox for ${scheduleName}:`,
          err
        );
      }
    })
  );
}

/**
 * Cancels recurring schedules when medication is modified, paused, or deleted.
 */
export async function cancelMedicationSchedules(medicationId: string): Promise<void> {
  const col = await getCollection<ScheduledEvent>('schedules');
  const activeSchedules = await col.find({ referenceId: medicationId, status: 'active' }).toArray();

  await Promise.all(
    activeSchedules.map(async (s) => {
      try {
        if (process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_SCHEDULE_TOKEN) {
          await Schedules.delete({ name: s.name });
        }
      } catch (err) {
        // Expected if schedule was already deleted or in local test environment
        console.warn(`[Vercel Schedules Beta] Dynamic schedule deletion skipped:`, err);
      }
    })
  );

  await col.updateMany(
    { referenceId: medicationId, status: 'active' },
    { $set: { status: 'cancelled', updatedAt: new Date() } }
  );
}

/**
 * Creates 24-hour and 2-hour one-time schedules for appointments.
 */
export async function scheduleAppointmentReminders(
  appointment: Appointment,
  profileTimezone: string = 'UTC'
): Promise<void> {
  const col = await getCollection<ScheduledEvent>('schedules');

  // Invalidate any previous schedules for this appointment
  await cancelAppointmentSchedules(appointment._id);

  if (appointment.status !== 'scheduled') {
    return;
  }

  const apptTime = parseDateTimeInTimezone(
    appointment.appointmentDate,
    appointment.appointmentTime,
    profileTimezone
  );

  const now = new Date();
  const time24h = new Date(apptTime.getTime() - 24 * 60 * 60 * 1000);
  const time2h = new Date(apptTime.getTime() - 2 * 60 * 60 * 1000);

  const triggers = [
    { type: 'appointment_24h' as const, at: time24h, name: `appt_${appointment._id}_24h` },
    { type: 'appointment_2h' as const, at: time2h, name: `appt_${appointment._id}_2h` },
  ];

  await Promise.all(
    triggers
      .filter((t) => t.at > now)
      .map(async (t) => {
        // Format as YYYY-MM-DDTHH:mm:00 in local timezone format
        const atStr = t.at.toISOString().slice(0, 19);

        const eventDoc: ScheduledEvent = {
          _id: t.name,
          name: t.name,
          type: t.type,
          elderlyProfileId: appointment.elderlyProfileId,
          referenceId: appointment._id,
          runAt: t.at,
          timezone: profileTimezone,
          status: 'active',
          payload: {
            type: t.type,
            elderlyProfileId: appointment.elderlyProfileId,
            referenceId: appointment._id,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await col.updateOne({ _id: t.name }, { $set: eventDoc }, { upsert: true });

        try {
          if (process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_SCHEDULE_TOKEN) {
            await Schedules.create({
              name: t.name,
              expression: { type: 'single', at: atStr },
              timezone: profileTimezone,
              target: { topic: 'carecircle-reminders' },
              payload: eventDoc.payload,
            });
          }
        } catch (err) {
          console.warn(
            `[Vercel Schedules Beta] One-time schedule creation deferred to outbox for ${t.name}:`,
            err
          );
        }
      })
  );
}

/**
 * Cancels appointment reminder schedules on reschedule or deletion.
 */
export async function cancelAppointmentSchedules(appointmentId: string): Promise<void> {
  const col = await getCollection<ScheduledEvent>('schedules');
  const activeSchedules = await col
    .find({ referenceId: appointmentId, status: 'active' })
    .toArray();

  await Promise.all(
    activeSchedules.map(async (s) => {
      try {
        if (process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_SCHEDULE_TOKEN) {
          await Schedules.delete({ name: s.name });
        }
      } catch (err) {
        // Expected if schedule not registered with external Vercel API
        console.warn(`[Vercel Schedules Beta] Appointment schedule deletion skipped:`, err);
      }
    })
  );

  await col.updateMany(
    { referenceId: appointmentId, status: 'active' },
    { $set: { status: 'cancelled', updatedAt: new Date() } }
  );
}

/**
 * Idempotent Reminder Event Consumer
 * Handles incoming schedule triggers or queue deliveries.
 */
export async function processReminderEvent(payload: ScheduleEventPayload): Promise<{
  success: boolean;
  skipped?: string;
  deliveredTo?: string[];
  error?: string;
}> {
  if (payload.type === 'medication_dose') {
    const medCol = await getMedicationsCollection();
    const medication = await medCol.findOne({ _id: payload.referenceId });

    // 1. Verify medication is still active
    if (!medication || medication.status !== 'active') {
      return { success: true, skipped: 'Medication inactive or deleted' };
    }

    const profilesCol = await getElderlyProfilesCollection();
    const profile = await profilesCol.findOne({ _id: medication.elderlyProfileId });
    if (!profile) return { success: true, skipped: 'Profile not found' };

    const timeSlot = payload.timeSlot || medication.scheduledTimes[0] || '08:00';
    const now = new Date();
    // Resolve today's date in elder's timezone
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: profile.timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    // 2. Check if dose has already been taken or skipped
    const dosesCol = await getDoseLogsCollection();
    const existingDose = await dosesCol.findOne({
      medicationId: medication._id,
      scheduledDate: todayStr,
      scheduledTime: timeSlot,
    });

    if (existingDose?.status === 'taken' || existingDose?.status === 'skipped') {
      return { success: true, skipped: `Dose already marked as ${existingDose.status}` };
    }

    // 3. Check notification preferences
    const prefsCol = await getNotificationPreferencesCollection();
    const membersCol = await getCareCircleMembersCollection();
    const activeMembers = await membersCol
      .find({ elderlyProfileId: profile._id, status: 'active' })
      .toArray();

    const deliveredResults = await Promise.all(
      activeMembers.map(async (member) => {
        const pref = await prefsCol.findOne({
          elderlyProfileId: profile._id,
          userId: member.userId,
        });

        if (pref?.emailUpcomingDoses === false) {
          return null;
        }

        const idempotencyKey = `dose_${medication._id}_${todayStr}_${timeSlot}_${member.userId}`;

        const tpl = renderUpcomingDoseEmail({
          elderlyName: profile.fullName,
          medicationName: medication.name,
          dosage: medication.dosage,
          form: medication.form,
          scheduledTime: timeSlot,
          instructions: medication.instructions,
        });

        const emailResult = await sendTransactionalEmail({
          to: member.userEmail,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          elderlyProfileId: profile._id,
          recipientUserId: member.userId,
          referenceType: 'dose_upcoming',
          referenceId: medication._id,
          idempotencyKey,
        });

        if (emailResult.success && emailResult.status === 'sent') {
          return member.userEmail;
        }
        return null;
      })
    );

    const deliveredTo: string[] = deliveredResults.filter(
      (email): email is string => email !== null
    );

    // 4. Schedule missed dose follow-up (60-minute grace period)
    const missedScheduleName = `missed_${medication._id}_${todayStr}_${timeSlot.replace(':', '')}`;
    const missedRunAt = new Date(now.getTime() + 60 * 60 * 1000);
    const schedulesCol = await getCollection<ScheduledEvent>('schedules');

    await schedulesCol.updateOne(
      { _id: missedScheduleName },
      {
        $set: {
          name: missedScheduleName,
          type: 'missed_dose_followup',
          elderlyProfileId: profile._id,
          referenceId: medication._id,
          runAt: missedRunAt,
          timezone: profile.timezone || 'UTC',
          status: 'active',
          payload: {
            type: 'missed_dose_followup',
            elderlyProfileId: profile._id,
            referenceId: medication._id,
            timeSlot,
            dateStr: todayStr,
          },
          updatedAt: new Date(),
        },
        $setOnInsert: {
          _id: missedScheduleName,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return { success: true, deliveredTo };
  }

  if (payload.type === 'missed_dose_followup') {
    const medCol = await getMedicationsCollection();
    const medication = await medCol.findOne({ _id: payload.referenceId });
    if (!medication || medication.status !== 'active') {
      return { success: true, skipped: 'Medication inactive' };
    }

    const dosesCol = await getDoseLogsCollection();
    const existingDose = await dosesCol.findOne({
      medicationId: medication._id,
      scheduledDate: payload.dateStr,
      scheduledTime: payload.timeSlot,
    });

    // Check if dose has subsequently been recorded
    if (existingDose?.status === 'taken' || existingDose?.status === 'skipped') {
      return {
        success: true,
        skipped: `Dose subsequently marked as ${existingDose.status}; alert suppressed`,
      };
    }

    const profilesCol = await getElderlyProfilesCollection();
    const profile = await profilesCol.findOne({ _id: medication.elderlyProfileId });
    if (!profile) return { success: true, skipped: 'Profile not found' };

    const membersCol = await getCareCircleMembersCollection();
    const activeMembers = await membersCol
      .find({ elderlyProfileId: profile._id, status: 'active' })
      .toArray();

    const prefsCol = await getNotificationPreferencesCollection();
    const deliveredResults = await Promise.all(
      activeMembers.map(async (member) => {
        const pref = await prefsCol.findOne({
          elderlyProfileId: profile._id,
          userId: member.userId,
        });

        if (pref?.emailMissedDoses === false) {
          return null;
        }

        const idempotencyKey = `missed_${medication._id}_${payload.dateStr}_${payload.timeSlot}_${member.userId}`;
        const tpl = renderMissedDoseEmail({
          elderlyName: profile.fullName,
          medicationName: medication.name,
          dosage: medication.dosage,
          scheduledTime: payload.timeSlot || '08:00',
          scheduledDate: payload.dateStr || 'Today',
        });

        const emailResult = await sendTransactionalEmail({
          to: member.userEmail,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          elderlyProfileId: profile._id,
          recipientUserId: member.userId,
          referenceType: 'dose_missed',
          referenceId: medication._id,
          idempotencyKey,
        });

        if (emailResult.success && emailResult.status === 'sent') {
          return member.userEmail;
        }
        return null;
      })
    );

    const deliveredTo: string[] = deliveredResults.filter(
      (email): email is string => email !== null
    );

    return { success: true, deliveredTo };
  }

  if (payload.type === 'appointment_24h' || payload.type === 'appointment_2h') {
    const apptsCol = await getAppointmentsCollection();
    const appointment = await apptsCol.findOne({ _id: payload.referenceId });

    if (!appointment || appointment.status !== 'scheduled') {
      return { success: true, skipped: 'Appointment cancelled or not found' };
    }

    const profilesCol = await getElderlyProfilesCollection();
    const profile = await profilesCol.findOne({ _id: appointment.elderlyProfileId });
    if (!profile) return { success: true, skipped: 'Profile not found' };

    const membersCol = await getCareCircleMembersCollection();
    const activeMembers = await membersCol
      .find({ elderlyProfileId: profile._id, status: 'active' })
      .toArray();

    const prefsCol = await getNotificationPreferencesCollection();
    const deliveredResults = await Promise.all(
      activeMembers.map(async (member) => {
        const pref = await prefsCol.findOne({
          elderlyProfileId: profile._id,
          userId: member.userId,
        });

        if (pref?.emailAppointments === false) {
          return null;
        }

        const idempotencyKey = `appt_${appointment._id}_${payload.type}_${member.userId}`;
        const tpl = renderAppointmentReminderEmail({
          elderlyName: profile.fullName,
          doctorName: appointment.doctorName,
          clinicName: appointment.hospitalClinicName,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          location: appointment.location,
          leadHours: payload.type === 'appointment_24h' ? 24 : 2,
          checklistItems: appointment.preparationChecklist
            ? appointment.preparationChecklist.map((c) => c.text)
            : [],
        });

        const emailResult = await sendTransactionalEmail({
          to: member.userEmail,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          elderlyProfileId: profile._id,
          recipientUserId: member.userId,
          referenceType: payload.type as 'appointment_24h' | 'appointment_2h',
          referenceId: appointment._id,
          idempotencyKey,
        });

        if (emailResult.success && emailResult.status === 'sent') {
          return member.userEmail;
        }
        return null;
      })
    );

    const deliveredTo: string[] = deliveredResults.filter(
      (email): email is string => email !== null
    );

    return { success: true, deliveredTo };
  }

  return { success: false, error: 'Unknown schedule event type' };
}
