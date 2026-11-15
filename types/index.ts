export type UserRole = 'elderly' | 'family' | 'caretaker';
export type UserAccountStatus = 'pending_verification' | 'active' | 'disabled';

export interface User {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  status?: UserAccountStatus;
  emailVerificationToken?: string | null;
  emailVerificationExpires?: Date | null;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  defaultRole: UserRole;
  seniorModeEnabled?: boolean;
  activeProfileId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  sessionId?: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  seniorModeEnabled: boolean;
  activeProfileId?: string;
}

export interface ActiveSession {
  _id: string; // sessionId
  userId: string;
  email: string;
  isValid: boolean;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface ElderlyProfile {
  _id: string;
  ownerUserId: string; // The elderly person or primary administrator
  fullName: string;
  preferredName?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  gender?: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phoneNumber: string;
    email?: string;
  };
  notes?: string;
  timezone: string; // e.g. "America/New_York", "Asia/Kolkata", "UTC"
  createdAt: Date;
  updatedAt: Date;
}

export type CircleMemberRole = 'owner' | 'caretaker' | 'family';

export interface MemberPermissions {
  canManageMedications: boolean;
  canRecordDoses: boolean;
  canManageAppointments: boolean;
  canViewTimeline: boolean;
  canInviteMembers: boolean;
  canLeaveNotes: boolean;
}

export interface CareCircleMember {
  _id: string;
  elderlyProfileId: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: CircleMemberRole;
  relationshipToElderly?: string; // e.g. "Daughter", "Visiting Nurse", "Son"
  permissions: MemberPermissions;
  status: 'active' | 'revoked';
  invitedByUserId: string;
  joinedAt: Date;
  updatedAt: Date;
}

export interface InvitationCode {
  _id: string;
  elderlyProfileId: string;
  elderlyName: string;
  role: CircleMemberRole;
  relationship?: string;
  permissions: MemberPermissions;
  codeHash: string; // SHA-256 of the 8-digit numeric code
  salt: string;
  createdByUserId: string;
  createdByName: string;
  expiresAt: Date; // e.g. 15 minutes
  maxUses: number; // strictly 1
  usesCount: number;
  usedByUserId?: string;
  usedAt?: Date;
  status: 'pending' | 'used' | 'expired' | 'revoked';
  failedAttempts: number;
  createdAt: Date;
}

export type MedicationForm =
  | 'tablet'
  | 'capsule'
  | 'liquid'
  | 'injection'
  | 'inhaler'
  | 'drops'
  | 'topical'
  | 'patch'
  | 'other';

export type MedicationFrequency =
  'once_daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'as_needed' | 'custom';

export interface Medication {
  _id: string;
  elderlyProfileId: string;
  name: string;
  dosage: string; // e.g. "10mg", "1 tablet", "5ml"
  form: MedicationForm;
  instructions: string; // e.g. "Take after breakfast with a full glass of water"
  frequency: MedicationFrequency;
  scheduledTimes: string[]; // ["08:00", "20:00"] in 24h format
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  status: 'active' | 'paused' | 'discontinued';
  reminderMinutesBefore: number; // default 15 mins
  notes?: string;
  prescribingDoctor?: string;
  color?: string; // Color code for visual identification
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DoseStatus = 'upcoming' | 'pending' | 'taken' | 'skipped' | 'missed';

export interface DoseLog {
  _id: string;
  elderlyProfileId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  form: MedicationForm;
  instructions: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  scheduledDateTime: Date;
  status: DoseStatus;
  recordedAt?: Date;
  recordedByUserId?: string;
  recordedByName?: string;
  recordedRole?: CircleMemberRole;
  notes?: string;
  gracePeriodMinutes: number; // default 60 mins before considered missed
  missedAlertSent?: boolean;
  upcomingReminderSent?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Appointment {
  _id: string;
  elderlyProfileId: string;
  doctorName: string;
  specialty?: string;
  hospitalClinicName: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  location: string;
  reason?: string;
  notes?: string;
  followUpDate?: string;
  preparationChecklist: AppointmentChecklistItem[];
  status: 'scheduled' | 'completed' | 'cancelled';
  remindersSent: {
    reminder24h: boolean;
    reminder2h: boolean;
  };
  createdByUserId: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CareNoteCategory = 'general' | 'handover' | 'medical_observation' | 'urgent';

export interface CareNote {
  _id: string;
  elderlyProfileId: string;
  authorUserId: string;
  authorName: string;
  authorRole: CircleMemberRole;
  category: CareNoteCategory;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  _id: string;
  elderlyProfileId?: string;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface NotificationPreference {
  _id: string;
  elderlyProfileId: string;
  userId: string;
  userEmail: string;
  userName: string;
  emailUpcomingDoses: boolean;
  emailMissedDoses: boolean;
  emailAppointments: boolean;
  emailHandoverNotes: boolean;
  updatedAt: Date;
}

export interface ReminderDelivery {
  _id: string;
  elderlyProfileId: string;
  referenceType:
    | 'dose_upcoming'
    | 'dose_missed'
    | 'appointment_24h'
    | 'appointment_2h'
    | 'invitation'
    | 'verification'
    | 'password_reset';
  referenceId: string;
  recipientUserId: string;
  recipientEmail: string;
  idempotencyKey: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  sentAt?: Date;
  providerMessageId?: string;
  error?: string;
  createdAt: Date;
}

export interface AdherenceStats {
  totalScheduled: number;
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
  adherencePercentage: number;
  currentStreakDays: number;
}

export interface ScheduledEvent {
  _id: string;
  name: string;
  type: 'medication_dose' | 'missed_dose_followup' | 'appointment_24h' | 'appointment_2h';
  elderlyProfileId: string;
  referenceId: string;
  cronExpression?: string;
  runAt?: Date;
  timezone: string;
  status: 'active' | 'cancelled' | 'executed' | 'failed';
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
