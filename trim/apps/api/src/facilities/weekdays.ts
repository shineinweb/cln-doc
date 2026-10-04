import type { Weekday } from '@trim/contracts';

const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function normalizeWeekdays(days: Weekday[] | null | undefined): Weekday[] {
  const chosen = new Set(days ?? []);
  return WEEKDAY_ORDER.filter((day) => chosen.has(day));
}

export function parseWeekdays(value: string | null | undefined): Weekday[] {
  const chosen = new Set((value ?? '').split(',').map((part) => part.trim()).filter(Boolean));
  return WEEKDAY_ORDER.filter((day) => chosen.has(day));
}

export function weekdaysToCsv(days: Weekday[]): string | null {
  const normalized = normalizeWeekdays(days);
  return normalized.length > 0 ? normalized.join(',') : null;
}
