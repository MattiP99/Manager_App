import { addDays, parseLocalDateString, toLocalDateString } from './dates';

describe('toLocalDateString', () => {
  const originalTZ = process.env.TZ;

  beforeAll(() => {
    // Rome: UTC+1 in March (DST starts later in the month), so a local
    // time just after midnight is still the previous day in UTC. This is
    // exactly the window where the old `.toISOString().slice(0,10)` bug bit.
    process.env.TZ = 'Europe/Rome';
  });

  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  it('returns the local calendar day, not the UTC day, just after local midnight', () => {
    const localMidnightish = new Date(2027, 2, 15, 0, 30); // 2027-03-15 00:30 local (Rome)
    expect(localMidnightish.toISOString().slice(0, 10)).toBe('2027-03-14');
    expect(toLocalDateString(localMidnightish)).toBe('2027-03-15');
  });

  it('formats a plain midday date as YYYY-MM-DD', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 13, 0))).toBe('2026-01-05');
  });
});

describe('parseLocalDateString', () => {
  it('round-trips with toLocalDateString', () => {
    expect(toLocalDateString(parseLocalDateString('2026-09-18'))).toBe('2026-09-18');
  });

  it('parses into a Date at local midnight, not UTC midnight', () => {
    const parsed = parseLocalDateString('2026-09-18');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8);
    expect(parsed.getDate()).toBe(18);
    expect(parsed.getHours()).toBe(0);
  });
});

describe('addDays', () => {
  it('adds days within the same month', () => {
    expect(addDays('2026-09-01', 5)).toBe('2026-09-06');
  });

  it('rolls over into the next month', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03');
  });

  it('rolls over into the previous month when subtracting', () => {
    expect(addDays('2026-09-02', -5)).toBe('2026-08-28');
  });

  it('handles the February leap-year boundary', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // 2028 is a leap year
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01'); // 2027 is not
  });
});
