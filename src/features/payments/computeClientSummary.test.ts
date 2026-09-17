import { computeClientSummary } from './computeClientSummary';
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
