import { computeClientSummary, dateRangeForPeriod, filterByDateRange } from './computeClientSummary';
import type { ClientSummary, Period } from './computeClientSummary';
import type { Client } from '../clients/useClients';
import type { WorkSession } from '../work-sessions/useWorkSessions';
import type { Payment } from './usePayments';

export interface ClientPaymentRow {
  client: Client;
  summary: ClientSummary;
}

/** Accoppia ogni cliente al proprio riepilogo (ore/dovuto/ricevuto/saldo), filtrato per periodo — stessa logica prima duplicata inline in pagamenti.tsx, ora condivisa anche dal drill-down per metrica. */
export function buildClientPaymentRows(
  clients: Client[],
  sessions: WorkSession[],
  payments: Payment[],
  period: Period,
  now = new Date()
): ClientPaymentRow[] {
  const range = dateRangeForPeriod(period, now);
  const filteredSessions = filterByDateRange(sessions, range);
  const filteredPayments = filterByDateRange(payments, range);

  return clients.map((client) => {
    const clientSessions = filteredSessions.filter((s) => s.client_id === client.id);
    const clientPayments = filteredPayments.filter((p) => p.client_id === client.id);
    return { client, summary: computeClientSummary(clientSessions, clientPayments) };
  });
}
