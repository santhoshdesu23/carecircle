import { describe, it, expect, vi } from 'vitest';
import { recordDoseEvent } from '@/lib/doses';
import * as collections from '@/lib/database/collections';

describe('Concurrency & Duplicate Dose Prevention', () => {
  it('should prevent duplicate doses and atomically record dose status', async () => {
    const mockMed = {
      _id: 'med_lisinopril',
      elderlyProfileId: 'prof_eleanor',
      name: 'Lisinopril',
      dosage: '10mg',
      form: 'tablet' as const,
      instructions: 'Take with water',
    };

    const mockProfile = {
      _id: 'prof_eleanor',
      timezone: 'America/New_York',
    };

    const mockUpdatedDose = {
      _id: 'dose_med_lisinopril_2026-11-15_0830',
      elderlyProfileId: 'prof_eleanor',
      medicationId: 'med_lisinopril',
      medicationName: 'Lisinopril',
      dosage: '10mg',
      form: 'tablet' as const,
      instructions: 'Take with water',
      scheduledDate: '2026-11-15',
      scheduledTime: '08:30',
      status: 'taken' as const,
      recordedByName: 'Nurse Clara',
      recordedRole: 'caretaker' as const,
    };

    vi.spyOn(collections, 'getMedicationsCollection').mockResolvedValue({
      findOne: vi.fn().mockResolvedValue(mockMed),
    } as any);

    vi.spyOn(collections, 'getElderlyProfilesCollection').mockResolvedValue({
      findOne: vi.fn().mockResolvedValue(mockProfile),
    } as any);

    const mockFindOneAndUpdate = vi.fn().mockResolvedValue(mockUpdatedDose);
    vi.spyOn(collections, 'getDoseLogsCollection').mockResolvedValue({
      findOneAndUpdate: mockFindOneAndUpdate,
      findOne: vi.fn().mockResolvedValue(mockUpdatedDose),
    } as any);

    // Concurrently trigger dose recording by two caretakers
    const [result1, result2] = await Promise.all([
      recordDoseEvent({
        elderlyProfileId: 'prof_eleanor',
        medicationId: 'med_lisinopril',
        scheduledDate: '2026-11-15',
        scheduledTime: '08:30',
        status: 'taken',
        recordedByUserId: 'usr_clara',
        recordedByName: 'Nurse Clara',
        recordedRole: 'caretaker',
      }),
      recordDoseEvent({
        elderlyProfileId: 'prof_eleanor',
        medicationId: 'med_lisinopril',
        scheduledDate: '2026-11-15',
        scheduledTime: '08:30',
        status: 'taken',
        recordedByUserId: 'usr_david',
        recordedByName: 'David Vance',
        recordedRole: 'family',
      }),
    ]);

    expect(result1.status).toBe('taken');
    expect(result2.status).toBe('taken');
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(2);

    // Verify atomic query targeted exact compound key
    const callArgs = mockFindOneAndUpdate.mock.calls[0];
    expect(callArgs[0]).toEqual({
      medicationId: 'med_lisinopril',
      scheduledDate: '2026-11-15',
      scheduledTime: '08:30',
    });
    expect(callArgs[2]).toEqual({ upsert: true, returnDocument: 'after' });
  });

  it('should reject dose recording if medication belongs to a different profile', async () => {
    vi.spyOn(collections, 'getMedicationsCollection').mockResolvedValueOnce({
      findOne: vi.fn().mockResolvedValue({
        _id: 'med_alien',
        elderlyProfileId: 'prof_stranger', // Alien profile!
      }),
    } as any);

    await expect(
      recordDoseEvent({
        elderlyProfileId: 'prof_eleanor',
        medicationId: 'med_alien',
        scheduledDate: '2026-11-15',
        scheduledTime: '08:30',
        status: 'taken',
        recordedByUserId: 'usr_hacker',
        recordedByName: 'Hacker',
        recordedRole: 'family',
      })
    ).rejects.toThrow('Medication not found or does not belong');
  });
});
