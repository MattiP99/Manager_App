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

export type Period = 'week' | 'month' | 'all';

export function dateRangeForPeriod(period: Period, now = new Date()): { start: string; end: string } | null {
  if (period === 'all') return null;

  const end = now.toISOString().slice(0, 10);
  const start = new Date(now);
  if (period === 'week') {
    start.setDate(start.getDate() - 7);
  } else {
    start.setMonth(start.getMonth() - 1);
  }
  return { start: start.toISOString().slice(0, 10), end };
}

export function filterByDateRange<T extends { date: string }>(items: T[], range: { start: string; end: string } | null): T[] {
  if (!range) return items;
  return items.filter((item) => item.date >= range.start && item.date <= range.end);
}
