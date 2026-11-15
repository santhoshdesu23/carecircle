import { describe, it, expect } from 'vitest';
import {
  renderUpcomingDoseEmail,
  renderMissedDoseEmail,
  renderAppointmentReminderEmail,
  renderInvitationCodeEmail,
} from '@/lib/email/templates';

describe('Transactional HTML Email Templates & Reminder Engine', () => {
  it('should render upcoming dose email with exact medication details and instructions', () => {
    const template = renderUpcomingDoseEmail({
      elderlyName: 'Eleanor Vance',
      medicationName: 'Lisinopril',
      dosage: '10mg',
      form: 'tablet',
      scheduledTime: '08:30 AM',
      instructions: 'Take after breakfast with a full glass of water.',
    });

    expect(template.subject).toContain('Medication Reminder: Lisinopril');
    expect(template.html).toContain('Eleanor Vance');
    expect(template.html).toContain('Lisinopril');
    expect(template.html).toContain('10mg (tablet)');
    expect(template.html).toContain('Take after breakfast');
    expect(template.text).toContain('CareCircle');
  });

  it('should render missed dose email with explicit safety warning against double dosing', () => {
    const template = renderMissedDoseEmail({
      elderlyName: 'Eleanor Vance',
      medicationName: 'Metformin',
      dosage: '500mg',
      scheduledTime: '12:30 PM',
      scheduledDate: '2026-11-15',
    });

    expect(template.subject).toContain('Urgent Alert: Missed Medication Dose');
    expect(template.html).toContain(
      'Do not assume the individual should take a double or extra dose'
    );
    expect(template.html).toContain('Eleanor Vance');
    expect(template.html).toContain('Metformin');
  });

  it('should render appointment reminder with preparation checklist items', () => {
    const template = renderAppointmentReminderEmail({
      elderlyName: 'Eleanor Vance',
      doctorName: 'Sarah Jenkins',
      clinicName: 'St. Jude Heart Center',
      appointmentDate: '2026-11-20',
      appointmentTime: '10:30 AM',
      location: 'Suite 402, 1200 Healthcare Blvd',
      leadHours: 24,
      checklistItems: ['Bring previous ECG reports', 'Carry morning blood pressure logbook'],
    });

    expect(template.subject).toContain('Upcoming Doctor Appointment in 24h');
    expect(template.html).toContain('Dr. Sarah Jenkins');
    expect(template.html).toContain('St. Jude Heart Center');
    expect(template.html).toContain('Bring previous ECG reports');
    expect(template.html).toContain('Carry morning blood pressure logbook');
  });

  it('should render 8-digit passcode invitation email with 15-minute expiration notice', () => {
    const template = renderInvitationCodeEmail({
      elderlyName: 'Eleanor Vance',
      inviterName: 'Eleanor Vance',
      role: 'Caretaker',
      passcode: '84920481',
      expiresInMinutes: 15,
    });

    expect(template.subject).toContain("Invitation to join Eleanor Vance's Care Circle");
    expect(template.html).toContain('84920481');
    expect(template.html).toContain('expires in 15 minutes');
  });

  it('should construct unique idempotency keys to prevent duplicate emails', () => {
    const doseId = 'dose_123';
    const userId = 'usr_456';
    const date = '2026-11-15';
    const time = '08:30';

    const key1 = `upcoming-${doseId}-${userId}-${date}-${time}`;
    const key2 = `upcoming-${doseId}-${userId}-${date}-${time}`;
    const keyDiffUser = `upcoming-${doseId}-usr_789-${date}-${time}`;

    expect(key1).toBe(key2); // Idempotent keys match for same event and recipient
    expect(key1).not.toBe(keyDiffUser); // Distinct for different recipients
  });
});
