import { endOfMonth, endOfWeek, parseLocalDateString, startOfMonth, startOfWeek, toLocalDateString } from '../../lib/dates';
import { ITALIAN_MONTHS } from '../calendar/calendarGrid';
import type { WorkSession } from '../work-sessions/useWorkSessions';
import type { Payment } from './usePayments';

export interface ClientSummary {
  totalHours: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
}

export function computeClientSummary(sessions: WorkSession[], payments: Payment[]): ClientSummary {
  const totalHours = sessions.reduce((sum, s) => sum + s.hours, 0);
  const totalDue = sessions.reduce((sum, s) => sum + s.amount_due, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  return { totalHours, totalDue, totalPaid, balance: totalDue - totalPaid };
}

export type PaymentPeriodMode = 'week' | 'month';

/** Intervallo della settimana (Lun-Dom) o del mese di calendario che contiene anchorDate — a differenza della vecchia finestra mobile "ultimi N giorni da oggi", l'utente sceglie quale settimana/mese guardare spostando anchorDate avanti/indietro. La fine dell'intervallo non supera mai oggi: la settimana/mese corrente non deve contare giorni futuri non ancora accaduti (una settimana/mese completamente nel futuro produce quindi un intervallo vuoto, start > end, che filterByDateRange non farà mai corrispondere a nulla). L'etichetta mostrata (periodLabel) resta invece quella reale del periodo intero. */
export function dateRangeForAnchor(mode: PaymentPeriodMode, anchorDate: string, now = new Date()): { start: string; end: string } {
  const range = mode === 'week'
    ? { start: startOfWeek(anchorDate), end: endOfWeek(anchorDate) }
    : { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
  const today = toLocalDateString(now);
  return { start: range.start, end: range.end < today ? range.end : today };
}

/** Etichetta leggibile del periodo esatto in visualizzazione (es. "15 - 21 Set 2026" o "Settembre 2026") — stessa logica di formatPeriodLabel in calendarGrid.ts per la settimana a cavallo di due mesi/anni, duplicata qui perché quella funzione richiede un array di CalendarDay che questa schermata non ha. */
export function periodLabel(mode: PaymentPeriodMode, anchorDate: string): string {
  if (mode === 'month') {
    const anchor = parseLocalDateString(anchorDate);
    return `${ITALIAN_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }

  const first = parseLocalDateString(startOfWeek(anchorDate));
  const last = parseLocalDateString(endOfWeek(anchorDate));

  if (first.getFullYear() !== last.getFullYear()) {
    return `${first.getDate()} ${ITALIAN_MONTHS[first.getMonth()]} ${first.getFullYear()} - ${last.getDate()} ${ITALIAN_MONTHS[last.getMonth()]} ${last.getFullYear()}`;
  }
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} - ${last.getDate()} ${ITALIAN_MONTHS[first.getMonth()]} ${first.getFullYear()}`;
  }
  return `${first.getDate()} ${ITALIAN_MONTHS[first.getMonth()]} - ${last.getDate()} ${ITALIAN_MONTHS[last.getMonth()]} ${last.getFullYear()}`;
}

export function filterByDateRange<T extends { date: string }>(items: T[], range: { start: string; end: string }): T[] {
  return items.filter((item) => item.date >= range.start && item.date <= range.end);
}
