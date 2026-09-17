import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';

export interface Payment {
  id: string;
  client_id: string;
  date: string;
  amount: number;
  note: string | null;
}

export function usePaymentsByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['payments', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, client_id, date, amount, note')
        .eq('client_id', clientId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAllPayments() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['payments-all', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, client_id, date, amount, note')
        .eq('household_id', householdId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePayment() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      date,
      amount,
      note,
    }: {
      clientId: string;
      date: string;
      amount: number;
      note?: string;
    }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('payments')
        .insert({ household_id: household.id, client_id: clientId, date, amount, note: note || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['payments-all'] });
      queryClient.invalidateQueries({ queryKey: ['work-session-status', variables.clientId] });
    },
  });
}
