import { computeClientSummary, dateRangeForAnchor, filterByDateRange } from './computeClientSummary';
import type { ClientSummary, PaymentPeriodMode } from './computeClientSummary';
import type { Client } from '../clients/useClients';
import type { WorkSession } from '../work-sessions/useWorkSessions';
import type { Payment } from './usePayments';

export interface ClientPaymentRow {
  client: Client;
  summary: ClientSummary;
}

/** Accoppia ogni cliente al proprio riepilogo (ore/dovuto/ricevuto/saldo), filtrato sulla settimana o sul mese in visualizzazione — stessa logica prima duplicata inline in pagamenti.tsx, ora condivisa anche dal drill-down per metrica. */
export function buildClientPaymentRows(
  clients: Client[],
  sessions: WorkSession[],
  payments: Payment[],
  mode: PaymentPeriodMode,
  anchorDate: string,
  now = new Date()
): ClientPaymentRow[] {
  const range = dateRangeForAnchor(mode, anchorDate, now);
  const filteredSessions = filterByDateRange(sessions, range);
  const filteredPayments = filterByDateRange(payments, range);

  return clients.map((client) => {
    const clientSessions = filteredSessions.filter((s) => s.client_id === client.id);
    const clientPayments = filteredPayments.filter((p) => p.client_id === client.id);
    return { client, summary: computeClientSummary(clientSessions, clientPayments) };
  });
}
