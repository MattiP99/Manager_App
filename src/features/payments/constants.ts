import type { ClientSummary } from './computeClientSummary';

export type PaymentMetric = keyof ClientSummary;

export const PAYMENT_METRICS: { key: PaymentMetric; label: string; format: (value: number) => string }[] = [
  { key: 'totalHours', label: 'Ore totali', format: (v) => `${v.toFixed(2)}h` },
  { key: 'totalDue', label: 'Dovuto', format: (v) => `€${v.toFixed(2)}` },
  { key: 'totalPaid', label: 'Ricevuto', format: (v) => `€${v.toFixed(2)}` },
  { key: 'balance', label: 'Saldo', format: (v) => `€${v.toFixed(2)}` },
];
