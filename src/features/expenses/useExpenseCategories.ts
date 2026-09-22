import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';

export interface ExpenseCategoryRow {
  id: string;
  slug: string;
  label: string;
  sort_order: number;
}

export function useExpenseCategories() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['expense-categories', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<ExpenseCategoryRow[]> => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('id, slug, label, sort_order')
        .eq('household_id', householdId!)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data as ExpenseCategoryRow[];
    },
  });
}

/** Crea una categoria custom — `slug` non viene passato, il DB genera un identificatore interno casuale (mai mostrato: l'utente vede solo `label`). Stesso principio di useCreateNoteSection. */
export function useCreateExpenseCategory() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  const { data: existingCategories } = useExpenseCategories();

  return useMutation({
    mutationFn: async (input: { label: string }) => {
      if (!household) throw new Error('No household');
      const nextSortOrder = (existingCategories ?? []).reduce((max, c) => Math.max(max, c.sort_order), -1) + 1;
      const { data, error } = await supabase
        .from('expense_categories')
        .insert({ household_id: household.id, label: input.label, sort_order: nextSortOrder })
        .select('id, slug, label, sort_order')
        .single();
      if (error) throw error;
      return data as ExpenseCategoryRow;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expense-categories'] }),
  });
}
