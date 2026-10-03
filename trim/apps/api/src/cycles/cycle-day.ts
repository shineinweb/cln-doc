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

export function dbDateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** Local date and HH:mm in a timezone, as a UTC instant. */
export function zonedDateTimeToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = timeZoneOffsetMs(utcGuess, timeZone);
  const adjusted = new Date(utcGuess.getTime() - offset);
  const corrected = timeZoneOffsetMs(adjusted, timeZone);
  return corrected === offset ? adjusted : new Date(utcGuess.getTime() - corrected);
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return asUtc - instant.getTime();
}

/**
 * Day 1 is the start date in the site timezone.
 * A cycle that starts today is day 1. Earlier dates count forward; future dates are zero or negative.
 */
/** Add calendar days to a YYYY-MM-DD key. Offset 0 is that date, which is cycle day 1 when the key is the start date. */
export function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days));
  return utc.toISOString().slice(0, 10);
}

export function calendarDaysBetween(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00.000Z`);
  const to = Date.parse(`${toKey}T00:00:00.000Z`);
  return Math.round((to - from) / MS_PER_DAY);
}

export function cycleDayNumber(startDateKey: string, timeZone: string, now: Date = new Date()): number {
  const todayKey = calendarDateInTimeZone(now, timeZone);
  const start = Date.parse(`${startDateKey}T00:00:00.000Z`);
  const today = Date.parse(`${todayKey}T00:00:00.000Z`);
  return Math.round((today - start) / MS_PER_DAY) + 1;
}
