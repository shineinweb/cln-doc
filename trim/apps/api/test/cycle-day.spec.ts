import { cycleDayNumber } from '../src/cycles/cycle-day';

describe('cycle day in the site timezone', () => {
  it('counts the start date as day 1', () => {
    const now = new Date('2026-10-03T15:00:00.000Z');
    expect(cycleDayNumber('2026-10-03', 'America/Los_Angeles', now)).toBe(1);
    expect(cycleDayNumber('2026-09-01', 'America/Los_Angeles', now)).toBe(33);
  });

  it('uses the site calendar date when UTC has already rolled over', () => {
    const now = new Date('2026-10-04T02:00:00.000Z');
    expect(cycleDayNumber('2026-10-03', 'America/Los_Angeles', now)).toBe(1);
    expect(cycleDayNumber('2026-10-03', 'UTC', now)).toBe(2);
  });
});
