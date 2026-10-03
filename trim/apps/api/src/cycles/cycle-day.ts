const MS_PER_DAY = 86_400_000;

/** Calendar date in a timezone, as YYYY-MM-DD. */
export function calendarDateInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Prisma @db.Date values are UTC midnight. Keep the calendar date, not the local shift. */
export function dateKeyFromDbDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Day 1 is the start date in the site timezone.
 * A cycle that starts today is day 1. Earlier dates count forward; future dates are zero or negative.
 */
export function cycleDayNumber(startDateKey: string, timeZone: string, now: Date = new Date()): number {
  const todayKey = calendarDateInTimeZone(now, timeZone);
  const start = Date.parse(`${startDateKey}T00:00:00.000Z`);
  const today = Date.parse(`${todayKey}T00:00:00.000Z`);
  return Math.round((today - start) / MS_PER_DAY) + 1;
}
