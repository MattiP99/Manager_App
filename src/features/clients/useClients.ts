import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';

export interface Client {
  id: string;
  name: string;
  hourly_rate: number;
  active: boolean;
}

export function useClients() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['clients', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, hourly_rate, active')
        .eq('household_id', householdId!)
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateClient() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, hourlyRate }: { name: string; hourlyRate: number }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('clients')
        .insert({ household_id: household.id, name, hourly_rate: hourlyRate })
        .select('id, name, hourly_rate, active')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      hourlyRate,
      active,
    }: {
      id: string;
      name?: string;
      hourlyRate?: number;
      active?: boolean;
    }) => {
      const updates: { name?: string; hourly_rate?: number; active?: boolean } = {};
      if (name !== undefined) updates.name = name;
      if (hourlyRate !== undefined) updates.hourly_rate = hourlyRate;
      if (active !== undefined) updates.active = active;
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select('id, name, hourly_rate, active')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}
