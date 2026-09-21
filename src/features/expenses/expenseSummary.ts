import type { FamilyCategory } from '../family-calendar/recurringOccurrences';

export type ExpenseCategory = 'supermercato' | 'frutta_verdura' | 'extra' | 'francesca';
// 'altro' era escluso qui perché non c'era un caso d'uso per una spesa
// Francesca "generica" — ora c'è (vedi migrazione 0012), quindi riusa
// l'intero FamilyCategory invece di escluderne un valore.
export type FrancescaActivity = FamilyCategory;

export interface Expense {
  id: string;
  category: ExpenseCategory;
  label: string | null;
  francesca_activity: FrancescaActivity | null;
  amount: number;
  date: string;
}

export interface CategorySummary {
  category: ExpenseCategory;
  total: number;
  expenses: Expense[];
}

export interface ActivitySummary {
  activity: FrancescaActivity;
  total: number;
  expenses: Expense[];
}

export function summarizeByCategory(expenses: Expense[], categories: ExpenseCategory[]): CategorySummary[] {
  return categories.map((category) => {
    const categoryExpenses = expenses.filter((e) => e.category === category);
    const total = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
    return { category, total, expenses: categoryExpenses };
  });
}

export function summarizeFrancescaByActivity(expenses: Expense[], activities: FrancescaActivity[]): ActivitySummary[] {
  const francescaExpenses = expenses.filter((e) => e.category === 'francesca');
  return activities.map((activity) => {
    const activityExpenses = francescaExpenses.filter((e) => e.francesca_activity === activity);
    const total = activityExpenses.reduce((sum, e) => sum + e.amount, 0);
    return { activity, total, expenses: activityExpenses };
  });
}
