import {
  getDoseLogsCollection,
  getAppointmentsCollection,
  getElderlyProfilesCollection,
  getCareCircleMembersCollection,
  getNotificationPreferencesCollection,
} from '@/lib/database/collections';
import {
  renderUpcomingDoseEmail,
  renderMissedDoseEmail,
  renderAppointmentReminderEmail,
} from '@/lib/email/templates';
import { sendTransactionalEmail } from '@/lib/email';
import { parseDateTimeInTimezone } from '@/lib/utils';

export interface DispatchSummary {
  timestamp: string;
  upcomingDoseNotifications: number;
  missedDoseNotifications: number;
  appointmentNotifications: number;
  errors: string[];
}

export async function runReminderDispatcher(): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    timestamp: new Date().toISOString(),
    upcomingDoseNotifications: 0,
    missedDoseNotifications: 0,
    appointmentNotifications: 0,
    errors: [],
  };

  const now = new Date();

  try {
    const doseLogsCol = await getDoseLogsCollection();
    const profilesCol = await getElderlyProfilesCollection();
    const membersCol = await getCareCircleMembersCollection();
    const prefsCol = await getNotificationPreferencesCollection();
    const appointmentsCol = await getAppointmentsCollection();

    // 1. Process Upcoming Dose Reminders
    // Look for doses scheduled within the upcoming window (within next 30 minutes)
    const windowStart = now;
    const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);

    const upcomingDoses = await doseLogsCol
      .find({
        status: { $in: ['upcoming', 'pending'] },
        scheduledDateTime: { $gte: windowStart, $lte: windowEnd },
        upcomingReminderSent: { $ne: true },
      })
      .toArray();

    await Promise.all(
      upcomingDoses.map(async (dose) => {
        const [profile, members] = await Promise.all([
          profilesCol.findOne({ _id: dose.elderlyProfileId }),
          membersCol.find({ elderlyProfileId: dose.elderlyProfileId, status: 'active' }).toArray(),
        ]);
        if (!profile) return;

        const template = renderUpcomingDoseEmail({
          elderlyName: profile.preferredName || profile.fullName,
          medicationName: dose.medicationName,
          dosage: dose.dosage,
          form: dose.form,
          scheduledTime: dose.scheduledTime,
          instructions: dose.instructions,
        });

        await Promise.all(
          members.map(async (member) => {
            const pref = await prefsCol.findOne({
              elderlyProfileId: dose.elderlyProfileId,
              userId: member.userId,
            });

            // Default to true if preference record not explicitly set to false
            if (pref?.emailUpcomingDoses === false) return;

            const idempotencyKey = `upcoming-${dose._id}-${member.userId}-${dose.scheduledDate}-${dose.scheduledTime}`;

            const res = await sendTransactionalEmail({
              to: member.userEmail,
              subject: template.subject,
              html: template.html,
              text: template.text,
              elderlyProfileId: dose.elderlyProfileId,
              recipientUserId: member.userId,
              referenceType: 'dose_upcoming',
              referenceId: dose._id,
              idempotencyKey,
            });

            if (res.status === 'sent') {
              summary.upcomingDoseNotifications++;
            }
          })
        );

        await doseLogsCol.updateOne(
          { _id: dose._id },
          { $set: { upcomingReminderSent: true, updatedAt: new Date() } }
        );
      })
    );

    // 2. Process Missed Doses
    // Find doses where scheduled time + grace period (60m) has passed, but status is not 'taken' or 'skipped'
    const graceCutoff = new Date(now.getTime() - 60 * 60 * 1000);
    const missedCandidates = await doseLogsCol
      .find({
        status: { $in: ['upcoming', 'pending'] },
        scheduledDateTime: { $lt: graceCutoff },
      })
      .toArray();

    await Promise.all(
      missedCandidates.map(async (dose) => {
        const [profile, members] = await Promise.all([
          profilesCol.findOne({ _id: dose.elderlyProfileId }),
          membersCol.find({ elderlyProfileId: dose.elderlyProfileId, status: 'active' }).toArray(),
          doseLogsCol.updateOne(
            { _id: dose._id },
            {
              $set: {
                status: 'missed',
                missedAlertSent: true,
                updatedAt: new Date(),
              },
            }
          ),
        ]);
        if (!profile) return;

        const template = renderMissedDoseEmail({
          elderlyName: profile.preferredName || profile.fullName,
          medicationName: dose.medicationName,
          dosage: dose.dosage,
          scheduledTime: dose.scheduledTime,
          scheduledDate: dose.scheduledDate,
        });

        await Promise.all(
          members.map(async (member) => {
            const pref = await prefsCol.findOne({
              elderlyProfileId: dose.elderlyProfileId,
              userId: member.userId,
            });

            if (pref?.emailMissedDoses === false) return;

            const idempotencyKey = `missed-${dose._id}-${member.userId}-${dose.scheduledDate}`;

            const res = await sendTransactionalEmail({
              to: member.userEmail,
              subject: template.subject,
              html: template.html,
              text: template.text,
              elderlyProfileId: dose.elderlyProfileId,
              recipientUserId: member.userId,
              referenceType: 'dose_missed',
              referenceId: dose._id,
              idempotencyKey,
            });

            if (res.status === 'sent') {
              summary.missedDoseNotifications++;
            }
          })
        );
      })
    );

    // 3. Process Doctor Appointment Reminders (24h and 2h lead times)
    const upcomingAppointments = await appointmentsCol
      .find({
        status: 'scheduled',
      })
      .toArray();

    await Promise.all(
      upcomingAppointments.map(async (appt) => {
        const profile = await profilesCol.findOne({ _id: appt.elderlyProfileId });
        if (!profile) return;

        const timezone = profile.timezone || 'UTC';
        const apptDateTime = parseDateTimeInTimezone(
          appt.appointmentDate,
          appt.appointmentTime,
          timezone
        );

        const diffMs = apptDateTime.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Skip appointments that have already passed
        if (diffHours < 0) return;

        const members = await membersCol
          .find({ elderlyProfileId: appt.elderlyProfileId, status: 'active' })
          .toArray();

        const checklistTexts = appt.preparationChecklist
          .filter((c) => !c.completed)
          .map((c) => c.text);

        // 24-Hour Reminder (fires when appointment is within next 24 hours)
        if (diffHours <= 24 && !appt.remindersSent?.reminder24h) {
          const template = renderAppointmentReminderEmail({
            elderlyName: profile.preferredName || profile.fullName,
            doctorName: appt.doctorName,
            clinicName: appt.hospitalClinicName,
            appointmentDate: appt.appointmentDate,
            appointmentTime: appt.appointmentTime,
            location: appt.location,
            leadHours: Math.max(1, Math.round(diffHours)),
            checklistItems: checklistTexts,
          });

          await Promise.all(
            members.map(async (member) => {
              const pref = await prefsCol.findOne({
                elderlyProfileId: appt.elderlyProfileId,
                userId: member.userId,
              });

              if (pref?.emailAppointments === false) return;

              const idempotencyKey = `appt24h-${appt._id}-${member.userId}-${appt.appointmentDate}`;
              const res = await sendTransactionalEmail({
                to: member.userEmail,
                subject: template.subject,
                html: template.html,
                text: template.text,
                elderlyProfileId: appt.elderlyProfileId,
                recipientUserId: member.userId,
                referenceType: 'appointment_24h',
                referenceId: appt._id,
                idempotencyKey,
              });

              if (res.status === 'sent') summary.appointmentNotifications++;
            })
          );

          await appointmentsCol.updateOne(
            { _id: appt._id },
            { $set: { 'remindersSent.reminder24h': true, updatedAt: new Date() } }
          );
        }

        // 2-Hour Reminder (fires when appointment is within next 2 hours)
        if (diffHours <= 2 && !appt.remindersSent?.reminder2h) {
          const template = renderAppointmentReminderEmail({
            elderlyName: profile.preferredName || profile.fullName,
            doctorName: appt.doctorName,
            clinicName: appt.hospitalClinicName,
            appointmentDate: appt.appointmentDate,
            appointmentTime: appt.appointmentTime,
            location: appt.location,
            leadHours: Math.max(1, Math.round(diffHours)),
            checklistItems: checklistTexts,
          });

          await Promise.all(
            members.map(async (member) => {
              const pref = await prefsCol.findOne({
                elderlyProfileId: appt.elderlyProfileId,
                userId: member.userId,
              });

              if (pref?.emailAppointments === false) return;

              const idempotencyKey = `appt2h-${appt._id}-${member.userId}-${appt.appointmentDate}`;
              const res = await sendTransactionalEmail({
                to: member.userEmail,
                subject: template.subject,
                html: template.html,
                text: template.text,
                elderlyProfileId: appt.elderlyProfileId,
                recipientUserId: member.userId,
                referenceType: 'appointment_2h',
                referenceId: appt._id,
                idempotencyKey,
              });

              if (res.status === 'sent') summary.appointmentNotifications++;
            })
          );

          await appointmentsCol.updateOne(
            { _id: appt._id },
            { $set: { 'remindersSent.reminder2h': true, updatedAt: new Date() } }
          );
        }
      })
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown reminder dispatcher error';
    summary.errors.push(errorMsg);
    console.error('Reminder dispatch error:', err);
  }

  return summary;
}
