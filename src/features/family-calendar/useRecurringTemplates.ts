import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import type { FamilyCategory, RecurringTemplate } from './recurringOccurrences';

export function useRecurringTemplates() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['recurring-templates', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<RecurringTemplate[]> => {
      const { data, error } = await supabase
        .from('recurring_templates')
        .select('id, title, category, person, weekday, time, note')
        .eq('household_id', householdId!)
        .order('weekday', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data as RecurringTemplate[];
    },
  });
}

export function useCreateRecurringTemplate() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      category: FamilyCategory;
      person: string;
      weekday: number;
      time?: string;
      note?: string;
    }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('recurring_templates')
        .insert({
          household_id: household.id,
          title: input.title,
          category: input.category,
          person: input.person,
          weekday: input.weekday,
          time: input.time || null,
          note: input.note || null,
        })
        .select('id, title, category, person, weekday, time, note')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-templates'] }),
  });
}

export function useUpdateRecurringTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      category: FamilyCategory;
      person: string;
      weekday: number;
      time?: string;
      note?: string;
    }) => {
      const { data, error } = await supabase
        .from('recurring_templates')
        .update({
          title: input.title,
          category: input.category,
          person: input.person,
          weekday: input.weekday,
          time: input.time || null,
          note: input.note || null,
        })
        .eq('id', input.id)
        .select('id, title, category, person, weekday, time, note')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-templates'] }),
  });
}

export function useDeleteRecurringTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_templates').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-templates'] }),
  });
}
