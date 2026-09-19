import { FAMILY_CATEGORIES } from '../family-calendar/constants';
import type { ExpenseCategory, FrancescaActivity } from './expenseSummary';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'supermercato', label: 'Supermercato' },
  { value: 'frutta_verdura', label: 'Frutta e verdura' },
  { value: 'extra', label: 'Extra' },
  { value: 'francesca', label: 'Francesca' },
];

// Le 5 attività reali di Francesca, derivate da FAMILY_CATEGORIES escludendo
// 'altro' (non è un valore valido per francesca_activity — vedi il CHECK
// nella migrazione 0007). Il cast è isolato a questa singola riga: senza,
// TypeScript non restringe il tipo di .value dopo un filter().
export const FRANCESCA_ACTIVITIES = FAMILY_CATEGORIES.filter((c) => c.value !== 'altro') as {
  value: FrancescaActivity;
  label: string;
}[];
