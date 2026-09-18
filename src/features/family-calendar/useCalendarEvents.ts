import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import type { CalendarEvent, FamilyCategory } from './recurringOccurrences';

export function useAllCalendarEvents() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['calendar-events', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, recurring_template_id, title, category, person, date, time, note, is_cancelled')
        .eq('household_id', householdId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });
}

export function useCreateCalendarEvent() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      category: FamilyCategory;
      person: string;
      date: string;
      time?: string;
      note?: string;
    }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          household_id: household.id,
          recurring_template_id: null,
          title: input.title,
          category: input.category,
          person: input.person,
          date: input.date,
          time: input.time || null,
          note: input.note || null,
        })
        .select('id, recurring_template_id, title, category, person, date, time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      category: FamilyCategory;
      person: string;
      date: string;
      time?: string;
      note?: string;
    }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update({
          title: input.title,
          category: input.category,
          person: input.person,
          date: input.date,
          time: input.time || null,
          note: input.note || null,
        })
        .eq('id', input.id)
        .select('id, recurring_template_id, title, category, person, date, time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

/** Crea o aggiorna l'eccezione per una specifica occorrenza (recurring_template_id + date), sfruttando il vincolo unique della migrazione 0006. */
export function useUpsertOccurrenceOverride() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      recurringTemplateId: string;
      date: string;
      title: string;
      category: FamilyCategory;
      person: string;
      time?: string;
      note?: string;
      isCancelled: boolean;
    }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('calendar_events')
        .upsert(
          {
            household_id: household.id,
            recurring_template_id: input.recurringTemplateId,
            date: input.date,
            title: input.title,
            category: input.category,
            person: input.person,
            time: input.time || null,
            note: input.note || null,
            is_cancelled: input.isCancelled,
          },
          { onConflict: 'recurring_template_id,date' }
        )
        .select('id, recurring_template_id, title, category, person, date, time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}
