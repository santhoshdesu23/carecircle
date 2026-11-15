import { describe, it, expect } from 'vitest';
import { parseDateTimeInTimezone, getTodayDateString } from '@/lib/utils';

describe('Timezone-Aware Scheduling Engine', () => {
  it('should accurately convert local wall-clock times to UTC timestamps across timezones', () => {
    // 08:30 AM in New York (EST, UTC-5)
    const nyDate = parseDateTimeInTimezone('2026-11-15', '08:30', 'America/New_York');
    expect(nyDate.toISOString()).toBe('2026-11-15T13:30:00.000Z');

    // 08:30 AM in India (IST, UTC+5:30)
    const istDate = parseDateTimeInTimezone('2026-11-15', '08:30', 'Asia/Kolkata');
    expect(istDate.toISOString()).toBe('2026-11-15T03:00:00.000Z');

    // 08:30 AM in London (GMT, UTC+0 in winter)
    const gmtDate = parseDateTimeInTimezone('2026-11-15', '08:30', 'Europe/London');
    expect(gmtDate.toISOString()).toBe('2026-11-15T08:30:00.000Z');
  });

  it('should accurately handle Daylight Saving Time (EDT, UTC-4)', () => {
    // Summer date: 2026-07-15 at 08:30 in New York is EDT (UTC-4)
    const edtDate = parseDateTimeInTimezone('2026-07-15', '08:30', 'America/New_York');
    expect(edtDate.toISOString()).toBe('2026-07-15T12:30:00.000Z');
  });

  it('should produce local date string for specific timezones', () => {
    const todayStr = getTodayDateString('UTC');
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
