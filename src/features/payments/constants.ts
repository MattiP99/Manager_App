import type { ClientSummary, PaymentPeriodMode } from './computeClientSummary';

export type PaymentMetric = keyof ClientSummary;

// subtitle chiarisce cosa misura davvero ogni metrica — aggiunto dopo che
// "Dovuto" (fatturato nel periodo, MAI netto dei pagamenti) è stato letto
// come "quanto manca ancora da incassare" (quello è "Saldo"): parola
// ambigua in italiano, non un errore di calcolo. Un solo punto di
// configurazione, riusato sia dalle card di riepilogo (pagamenti.tsx) sia
// dal drill-down per metrica (PaymentMetricList.tsx).
export const PAYMENT_METRICS: { key: PaymentMetric; label: string; subtitle: string; format: (value: number) => string }[] = [
  { key: 'totalHours', label: 'Ore totali', subtitle: 'Ore lavorate nel periodo', format: (v) => `${v.toFixed(2)}h` },
  { key: 'totalDue', label: 'Dovuto', subtitle: 'Fatturato nel periodo', format: (v) => `€${v.toFixed(2)}` },
  { key: 'totalPaid', label: 'Ricevuto', subtitle: 'Incassato nel periodo', format: (v) => `€${v.toFixed(2)}` },
  { key: 'balance', label: 'Saldo', subtitle: 'Ancora da incassare', format: (v) => `€${v.toFixed(2)}` },
];

export const PERIOD_LABELS: Record<PaymentPeriodMode, string> = { week: 'Settimana', month: 'Mese' };
