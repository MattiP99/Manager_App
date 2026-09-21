import { buildClientPaymentRows } from './clientPaymentRows';
import type { Client } from '../clients/useClients';
import type { WorkSession } from '../work-sessions/useWorkSessions';
import type { Payment } from './usePayments';

function client(id: string, name: string): Client {
  return { id, name, hourly_rate: 20, active: true };
}

function session(id: string, clientId: string, date: string, hours: number, amountDue: number): WorkSession {
  return { id, client_id: clientId, date, hours, rate_snapshot: 20, amount_due: amountDue, start_time: null, end_time: null, note: null };
}

function payment(id: string, clientId: string, date: string, amount: number): Payment {
  return { id, client_id: clientId, date, amount, note: null };
}

describe('buildClientPaymentRows', () => {
  // Fissato ben dopo ogni data usata nei test qui sotto, così il tetto a
  // "oggi" di dateRangeForAnchor (vedi computeClientSummary.test.ts) non
  // interferisce — quel comportamento ha già la sua copertura dedicata lì.
  const wellAfter = new Date(2026, 6, 1);

  it('pairs each client with a summary of only their own sessions and payments', () => {
    const clients = [client('a', 'Alice'), client('b', 'Bob')];
    const sessions = [session('s1', 'a', '2026-06-01', 3, 60), session('s2', 'b', '2026-06-01', 2, 40)];
    const payments = [payment('p1', 'a', '2026-06-01', 30)];

    const rows = buildClientPaymentRows(clients, sessions, payments, 'month', '2026-06-15', wellAfter);

    expect(rows).toEqual([
      { client: clients[0], summary: { totalHours: 3, totalDue: 60, totalPaid: 30, balance: 30 } },
      { client: clients[1], summary: { totalHours: 2, totalDue: 40, totalPaid: 0, balance: 40 } },
    ]);
  });

  it('gives a client with no sessions or payments a zeroed summary instead of omitting them', () => {
    const clients = [client('a', 'Alice')];
    const rows = buildClientPaymentRows(clients, [], [], 'month', '2026-06-15', wellAfter);
    expect(rows).toEqual([{ client: clients[0], summary: { totalHours: 0, totalDue: 0, totalPaid: 0, balance: 0 } }]);
  });

  it('applies the anchored-period filter before aggregating, excluding sessions outside the range', () => {
    const clients = [client('a', 'Alice')];
    const sessions = [session('old', 'a', '2026-05-01', 5, 100), session('recent', 'a', '2026-06-10', 2, 40)];

    const rows = buildClientPaymentRows(clients, sessions, [], 'month', '2026-06-15', wellAfter);

    expect(rows[0].summary).toEqual({ totalHours: 2, totalDue: 40, totalPaid: 0, balance: 40 });
  });

  it('returns rows in the same order as the input clients array', () => {
    const clients = [client('b', 'Bob'), client('a', 'Alice')];
    const rows = buildClientPaymentRows(clients, [], [], 'month', '2026-06-15', wellAfter);
    expect(rows.map((r) => r.client.id)).toEqual(['b', 'a']);
  });
});
