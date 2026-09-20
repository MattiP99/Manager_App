import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';

export interface WorkSession {
  id: string;
  client_id: string;
  date: string;
  hours: number;
  rate_snapshot: number;
  amount_due: number;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
}

export interface WorkSessionStatus extends WorkSession {
  status: 'paid' | 'unpaid';
}

export function useWorkSessionsByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['work-session-status', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<WorkSessionStatus[]> => {
      const { data, error } = await supabase
        .from('work_session_status')
        .select('id, client_id, date, hours, rate_snapshot, amount_due, start_time, end_time, note, status')
        .eq('client_id', clientId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WorkSessionStatus[];
    },
  });
}

export function useAllWorkSessions() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['work-sessions', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<WorkSession[]> => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('id, client_id, date, hours, rate_snapshot, amount_due, start_time, end_time, note')
        .eq('household_id', householdId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WorkSession[];
    },
  });
}

export function useAllWorkSessionsStatus() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['work-session-status-all', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<WorkSessionStatus[]> => {
      const { data, error } = await supabase
        .from('work_session_status')
        .select('id, client_id, date, hours, rate_snapshot, amount_due, start_time, end_time, note, status')
        .eq('household_id', householdId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WorkSessionStatus[];
    },
  });
}

export function useCreateWorkSession() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      date,
      hours,
      rateSnapshot,
      startTime,
      endTime,
      note,
    }: {
      clientId: string;
      date: string;
      hours: number;
      rateSnapshot: number;
      startTime: string;
      endTime: string;
      note?: string;
    }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('work_sessions')
        .insert({
          household_id: household.id,
          client_id: clientId,
          date,
          hours,
          rate_snapshot: rateSnapshot,
          start_time: startTime,
          end_time: endTime,
          note: note || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-session-status', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['work-session-status-all'] });
      queryClient.invalidateQueries({ queryKey: ['work-sessions'] });
    },
  });
}
