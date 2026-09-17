import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';

export interface Household {
  id: string;
  name: string;
  invite_code: string;
}

export function useHousehold() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['household', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Household | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('household_members')
        .select('households(id, name, invite_code)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.households ?? null;
    },
  });
}

export function useCreateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc('create_household', { p_name: name });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
  });
}

export function useJoinHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_household', { p_code: code });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
  });
}
