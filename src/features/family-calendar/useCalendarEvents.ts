import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import { cancelReminderFor, syncReminderFor } from '../notifications/syncReminders';
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
        .select('id, recurring_template_id, title, category, person, date, start_time, end_time, note, is_cancelled')
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
      startTime?: string;
      endTime?: string;
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
          start_time: input.startTime || null,
          end_time: input.endTime || null,
          note: input.note || null,
        })
        .select('id, recurring_template_id, title, category, person, date, start_time, end_time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      syncReminderFor(`event:${data.id}`, `Promemoria: ${data.title}`, `${data.person} — domani`, data.date, data.start_time);
    },
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
      startTime?: string;
      endTime?: string;
      note?: string;
    }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update({
          title: input.title,
          category: input.category,
          person: input.person,
          date: input.date,
          start_time: input.startTime || null,
          end_time: input.endTime || null,
          note: input.note || null,
        })
        .eq('id', input.id)
        .select('id, recurring_template_id, title, category, person, date, start_time, end_time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      syncReminderFor(`event:${data.id}`, `Promemoria: ${data.title}`, `${data.person} — domani`, data.date, data.start_time);
    },
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
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      cancelReminderFor(`event:${id}`);
    },
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
      startTime?: string;
      endTime?: string;
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
            start_time: input.startTime || null,
            end_time: input.endTime || null,
            note: input.note || null,
            is_cancelled: input.isCancelled,
          },
          { onConflict: 'recurring_template_id,date' }
        )
        .select('id, recurring_template_id, title, category, person, date, start_time, end_time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      if (data.is_cancelled) {
        cancelReminderFor(`event:${data.id}`);
      } else {
        syncReminderFor(`event:${data.id}`, `Promemoria: ${data.title}`, `${data.person} — domani`, data.date, data.start_time);
      }
    },
  });
}
