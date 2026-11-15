import {
  getUsersCollection,
  getElderlyProfilesCollection,
  getCareCircleMembersCollection,
  getInvitationCodesCollection,
  getMedicationsCollection,
  getDoseLogsCollection,
  getAppointmentsCollection,
  getCareNotesCollection,
  getAuditLogsCollection,
  getNotificationPreferencesCollection,
  getReminderDeliveriesCollection,
  getSessionsCollection,
  getRateLimitsCollection,
} from './collections';

let indexesEnsured = false;
let indexesPromise: Promise<void> | null = null;

/**
 * Ensures all required database indexes are created on MongoDB collections.
 * Uses a singleton promise to avoid duplicate concurrent initialization and
 * provides structured diagnostic logging if connectivity or index creation fails.
 */
export async function ensureDatabaseIndexes(): Promise<void> {
  if (indexesEnsured) return;
  if (indexesPromise) return indexesPromise;

  indexesPromise = (async () => {
    try {
      const users = await getUsersCollection();
      await users.createIndex({ email: 1 }, { unique: true });

      const elderlyProfiles = await getElderlyProfilesCollection();
      await elderlyProfiles.createIndex({ ownerUserId: 1 });

      const careCircleMembers = await getCareCircleMembersCollection();
      await careCircleMembers.createIndex({ elderlyProfileId: 1, userId: 1 }, { unique: true });
      await careCircleMembers.createIndex({ userId: 1 });

      const invitationCodes = await getInvitationCodesCollection();
      await invitationCodes.createIndex({ codeHash: 1 });
      await invitationCodes.createIndex({ elderlyProfileId: 1 });
      await invitationCodes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

      const medications = await getMedicationsCollection();
      await medications.createIndex({ elderlyProfileId: 1, status: 1 });

      const doseLogs = await getDoseLogsCollection();
      await doseLogs.createIndex({ medicationId: 1, scheduledDateTime: 1 }, { unique: true });
      await doseLogs.createIndex({ elderlyProfileId: 1, scheduledDate: 1 });
      await doseLogs.createIndex({ status: 1, scheduledDateTime: 1 });

      const appointments = await getAppointmentsCollection();
      await appointments.createIndex({ elderlyProfileId: 1, appointmentDate: 1 });
      await appointments.createIndex({ status: 1 });

      const careNotes = await getCareNotesCollection();
      await careNotes.createIndex({ elderlyProfileId: 1, createdAt: -1 });

      const auditLogs = await getAuditLogsCollection();
      await auditLogs.createIndex({ elderlyProfileId: 1, createdAt: -1 });
      await auditLogs.createIndex({ actorUserId: 1 });

      const notificationPreferences = await getNotificationPreferencesCollection();
      await notificationPreferences.createIndex(
        { elderlyProfileId: 1, userId: 1 },
        { unique: true }
      );

      const reminderDeliveries = await getReminderDeliveriesCollection();
      await reminderDeliveries.createIndex({ idempotencyKey: 1 }, { unique: true });

      const sessions = await getSessionsCollection();
      await sessions.createIndex({ userId: 1 });
      await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

      const rateLimits = await getRateLimitsCollection();
      await rateLimits.createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 });

      indexesEnsured = true;
    } catch (error: unknown) {
      indexesEnsured = false;
      indexesPromise = null;
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[Database Indexes Initialization Diagnostic] Index creation failed: ${errMsg}`
      );
      throw error;
    }
  })();

  return indexesPromise;
}
