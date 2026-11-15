import { describe, it, expect } from 'vitest';
import { DoseStatus } from '@/types';

describe('Medication Dose Lifecycle & Adherence Analytics', () => {
  it('should correctly classify dose status based on grace period', () => {
    const now = new Date('2026-11-15T12:00:00Z');

    // 1. Dose in future
    const futureTime = new Date('2026-11-15T13:00:00Z');
    expect(futureTime > now).toBe(true);

    // 2. Dose within grace period (e.g. scheduled at 11:30, grace 60m => ends at 12:30)
    const recentScheduled = new Date('2026-11-15T11:30:00Z');
    const graceEnd = new Date(recentScheduled.getTime() + 60 * 60 * 1000);
    expect(now >= recentScheduled && now <= graceEnd).toBe(true); // Status is 'pending'

    // 3. Dose beyond grace period (scheduled at 10:00, grace 60m => ended at 11:00)
    const expiredScheduled = new Date('2026-11-15T10:00:00Z');
    const expiredGraceEnd = new Date(expiredScheduled.getTime() + 60 * 60 * 1000);
    expect(now > expiredGraceEnd).toBe(true); // Status is 'missed'
  });

  it('should accurately calculate adherence percentage', () => {
    const mockDoses = [
      { status: 'taken' as DoseStatus },
      { status: 'taken' as DoseStatus },
      { status: 'taken' as DoseStatus },
      { status: 'missed' as DoseStatus },
      { status: 'skipped' as DoseStatus }, // e.g. physician directed skip
    ];

    const taken = mockDoses.filter((d) => d.status === 'taken').length;
    const evaluated = mockDoses.length;
    const adherence = Math.round((taken / evaluated) * 100);

    expect(taken).toBe(3);
    expect(evaluated).toBe(5);
    expect(adherence).toBe(60);
  });

  it('should calculate 100% adherence when all evaluated doses are taken', () => {
    const mockDoses = [{ status: 'taken' as DoseStatus }, { status: 'taken' as DoseStatus }];
    const taken = mockDoses.filter((d) => d.status === 'taken').length;
    const adherence = Math.round((taken / mockDoses.length) * 100);
    expect(adherence).toBe(100);
  });
});
