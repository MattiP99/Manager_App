import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import type { Expense, ExpenseCategory, FrancescaActivity } from './expenseSummary';

export function useAllExpenses() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['expenses', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, category, label, francesca_activity, amount, date')
        .eq('household_id', householdId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });
}

interface ExpenseInput {
  category: ExpenseCategory;
  label?: string;
  francescaActivity?: FrancescaActivity;
  amount: number;
  date: string;
}

export function useCreateExpense() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          household_id: household.id,
          category: input.category,
          label: input.label || null,
          francesca_activity: input.francescaActivity || null,
          amount: input.amount,
          date: input.date,
        })
        .select('id, category, label, francesca_activity, amount, date')
        .single();
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExpenseInput & { id: string }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          category: input.category,
          label: input.label || null,
          francesca_activity: input.francescaActivity || null,
          amount: input.amount,
          date: input.date,
        })
        .eq('id', input.id)
        .select('id, category, label, francesca_activity, amount, date')
        .single();
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
}
