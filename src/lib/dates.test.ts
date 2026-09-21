import { addDays, endOfMonth, formatCompactHour, hoursBetweenTimes, isEndAfterStart, isValidOptionalTimeRange, isValidTimeFormat, isValidTimeRange, parseLocalDateString, shiftMonth, startOfMonth, toLocalDateString, toShortTime } from './dates';

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

describe('startOfMonth', () => {
  it('returns the first day of the month', () => {
    expect(startOfMonth('2026-09-18')).toBe('2026-09-01');
  });
});

describe('endOfMonth', () => {
  it('returns the last day of a 30-day month', () => {
    expect(endOfMonth('2026-09-05')).toBe('2026-09-30');
  });

  it('returns the last day of a 31-day month', () => {
    expect(endOfMonth('2026-10-05')).toBe('2026-10-31');
  });

  it('returns Feb 29 in a leap year', () => {
    expect(endOfMonth('2028-02-01')).toBe('2028-02-29');
  });

  it('returns Feb 28 in a non-leap year', () => {
    expect(endOfMonth('2027-02-01')).toBe('2027-02-28');
  });
});

describe('shiftMonth', () => {
  it('moves forward one month within the same year', () => {
    expect(shiftMonth('2026-09-15', 1)).toBe('2026-10-01');
  });

  it('moves backward one month within the same year', () => {
    expect(shiftMonth('2026-09-15', -1)).toBe('2026-08-01');
  });

  it('rolls forward across a year boundary', () => {
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-01');
  });

  it('rolls backward across a year boundary', () => {
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-01');
  });
});

describe('toShortTime', () => {
  it('strips trailing seconds from a Postgres time string', () => {
    expect(toShortTime('08:00:00')).toBe('08:00');
  });

  it('leaves an already-short HH:MM string unchanged', () => {
    expect(toShortTime('08:00')).toBe('08:00');
  });
});

describe('formatCompactHour', () => {
  it('strips a leading zero and :00 minutes', () => {
    expect(formatCompactHour('08:00')).toBe('8');
  });

  it('keeps a two-digit hour unchanged when minutes are :00', () => {
    expect(formatCompactHour('13:00')).toBe('13');
  });

  it('keeps non-zero minutes, still stripping the leading zero on the hour', () => {
    expect(formatCompactHour('08:30')).toBe('8:30');
  });

  it('renders midnight as a bare 0', () => {
    expect(formatCompactHour('00:00')).toBe('0');
  });
});

describe('isValidTimeFormat', () => {
  it('accepts a valid zero-padded time', () => {
    expect(isValidTimeFormat('09:30')).toBe(true);
  });

  it('accepts the last valid hour/minute', () => {
    expect(isValidTimeFormat('23:59')).toBe(true);
  });

  it('accepts midnight', () => {
    expect(isValidTimeFormat('00:00')).toBe(true);
  });

  it('rejects an hour of 24 or more', () => {
    expect(isValidTimeFormat('24:00')).toBe(false);
  });

  it('rejects a minute of 60 or more', () => {
    expect(isValidTimeFormat('09:60')).toBe(false);
  });

  it('rejects a non-zero-padded hour', () => {
    expect(isValidTimeFormat('9:30')).toBe(false);
  });

  it('rejects garbage input', () => {
    expect(isValidTimeFormat('not a time')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidTimeFormat('')).toBe(false);
  });
});

describe('isEndAfterStart', () => {
  it('is true when end is later than start', () => {
    expect(isEndAfterStart('09:00', '10:00')).toBe(true);
  });

  it('is false when end equals start', () => {
    expect(isEndAfterStart('09:00', '09:00')).toBe(false);
  });

  it('is false when end is before start', () => {
    expect(isEndAfterStart('10:00', '09:00')).toBe(false);
  });
});

describe('isValidTimeRange', () => {
  it('is true for a valid ordered range', () => {
    expect(isValidTimeRange('09:00', '10:00')).toBe(true);
  });

  it('is false when either side has invalid format', () => {
    expect(isValidTimeRange('9:00', '10:00')).toBe(false);
    expect(isValidTimeRange('09:00', '10:60')).toBe(false);
  });

  it('is false when end is not after start', () => {
    expect(isValidTimeRange('10:00', '09:00')).toBe(false);
  });
});

describe('isValidOptionalTimeRange', () => {
  it('is true when both are empty', () => {
    expect(isValidOptionalTimeRange('', '')).toBe(true);
  });

  it('is true when both are empty after trimming whitespace', () => {
    expect(isValidOptionalTimeRange('  ', '  ')).toBe(true);
  });

  it('is true for a valid ordered range', () => {
    expect(isValidOptionalTimeRange('09:00', '10:00')).toBe(true);
  });

  it('is false when only one side is provided', () => {
    expect(isValidOptionalTimeRange('09:00', '')).toBe(false);
    expect(isValidOptionalTimeRange('', '10:00')).toBe(false);
  });

  it('is false for an invalid or unordered range when both are provided', () => {
    expect(isValidOptionalTimeRange('10:00', '09:00')).toBe(false);
  });
});

describe('hoursBetweenTimes', () => {
  it('computes whole hours', () => {
    expect(hoursBetweenTimes('09:00', '17:00')).toBe(8);
  });

  it('computes fractional hours', () => {
    expect(hoursBetweenTimes('09:00', '09:30')).toBe(0.5);
  });

  it('computes a small range correctly', () => {
    expect(hoursBetweenTimes('14:15', '14:45')).toBe(0.5);
  });
});
