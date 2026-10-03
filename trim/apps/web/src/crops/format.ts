/** Add calendar days to a YYYY-MM-DD key. Offset 0 is that date, which is cycle day 1. */
export function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days));
  return utc.toISOString().slice(0, 10);
}

/** Inclusive day count. The start date is day 1. */
export function inclusiveDayCount(startKey: string, endKey: string): number {
  const start = Date.parse(`${startKey}T00:00:00.000Z`);
  const end = Date.parse(`${endKey}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

export function formatCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatNoteWhen(occurredOn: string, occurredAt: string | null, timeZone: string): string {
  if (!occurredAt) {
    return formatCalendarDate(occurredOn);
  }
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) {
    return formatCalendarDate(occurredOn);
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

export function formatTimestamp(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    ...(timeZone ? { timeZoneName: 'short' as const } : {}),
  }).format(date);
}

export function cycleDayLabel(cycleDay: number): string {
  if (cycleDay >= 1) {
    return `Day ${cycleDay}`;
  }
  if (cycleDay === 0) {
    return 'Starts tomorrow';
  }
  return `Starts in ${1 - cycleDay} days`;
}
