import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scheduleMedicationTimeSlots,
  cancelMedicationSchedules,
  scheduleAppointmentReminders,
  cancelAppointmentSchedules,
  processReminderEvent,
} from '@/lib/schedules';
import { Medication, Appointment, ScheduledEvent } from '@/types';

// Mock database and external email/schedules
vi.mock('@vercel/schedules', () => ({
  Schedules: {
    create: vi.fn().mockResolvedValue({ scheduleId: 'sched_mock' }),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/email', () => ({
  sendTransactionalEmail: vi.fn().mockImplementation((params: any) => {
    if (mockDeliveries[params.idempotencyKey]?.status === 'sent') {
      return Promise.resolve({ success: true, status: 'skipped' });
    }
    mockDeliveries[params.idempotencyKey] = { status: 'sent' };
    return Promise.resolve({
      success: true,
      messageId: 'resend_msg_mock_123',
      status: 'sent',
    });
  }),
}));

const mockSchedules: Record<string, ScheduledEvent> = {};
const mockDeliveries: Record<string, any> = {};

vi.mock('@/lib/database/collections', () => ({
  getCollection: vi.fn().mockImplementation((colName: string) => {
    if (colName === 'schedules') {
      return {
        updateOne: vi.fn().mockImplementation(({ _id }, { $set }) => {
          mockSchedules[_id] = { ...mockSchedules[_id], ...$set, _id };
          return Promise.resolve({ acknowledged: true });
        }),
        updateMany: vi.fn().mockImplementation(({ referenceId }, { $set }) => {
          Object.keys(mockSchedules).forEach((id) => {
            if (mockSchedules[id].referenceId === referenceId) {
              mockSchedules[id] = { ...mockSchedules[id], ...$set };
            }
          });
          return Promise.resolve({ acknowledged: true });
        }),
        find: vi.fn().mockImplementation((query) => ({
          toArray: () => {
            const list = Object.values(mockSchedules).filter((s) => {
              if (query.referenceId && s.referenceId !== query.referenceId) return false;
              if (query.status && s.status !== query.status) return false;
              return true;
            });
            return Promise.resolve(list);
          },
        })),
      };
    }
    if (colName === 'reminderDeliveries') {
      return {
        findOne: vi.fn().mockImplementation(({ idempotencyKey }) => {
          return Promise.resolve(mockDeliveries[idempotencyKey] || null);
        }),
        updateOne: vi.fn().mockImplementation(({ idempotencyKey }, { $set }) => {
          mockDeliveries[idempotencyKey] = {
            ...mockDeliveries[idempotencyKey],
            ...$set,
            idempotencyKey,
          };
          return Promise.resolve({ acknowledged: true });
        }),
      };
    }
    return {};
  }),
  getMedicationsCollection: vi.fn().mockImplementation(() => ({
    findOne: vi.fn().mockImplementation(({ _id }) => {
      if (_id === 'med_active_1') {
        return Promise.resolve({
          _id: 'med_active_1',
          elderlyProfileId: 'prof_1',
          name: 'Metformin',
          dosage: '500mg',
          form: 'tablet',
          status: 'active',
          scheduledTimes: ['08:00', '20:00'],
        });
      }
      if (_id === 'med_already_taken') {
        return Promise.resolve({
          _id: 'med_already_taken',
          elderlyProfileId: 'prof_1',
          name: 'Metformin',
          status: 'active',
        });
      }
      if (_id === 'med_paused_1') {
        return Promise.resolve({
          _id: 'med_paused_1',
          elderlyProfileId: 'prof_1',
          name: 'Aspirin',
          status: 'paused',
        });
      }
      return Promise.resolve(null);
    }),
  })),
  getElderlyProfilesCollection: vi.fn().mockImplementation(() => ({
    findOne: vi.fn().mockResolvedValue({
      _id: 'prof_1',
      fullName: 'Margaret Gable',
      timezone: 'America/New_York',
    }),
  })),
  getAppointmentsCollection: vi.fn().mockImplementation(() => ({
    findOne: vi.fn().mockImplementation(({ _id }) => {
      if (_id === 'appt_active_1') {
        return Promise.resolve({
          _id: 'appt_active_1',
          elderlyProfileId: 'prof_1',
          doctorName: 'Sarah Jenkins',
          specialty: 'Cardiology',
          hospitalClinicName: 'City Heart Clinic',
          appointmentDate: '2026-11-20',
          appointmentTime: '10:00',
          location: 'Suite 400',
          status: 'scheduled',
          preparationChecklist: [{ id: '1', text: 'Fast for 8 hours', completed: false }],
        });
      }
      return Promise.resolve(null);
    }),
  })),
  getDoseLogsCollection: vi.fn().mockImplementation(() => ({
    findOne: vi.fn().mockImplementation(({ medicationId }) => {
      if (medicationId === 'med_already_taken') {
        return Promise.resolve({
          _id: 'dose_1',
          medicationId: 'med_already_taken',
          status: 'taken',
        });
      }
      return Promise.resolve(null);
    }),
  })),
  getNotificationPreferencesCollection: vi.fn().mockImplementation(() => ({
    findOne: vi.fn().mockResolvedValue({
      emailUpcomingDoses: true,
      emailMissedDoses: true,
      emailAppointments: true,
    }),
  })),
  getCareCircleMembersCollection: vi.fn().mockImplementation(() => ({
    find: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          userId: 'user_daughter',
          userEmail: 'daughter@example.com',
          role: 'family',
          status: 'active',
        },
      ]),
    }),
  })),
}));

