import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import { toLocalDateString } from '../../lib/dates';
import { cancelReminderFor } from '../notifications/syncReminders';
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
        .select('id, title, category, person, weekday, start_time, end_time, note')
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
      startTime?: string;
      endTime?: string;
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
          start_time: input.startTime || null,
          end_time: input.endTime || null,
          note: input.note || null,
        })
        .select('id, title, category, person, weekday, start_time, end_time, note')
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
      startTime?: string;
      endTime?: string;
      note?: string;
    }) => {
      const { data: current } = await supabase
        .from('recurring_templates')
        .select('weekday')
        .eq('id', input.id)
        .single();

      const { data, error } = await supabase
        .from('recurring_templates')
        .update({
          title: input.title,
          category: input.category,
          person: input.person,
          weekday: input.weekday,
          start_time: input.startTime || null,
          end_time: input.endTime || null,
          note: input.note || null,
        })
        .eq('id', input.id)
        .select('id, title, category, person, weekday, start_time, end_time, note')
        .single();
      if (error) throw error;

      let orphanedOverrideIds: string[] = [];
      if (current && current.weekday !== input.weekday) {
        const today = toLocalDateString(new Date());
        const { data: futureOverrides } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('recurring_template_id', input.id)
          .gte('date', today);
        orphanedOverrideIds = (futureOverrides ?? []).map((o) => o.id);
        if (orphanedOverrideIds.length > 0) {
          await supabase.from('calendar_events').delete().in('id', orphanedOverrideIds);
        }
      }

      return { template: data, orphanedOverrideIds };
    },
    onSuccess: ({ orphanedOverrideIds }) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-templates'] });
      if (orphanedOverrideIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
        for (const id of orphanedOverrideIds) {
          cancelReminderFor(`event:${id}`);
        }
      }
    },
  });
}

export function useDeleteRecurringTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: overrides } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('recurring_template_id', id);
      const { error } = await supabase.from('recurring_templates').delete().eq('id', id);
      if (error) throw error;
      return { id, overrideIds: (overrides ?? []).map((o) => o.id) };
    },
    onSuccess: ({ id, overrideIds }) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-templates'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      cancelReminderFor(`template:${id}`);
      for (const overrideId of overrideIds) {
        cancelReminderFor(`event:${overrideId}`);
      }
    },
  });
}
