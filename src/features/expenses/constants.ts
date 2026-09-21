import { FAMILY_CATEGORIES } from '../family-calendar/constants';
import type { ExpenseCategory } from './expenseSummary';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'supermercato', label: 'Supermercato' },
  { value: 'frutta_verdura', label: 'Frutta e verdura' },
  { value: 'extra', label: 'Extra' },
  { value: 'francesca', label: 'Francesca' },
];

// Le 6 attività di Francesca (incluso 'altro', vedi migrazione 0012)
// coincidono esattamente con FamilyCategory — stesso elenco del Calendario,
// nessun filtro/cast necessario.
export const FRANCESCA_ACTIVITIES = FAMILY_CATEGORIES;