describe('Vercel Schedules & Queue Reminder Engine', () => {
  beforeEach(() => {
    Object.keys(mockSchedules).forEach((k) => delete mockSchedules[k]);
    Object.keys(mockDeliveries).forEach((k) => delete mockDeliveries[k]);
    vi.clearAllMocks();
  });

  it('should generate recurring cron schedules per medication time slot', async () => {
    const med: Medication = {
      _id: 'med_test_1',
      elderlyProfileId: 'prof_1',
      name: 'Lisinopril',
      dosage: '10mg',
      form: 'tablet',
      instructions: 'With breakfast and dinner',
      frequency: 'twice_daily',
      scheduledTimes: ['08:30', '19:00'],
      startDate: '2026-11-15',
      status: 'active',
      reminderMinutesBefore: 15,
      createdByUserId: 'user_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await scheduleMedicationTimeSlots(med, 'America/New_York');

    expect(mockSchedules['med_med_test_1_0830']).toBeDefined();
    expect(mockSchedules['med_med_test_1_0830'].cronExpression).toBe('30 8 * * *');
    expect(mockSchedules['med_med_test_1_0830'].timezone).toBe('America/New_York');

    expect(mockSchedules['med_med_test_1_1900']).toBeDefined();
    expect(mockSchedules['med_med_test_1_1900'].cronExpression).toBe('0 19 * * *');
  });

  it('should invalidate old schedules when medication is modified or paused', async () => {
    mockSchedules['med_med_test_1_0830'] = {
      _id: 'med_med_test_1_0830',
      name: 'med_med_test_1_0830',
      type: 'medication_dose',
      elderlyProfileId: 'prof_1',
      referenceId: 'med_test_1',
      status: 'active',
      timezone: 'America/New_York',
      payload: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await cancelMedicationSchedules('med_test_1');
    expect(mockSchedules['med_med_test_1_0830'].status).toBe('cancelled');
  });

  it('should generate 24h and 2h one-time schedules for doctor appointments', async () => {
    const appt: Appointment = {
      _id: 'appt_test_1',
      elderlyProfileId: 'prof_1',
      doctorName: 'Dr. John Watson',
      hospitalClinicName: 'Central Clinic',
      appointmentDate: '2026-11-25',
      appointmentTime: '14:00',
      location: 'Room 101',
      status: 'scheduled',
      remindersSent: { reminder24h: false, reminder2h: false },
      preparationChecklist: [],
      createdByUserId: 'user_1',
      createdByName: 'John Doe',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await scheduleAppointmentReminders(appt, 'America/New_York');

    expect(mockSchedules['appt_appt_test_1_24h']).toBeDefined();
    expect(mockSchedules['appt_appt_test_1_24h'].type).toBe('appointment_24h');
    expect(mockSchedules['appt_appt_test_1_2h']).toBeDefined();
    expect(mockSchedules['appt_appt_test_1_2h'].type).toBe('appointment_2h');
  });

  it('should cancel appointment schedules on cancellation or deletion', async () => {
    mockSchedules['appt_appt_test_1_24h'] = {
      _id: 'appt_appt_test_1_24h',
      name: 'appt_appt_test_1_24h',
      type: 'appointment_24h',
      elderlyProfileId: 'prof_1',
      referenceId: 'appt_test_1',
      status: 'active',
      timezone: 'America/New_York',
      payload: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await cancelAppointmentSchedules('appt_test_1');
    expect(mockSchedules['appt_appt_test_1_24h'].status).toBe('cancelled');
  });

  it('should be idempotent and never send duplicate reminders for the same dose', async () => {
    const payload = {
      type: 'medication_dose' as const,
      elderlyProfileId: 'prof_1',
      referenceId: 'med_active_1',
      timeSlot: '08:00',
    };

    // First execution: should deliver
    const res1 = await processReminderEvent(payload);
    expect(res1.success).toBe(true);
    expect(res1.deliveredTo).toContain('daughter@example.com');

    // Second execution with same idempotency key: should not duplicate
    mockDeliveries['dose_med_active_1_2026-11-15_08:00_user_daughter'] = {
      status: 'sent',
    };

    const res2 = await processReminderEvent(payload);
    expect(res2.success).toBe(true);
    expect(res2.deliveredTo?.length).toBe(0);
  });

  it('should skip missed dose alerts if the dose has subsequently been recorded', async () => {
    const payload = {
      type: 'missed_dose_followup' as const,
      elderlyProfileId: 'prof_1',
      referenceId: 'med_already_taken',
      timeSlot: '08:00',
      dateStr: '2026-11-15',
    };

    const res = await processReminderEvent(payload);
    expect(res.success).toBe(true);
    expect(res.skipped).toContain('Dose subsequently marked as taken');
  });

  it('should abort reminders when medication has been paused or deleted', async () => {
    const payload = {
      type: 'medication_dose' as const,
      elderlyProfileId: 'prof_1',
      referenceId: 'med_paused_1',
      timeSlot: '08:00',
    };

    const res = await processReminderEvent(payload);
    expect(res.success).toBe(true);
    expect(res.skipped).toContain('inactive');
  });
});
