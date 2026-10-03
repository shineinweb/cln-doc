const ABSOLUTE_TIMESTAMP = /(?:[zZ]|[+-]\d{2}:\d{2})$/;
const WALL_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

export function parseRecordedAt(input: string, timeZone: string): Date {
  const value = input.trim();
  if (!value) {
    throw new Error('A timestamp is required.');
  }
  if (ABSOLUTE_TIMESTAMP.test(value)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('That timestamp is not valid.');
    }
    return parsed;
  }
  const match = WALL_TIMESTAMP.exec(value);
  if (!match) {
    throw new Error('That timestamp is not valid.');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? '0');
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = wallAsUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    utc = wallAsUtc - offsetMs(new Date(utc), timeZone);
  }
  return new Date(wallAsUtc - offsetMs(new Date(utc), timeZone));
}

function offsetMs(instant: Date, timeZone: string): number {
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
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  let hour = pick('hour');
  if (hour === 24) {
    hour = 0;
  }
  const asUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), hour, pick('minute'), pick('second'));
  return asUtc - instant.getTime();
}
