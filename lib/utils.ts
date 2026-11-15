import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import crypto from 'node:crypto';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStringOrDate: string | Date | undefined | null): string {
  if (!dateStringOrDate) return 'N/A';
  try {
    const d = typeof dateStringOrDate === 'string' ? new Date(dateStringOrDate) : dateStringOrDate;
    if (Number.isNaN(d.getTime())) return String(dateStringOrDate);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(dateStringOrDate);
  }
}

export function formatTime(time24: string): string {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  const hours = Number.parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

export function getTodayDateString(timezone: string = 'UTC'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export function parseDateTimeInTimezone(
  dateStr: string,
  timeStr: string,
  timezone: string = 'UTC'
): Date {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    // Initial UTC date assuming target time was in UTC
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(utcDate);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const tzHours = Number.parseInt(partMap.hour === '24' ? '0' : partMap.hour, 10);
    const tzMinutes = Number.parseInt(partMap.minute, 10);
    const tzDay = Number.parseInt(partMap.day, 10);

    const diffMinutes =
      tzDay * 1440 + tzHours * 60 + tzMinutes - (day * 1440 + hours * 60 + minutes);

    return new Date(utcDate.getTime() - diffMinutes * 60 * 1000);
  } catch {
    return new Date(`${dateStr}T${timeStr}:00Z`);
  }
}

export function generateRandomNumericCode(digits: number = 8): string {
  try {
    if (typeof window !== 'undefined' && window.crypto) {
      const array = new Uint32Array(digits);
      window.crypto.getRandomValues(array);
      return Array.from(array, (val) => (val % 10).toString()).join('');
    }
    let code = '';
    for (let i = 0; i < digits; i++) {
      code += crypto.randomInt(0, 10).toString();
    }
    return code;
  } catch {
    let code = '';
    for (let i = 0; i < digits; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }
}
