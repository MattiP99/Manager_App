import { Expense, monthLabel, summarizeByCategory, summarizeFrancescaByActivity } from './expenseSummary';

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 'e1',
    category: 'supermercato',
    label: null,
    francesca_activity: null,
    amount: 10,
    date: '2026-09-01',
    ...overrides,
  };
}

describe('summarizeByCategory', () => {
  it('sums amounts per category and buckets each expense into its own category', () => {
    const expenses = [
      expense({ id: 'a', category: 'supermercato', amount: 20 }),
      expense({ id: 'b', category: 'supermercato', amount: 15 }),
      expense({ id: 'c', category: 'extra', amount: 5 }),
    ];
    const summary = summarizeByCategory(expenses, ['supermercato', 'frutta_verdura', 'extra', 'francesca']);
    expect(summary.find((s) => s.category === 'supermercato')!.total).toBe(35);
    expect(summary.find((s) => s.category === 'supermercato')!.expenses).toHaveLength(2);
    expect(summary.find((s) => s.category === 'extra')!.total).toBe(5);
    expect(summary.find((s) => s.category === 'frutta_verdura')!.total).toBe(0);
    expect(summary.find((s) => s.category === 'frutta_verdura')!.expenses).toEqual([]);
  });

  it('returns a zero-total entry for a category with no expenses, in the order given', () => {
    const summary = summarizeByCategory([], ['supermercato', 'frutta_verdura', 'extra', 'francesca']);
    expect(summary.map((s) => s.category)).toEqual(['supermercato', 'frutta_verdura', 'extra', 'francesca']);
    expect(summary.every((s) => s.total === 0)).toBe(true);
  });
});

describe('summarizeFrancescaByActivity', () => {
  it('sums amounts per activity, ignoring expenses from other categories', () => {
    const expenses = [
      expense({ id: 'a', category: 'francesca', francesca_activity: 'piscina', amount: 40 }),
      expense({ id: 'b', category: 'francesca', francesca_activity: 'piscina', amount: 10 }),
      expense({ id: 'c', category: 'francesca', francesca_activity: 'mensa', amount: 25 }),
      expense({ id: 'd', category: 'supermercato', amount: 100 }), // non-francesca, deve essere ignorata
    ];
    const summary = summarizeFrancescaByActivity(expenses, ['mensa', 'palestra', 'cavallo', 'piscina', 'teatro']);
    expect(summary.find((s) => s.activity === 'piscina')!.total).toBe(50);
    expect(summary.find((s) => s.activity === 'mensa')!.total).toBe(25);
    expect(summary.find((s) => s.activity === 'palestra')!.total).toBe(0);
    const grandTotal = summary.reduce((sum, s) => sum + s.total, 0);
    expect(grandTotal).toBe(75); // i 100 della spesa supermercato NON devono entrare
  });
});

describe('monthLabel', () => {
  it('formats a date as "Mese Anno" in Italian', () => {
    expect(monthLabel('2026-09-18')).toBe('Settembre 2026');
  });

  it('uses the year of the given date, not the current year', () => {
    expect(monthLabel('2027-01-05')).toBe('Gennaio 2027');
  });
});
