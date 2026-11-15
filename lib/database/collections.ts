import { Collection, Document } from 'mongodb';
import { getDatabase } from './client';
import {
  User,
  ElderlyProfile,
  CareCircleMember,
  InvitationCode,
  Medication,
  DoseLog,
  Appointment,
  CareNote,
  AuditLog,
  NotificationPreference,
  ReminderDelivery,
  ActiveSession,
} from '@/types';

export const COLLECTIONS = {
  USERS: 'users',
  ELDERLY_PROFILES: 'elderlyProfiles',
  CARE_CIRCLE_MEMBERS: 'careCircleMembers',
  INVITATION_CODES: 'invitationCodes',
  MEDICATIONS: 'medications',
  DOSE_LOGS: 'doseLogs',
  APPOINTMENTS: 'appointments',
  CARE_NOTES: 'careNotes',
  AUDIT_LOGS: 'auditLogs',
  NOTIFICATION_PREFERENCES: 'notificationPreferences',
  REMINDER_DELIVERIES: 'reminderDeliveries',
  SESSIONS: 'sessions',
  RATE_LIMITS: 'rateLimits',
} as const;

export async function getCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getDatabase();
  return db.collection<T>(name);
}

export async function getUsersCollection(): Promise<Collection<User & Document>> {
  return getCollection<User & Document>(COLLECTIONS.USERS);
}

export async function getElderlyProfilesCollection(): Promise<
  Collection<ElderlyProfile & Document>
> {
  return getCollection<ElderlyProfile & Document>(COLLECTIONS.ELDERLY_PROFILES);
}

export async function getCareCircleMembersCollection(): Promise<
  Collection<CareCircleMember & Document>
> {
  return getCollection<CareCircleMember & Document>(COLLECTIONS.CARE_CIRCLE_MEMBERS);
}

export async function getInvitationCodesCollection(): Promise<
  Collection<InvitationCode & Document>
> {
  return getCollection<InvitationCode & Document>(COLLECTIONS.INVITATION_CODES);
}

export async function getMedicationsCollection(): Promise<Collection<Medication & Document>> {
  return getCollection<Medication & Document>(COLLECTIONS.MEDICATIONS);
}

export async function getDoseLogsCollection(): Promise<Collection<DoseLog & Document>> {
  return getCollection<DoseLog & Document>(COLLECTIONS.DOSE_LOGS);
}

export async function getAppointmentsCollection(): Promise<Collection<Appointment & Document>> {
  return getCollection<Appointment & Document>(COLLECTIONS.APPOINTMENTS);
}

export async function getCareNotesCollection(): Promise<Collection<CareNote & Document>> {
  return getCollection<CareNote & Document>(COLLECTIONS.CARE_NOTES);
}

export async function getAuditLogsCollection(): Promise<Collection<AuditLog & Document>> {
  return getCollection<AuditLog & Document>(COLLECTIONS.AUDIT_LOGS);
}

export async function getNotificationPreferencesCollection(): Promise<
  Collection<NotificationPreference & Document>
> {
  return getCollection<NotificationPreference & Document>(COLLECTIONS.NOTIFICATION_PREFERENCES);
}

export async function getReminderDeliveriesCollection(): Promise<
  Collection<ReminderDelivery & Document>
> {
  return getCollection<ReminderDelivery & Document>(COLLECTIONS.REMINDER_DELIVERIES);
}

export async function getSessionsCollection(): Promise<Collection<ActiveSession & Document>> {
  return getCollection<ActiveSession & Document>(COLLECTIONS.SESSIONS);
}

export interface PersistentRateLimitDoc {
  _id: string; // Rate limit key
  count: number;
  resetAt: Date;
  updatedAt: Date;
}

export async function getRateLimitsCollection(): Promise<
  Collection<PersistentRateLimitDoc & Document>
> {
  return getCollection<PersistentRateLimitDoc & Document>(COLLECTIONS.RATE_LIMITS);
}
