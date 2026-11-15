import { describe, it, expect } from 'vitest';
import {
  signUpSchema,
  medicationSchema,
  appointmentSchema,
  recordDoseSchema,
  redeemInvitationSchema,
} from '@/lib/validations';

describe('Zod Validation Schemas', () => {
  it('should validate complete sign up payloads and reject weak passwords', () => {
    const valid = signUpSchema.safeParse({
      name: 'Eleanor Vance',
      email: 'eleanor@carecircle.demo',
      password: 'CareCircle2026!',
      role: 'elderly',
    });
    expect(valid.success).toBe(true);

    const weakPassword = signUpSchema.safeParse({
      name: 'Eleanor Vance',
      email: 'eleanor@carecircle.demo',
      password: 'weak',
      role: 'elderly',
    });
    expect(weakPassword.success).toBe(false);
  });

  it('should validate medication schedules and 24h time formats', () => {
    const validMed = medicationSchema.safeParse({
      elderlyProfileId: 'prof_123',
      name: 'Lisinopril',
      dosage: '10mg',
      form: 'tablet',
      instructions: 'Take 1 tablet every morning with water.',
      frequency: 'once_daily',
      scheduledTimes: ['08:30'],
      startDate: '2026-11-15',
      endDate: null,
      reminderMinutesBefore: 15,
    });
    expect(validMed.success).toBe(true);

    const invalidTimeMed = medicationSchema.safeParse({
      elderlyProfileId: 'prof_123',
      name: 'Lisinopril',
      dosage: '10mg',
      form: 'tablet',
      instructions: 'Take with water',
      frequency: 'once_daily',
      scheduledTimes: ['8:30 AM'], // Not 24-hour HH:mm
      startDate: '2026-11-15',
    });
    expect(invalidTimeMed.success).toBe(false);
  });

  it('should validate appointment details and preparation checklist', () => {
    const validAppt = appointmentSchema.safeParse({
      elderlyProfileId: 'prof_123',
      doctorName: 'Sarah Jenkins',
      hospitalClinicName: 'St. Jude Heart Center',
      appointmentDate: '2026-11-20',
      appointmentTime: '10:30',
      location: 'Suite 402, 1200 Healthcare Blvd',
      preparationChecklist: [{ id: '1', text: 'Carry blood pressure log', completed: false }],
    });
    expect(validAppt.success).toBe(true);
  });

  it('should validate dose recording payload', () => {
    const validDose = recordDoseSchema.safeParse({
      medicationId: 'med_123',
      elderlyProfileId: 'prof_123',
      scheduledDate: '2026-11-15',
      scheduledTime: '08:30',
      status: 'taken',
      notes: 'Taken with breakfast',
    });
    expect(validDose.success).toBe(true);
  });

  it('should enforce exact 8-digit numeric invitation codes', () => {
    expect(redeemInvitationSchema.safeParse({ code: '12345678' }).success).toBe(true);
    expect(redeemInvitationSchema.safeParse({ code: '1234567' }).success).toBe(false);
    expect(redeemInvitationSchema.safeParse({ code: '123456789' }).success).toBe(false);
    expect(redeemInvitationSchema.safeParse({ code: '1234ABCD' }).success).toBe(false);
  });
});
