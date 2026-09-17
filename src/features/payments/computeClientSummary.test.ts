import { computeClientSummary, dateRangeForPeriod, filterByDateRange, toLocalDateString } from './computeClientSummary';
import type { WorkSession } from '../work-sessions/useWorkSessions';
import type { Payment } from './usePayments';

function session(overrides: Partial<WorkSession>): WorkSession {
  return {
    id: 'ws1',
    client_id: 'c1',
    date: '2026-09-01',
    hours: 2,
    rate_snapshot: 10,
    amount_due: 20,
    note: null,
    ...overrides,
  };
}

function payment(overrides: Partial<Payment>): Payment {
  return { id: 'p1', client_id: 'c1', date: '2026-09-02', amount: 20, note: null, ...overrides };
}

describe('computeClientSummary', () => {
  it('sums hours and amount due across sessions', () => {
    const summary = computeClientSummary(
      [session({ hours: 2, amount_due: 20 }), session({ id: 'ws2', hours: 3, amount_due: 30 })],
      []
    );
    expect(summary.totalHours).toBe(5);
    expect(summary.totalDue).toBe(50);
  });

  it('sums payments separately from sessions', () => {
    const summary = computeClientSummary(
      [session({ amount_due: 50 })],
      [payment({ amount: 20 }), payment({ id: 'p2', amount: 10 })]
    );
    expect(summary.totalPaid).toBe(30);
    expect(summary.balance).toBe(20);
  });

  it('returns zeros for no sessions and no payments', () => {
    const summary = computeClientSummary([], []);
    expect(summary).toEqual({ totalHours: 0, totalDue: 0, totalPaid: 0, balance: 0 });
  });

  it('balance can be negative when a client has overpaid', () => {
    const summary = computeClientSummary([session({ amount_due: 20 })], [payment({ amount: 50 })]);
    expect(summary.balance).toBe(-30);
  });
});

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

    // The old buggy approach would report the previous UTC day here.
    expect(localMidnightish.toISOString().slice(0, 10)).toBe('2027-03-14');

    // The fixed helper must report the correct local day.
    expect(toLocalDateString(localMidnightish)).toBe('2027-03-15');
  });

  it('formats a plain midday date as YYYY-MM-DD', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 13, 0))).toBe('2026-01-05');
  });
});

describe('dateRangeForPeriod', () => {
  it("returns null for 'all' (pass-through)", () => {
    expect(dateRangeForPeriod('all')).toBeNull();
  });

  it("'week' is a rolling 7-day window ending today", () => {
    const now = new Date(2026, 8, 18); // 2026-09-18
    expect(dateRangeForPeriod('week', now)).toEqual({ start: '2026-09-11', end: '2026-09-18' });
  });

  it("'month' is a rolling 30-day window, not a calendar month", () => {
    const now = new Date(2026, 8, 18); // 2026-09-18
    expect(dateRangeForPeriod('month', now)).toEqual({ start: '2026-08-19', end: '2026-09-18' });
  });

  // Month-end dates from the original bug report: setMonth()-based "minus a
  // month" used to overflow through non-existent days (e.g. "Feb 31") and
  // roll forward, silently dropping days. The 30-day rolling window must not
  // do that for any of these.
  it.each([
    ['2027-03-31', '2027-03-01'],
    ['2027-03-29', '2027-02-27'],
    ['2027-05-31', '2027-05-01'],
    ['2026-10-31', '2026-10-01'],
  ])('month window for %s starts at %s (no rollover)', (endDate, expectedStart) => {
    const [y, m, d] = endDate.split('-').map(Number);
    const now = new Date(y, m - 1, d);
    expect(dateRangeForPeriod('month', now)).toEqual({ start: expectedStart, end: endDate });
  });
});

describe('filterByDateRange', () => {
  it('returns items unchanged when range is null', () => {
    const items = [session({ date: '2026-01-01' })];
    expect(filterByDateRange(items, null)).toBe(items);
  });

  it('includes items exactly on the start and end boundaries', () => {
    const items = [
      session({ id: 'on-start', date: '2026-09-01' }),
      session({ id: 'on-end', date: '2026-09-08' }),
    ];
    const result = filterByDateRange(items, { start: '2026-09-01', end: '2026-09-08' });
    expect(result.map((i) => i.id)).toEqual(['on-start', 'on-end']);
  });

  it('excludes items one day outside either boundary', () => {
    const items = [
      session({ id: 'before', date: '2026-08-31' }),
      session({ id: 'inside', date: '2026-09-05' }),
      session({ id: 'after', date: '2026-09-09' }),
    ];
    const result = filterByDateRange(items, { start: '2026-09-01', end: '2026-09-08' });
    expect(result.map((i) => i.id)).toEqual(['inside']);
  });
});
