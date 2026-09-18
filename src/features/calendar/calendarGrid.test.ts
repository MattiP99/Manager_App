import {
  formatDayLabel,
  formatPeriodLabel,
  getDayView,
  getMonthGridDays,
  getWeekDays,
  shiftAnchorDate,
  weekdayShortLabel,
} from './calendarGrid';
import { addDays, parseLocalDateString } from '../../lib/dates';

describe('getDayView', () => {
  it('returns a single day marked as in the current period', () => {
    expect(getDayView('2026-09-18')).toEqual([{ date: '2026-09-18', inCurrentPeriod: true }]);
  });
});

describe('getWeekDays', () => {
  it('returns 7 consecutive days starting on Monday and ending on Sunday', () => {
    const days = getWeekDays('2026-09-18');
    expect(days).toHaveLength(7);
    expect(parseLocalDateString(days[0].date).getDay()).toBe(1); // Monday
    expect(parseLocalDateString(days[6].date).getDay()).toBe(0); // Sunday
    for (let i = 1; i < 7; i++) {
      expect(days[i].date).toBe(addDays(days[i - 1].date, 1));
    }
  });

  it('returns the same week whether anchored on its Monday or its Sunday', () => {
    const fromMonday = getWeekDays('2026-09-14');
    const fromSunday = getWeekDays('2026-09-20');
    expect(fromMonday.map((d) => d.date)).toEqual(fromSunday.map((d) => d.date));
  });

  it('marks every day of the week as in the current period', () => {
    const days = getWeekDays('2026-09-18');
    expect(days.every((d) => d.inCurrentPeriod)).toBe(true);
  });
});

describe('getMonthGridDays', () => {
  it('returns full weeks only (a multiple of 7 days)', () => {
    const days = getMonthGridDays('2026-09-01');
    expect(days.length % 7).toBe(0);
  });

  it('starts the grid on a Monday and ends on a Sunday', () => {
    const days = getMonthGridDays('2026-09-01');
    expect(parseLocalDateString(days[0].date).getDay()).toBe(1);
    expect(parseLocalDateString(days[days.length - 1].date).getDay()).toBe(0);
  });

  it('contains every day of the anchor month marked in-period, contiguously', () => {
    const days = getMonthGridDays('2026-09-15');
    for (let i = 1; i < days.length; i++) {
      expect(days[i].date).toBe(addDays(days[i - 1].date, 1));
    }
    const currentPeriodDays = days.filter((d) => d.inCurrentPeriod);
    expect(currentPeriodDays).toHaveLength(30); // September has 30 days
    expect(currentPeriodDays[0].date).toBe('2026-09-01');
    expect(currentPeriodDays[29].date).toBe('2026-09-30');
  });

  it('marks leading/trailing days from adjacent months as not in-period', () => {
    const days = getMonthGridDays('2026-09-15');
    const leading = days.filter((d) => d.date < '2026-09-01');
    const trailing = days.filter((d) => d.date > '2026-09-30');
    expect(leading.length + trailing.length).toBeGreaterThan(0);
    expect(leading.every((d) => !d.inCurrentPeriod)).toBe(true);
    expect(trailing.every((d) => !d.inCurrentPeriod)).toBe(true);
  });

  it('handles February in a leap year (29 days)', () => {
    const days = getMonthGridDays('2028-02-10');
    const currentPeriodDays = days.filter((d) => d.inCurrentPeriod);
    expect(currentPeriodDays).toHaveLength(29);
  });
});

describe('weekdayShortLabel', () => {
  it('returns "Lun" for a Monday date', () => {
    expect(weekdayShortLabel('2026-09-14')).toBe('Lun'); // 2026-09-14 is a Monday
  });

  it('returns "Dom" for a Sunday date', () => {
    expect(weekdayShortLabel('2026-09-20')).toBe('Dom'); // 2026-09-20 is a Sunday
  });
});

describe('formatDayLabel', () => {
  it('formats a date as "D Month YYYY" in Italian', () => {
    expect(formatDayLabel('2026-09-18')).toBe('18 Settembre 2026');
  });
});

describe('formatPeriodLabel', () => {
  it('day view: uses the anchor date directly', () => {
    const anchorDate = '2026-09-18';
    expect(formatPeriodLabel('day', anchorDate, getDayView(anchorDate))).toBe('18 Settembre 2026');
  });

  it('week view within a single month: shows one trailing month/year', () => {
    const anchorDate = '2026-09-18';
    expect(formatPeriodLabel('week', anchorDate, getWeekDays(anchorDate))).toBe('14 - 20 Settembre 2026');
  });

  it('week view spanning two months in the same year: shows both months, one trailing year', () => {
    const anchorDate = '2026-09-28'; // Monday 28 Sep - Sunday 4 Oct 2026
    expect(formatPeriodLabel('week', anchorDate, getWeekDays(anchorDate))).toBe('28 Settembre - 4 Ottobre 2026');
  });

  it('week view spanning a year boundary: shows both months AND both years (the cross-year bug fix)', () => {
    const anchorDate = '2026-12-28'; // Monday 28 Dec 2026 - Sunday 3 Jan 2027
    const label = formatPeriodLabel('week', anchorDate, getWeekDays(anchorDate));
    expect(label).toBe('28 Dicembre 2026 - 3 Gennaio 2027');
    expect(label).toContain('2026');
    expect(label).toContain('2027');
  });

  it('month view: uses the anchor date\'s month/year, not the grid days', () => {
    const anchorDate = '2026-09-15';
    expect(formatPeriodLabel('month', anchorDate, getMonthGridDays(anchorDate))).toBe('Settembre 2026');
  });
});

describe('shiftAnchorDate', () => {
  it('day view: shifts by one day', () => {
    expect(shiftAnchorDate('2026-09-18', 'day', 1)).toBe('2026-09-19');
    expect(shiftAnchorDate('2026-09-18', 'day', -1)).toBe('2026-09-17');
  });

  it('week view: shifts by seven days', () => {
    expect(shiftAnchorDate('2026-09-18', 'week', 1)).toBe('2026-09-25');
    expect(shiftAnchorDate('2026-09-18', 'week', -1)).toBe('2026-09-11');
  });

  it('month view: moves to the same day-of-month in the next/previous month', () => {
    expect(shiftAnchorDate('2026-09-15', 'month', 1)).toBe('2026-10-15');
    expect(shiftAnchorDate('2026-09-15', 'month', -1)).toBe('2026-08-15');
  });

  it('month view: clamps into a shorter target month instead of rolling over (the historical bug)', () => {
    // 31 March minus a month must land on 28 Feb (2026 is not a leap year), not roll forward into March.
    expect(shiftAnchorDate('2026-03-31', 'month', -1)).toBe('2026-02-28');
    expect(shiftAnchorDate('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(shiftAnchorDate('2028-01-31', 'month', 1)).toBe('2028-02-29'); // leap year
  });
});
