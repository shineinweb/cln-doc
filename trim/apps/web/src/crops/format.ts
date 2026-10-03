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
