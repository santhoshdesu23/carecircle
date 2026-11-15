import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['elderly', 'family', 'caretaker']),
});

export const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const elderlyProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(100),
  preferredName: z.string().max(50).optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .optional(),
  gender: z.string().optional(),
  emergencyContact: z.object({
    name: z.string().min(2, 'Emergency contact name is required'),
    relationship: z.string().min(2, 'Relationship is required'),
    phoneNumber: z.string().min(7, 'Valid phone number is required'),
    email: z.string().email('Valid email is required').optional().or(z.literal('')),
  }),
  notes: z.string().max(500).optional(),
  timezone: z.string().default('UTC'),
});

export const createInvitationSchema = z.object({
  elderlyProfileId: z.string().min(1, 'Profile ID is required'),
  role: z.enum(['caretaker', 'family']),
  relationship: z.string().max(50).optional(),
  permissions: z.object({
    canManageMedications: z.boolean().default(false),
    canRecordDoses: z.boolean().default(true),
    canManageAppointments: z.boolean().default(false),
    canViewTimeline: z.boolean().default(true),
    canInviteMembers: z.boolean().default(false),
    canLeaveNotes: z.boolean().default(true),
  }),
});

export const redeemInvitationSchema = z.object({
  code: z
    .string()
    .length(8, 'Invitation code must be exactly 8 digits')
    .regex(/^\d{8}$/, 'Code must consist of numbers only'),
});

export const medicationSchema = z.object({
  elderlyProfileId: z.string().min(1, 'Profile ID is required'),
  name: z.string().min(2, 'Medication name is required').max(100),
  dosage: z.string().min(1, 'Dosage is required (e.g. 10mg, 1 tablet)').max(50),
  form: z.enum([
    'tablet',
    'capsule',
    'liquid',
    'injection',
    'inhaler',
    'drops',
    'topical',
    'patch',
    'other',
  ]),
  instructions: z
    .string()
    .min(2, 'Instructions are required (e.g. Take with water after breakfast)')
    .max(300),
  frequency: z.enum([
    'once_daily',
    'twice_daily',
    'three_times_daily',
    'four_times_daily',
    'as_needed',
    'custom',
  ]),
  scheduledTimes: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm 24-hour format'))
    .min(1, 'At least one scheduled time is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD')
    .optional()
    .nullable(),
  reminderMinutesBefore: z.number().int().min(0).max(120).default(15),
  notes: z.string().max(500).optional(),
  prescribingDoctor: z.string().max(100).optional(),
  color: z.string().optional(),
});

export const recordDoseSchema = z.object({
  doseLogId: z.string().optional(),
  medicationId: z.string().min(1, 'Medication ID is required'),
  elderlyProfileId: z.string().min(1, 'Profile ID is required'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  status: z.enum(['taken', 'skipped']),
  notes: z.string().max(300).optional(),
});

export const appointmentSchema = z.object({
  elderlyProfileId: z.string().min(1, 'Profile ID is required'),
  doctorName: z.string().min(2, 'Doctor name is required').max(100),
  specialty: z.string().max(100).optional(),
  hospitalClinicName: z.string().min(2, 'Hospital or clinic name is required').max(150),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  appointmentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time format must be HH:mm'),
  location: z.string().min(2, 'Location or address is required').max(200),
  reason: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  preparationChecklist: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().min(1),
        completed: z.boolean(),
      })
    )
    .default([]),
});

export const careNoteSchema = z.object({
  elderlyProfileId: z.string().min(1, 'Profile ID is required'),
  category: z.enum(['general', 'handover', 'medical_observation', 'urgent']),
  content: z.string().min(2, 'Note content is required').max(1000),
});

export const notificationPreferenceSchema = z.object({
  elderlyProfileId: z.string().min(1),
  emailUpcomingDoses: z.boolean(),
  emailMissedDoses: z.boolean(),
  emailAppointments: z.boolean(),
  emailHandoverNotes: z.boolean(),
});
