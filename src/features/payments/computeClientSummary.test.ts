import { computeClientSummary, dateRangeForAnchor, filterByDateRange, periodLabel } from './computeClientSummary';
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
    start_time: null,
    end_time: null,
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

describe('dateRangeForAnchor', () => {
  // "now" è sempre dopo l'intero periodo testato, così il tetto a oggi
  // (vedi describe successivo) non interferisce con questi casi base.
  const wellAfter = new Date(2028, 0, 1);

  it("'week' returns the Monday-Sunday range containing anchorDate", () => {
    expect(dateRangeForAnchor('week', '2026-09-18', wellAfter)).toEqual({ start: '2026-09-14', end: '2026-09-20' });
  });

  it("'month' returns the calendar month containing anchorDate, not a rolling window", () => {
    expect(dateRangeForAnchor('month', '2026-09-18', wellAfter)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });

  it("'month' handles a short month correctly (no rollover into the next month)", () => {
    expect(dateRangeForAnchor('month', '2027-02-10', wellAfter)).toEqual({ start: '2027-02-01', end: '2027-02-28' });
  });

  it('does not cap the end when the whole period is already in the past', () => {
    const now = new Date(2026, 8, 25); // 2026-09-25, after the week below ends
    expect(dateRangeForAnchor('week', '2026-09-18', now)).toEqual({ start: '2026-09-14', end: '2026-09-20' });
  });

  it('caps the end at today when the anchor is the current week (partly in the future)', () => {
    const now = new Date(2026, 8, 16); // 2026-09-16, a Wednesday inside that same week
    expect(dateRangeForAnchor('week', '2026-09-18', now)).toEqual({ start: '2026-09-14', end: '2026-09-16' });
  });

  it('caps the end at today when the anchor is the current month (partly in the future)', () => {
    const now = new Date(2026, 8, 10); // 2026-09-10, inside September
    expect(dateRangeForAnchor('month', '2026-09-18', now)).toEqual({ start: '2026-09-01', end: '2026-09-10' });
  });

  it('produces an unmatchable range (end before start) for a period entirely in the future', () => {
    const now = new Date(2026, 8, 1); // 2026-09-01, before the whole week below starts
    const range = dateRangeForAnchor('week', '2026-09-18', now);
    expect(range.end < range.start).toBe(true);
  });
});

describe('periodLabel', () => {
  it('formats a month as "Mese Anno"', () => {
    expect(periodLabel('month', '2026-09-18')).toBe('Settembre 2026');
  });

  it('formats a week fully inside one month as "D - D Mese Anno"', () => {
    expect(periodLabel('week', '2026-09-16')).toBe('14 - 20 Settembre 2026');
  });

  it('formats a week spanning two months', () => {
    expect(periodLabel('week', '2026-09-29')).toBe('28 Settembre - 4 Ottobre 2026');
  });

  it('formats a week spanning two years', () => {
    expect(periodLabel('week', '2026-12-30')).toBe('28 Dicembre 2026 - 3 Gennaio 2027');
  });
});

describe('filterByDateRange', () => {
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
