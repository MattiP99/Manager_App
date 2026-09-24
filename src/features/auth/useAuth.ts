import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      // Senza emailRedirectTo il link di conferma rimanda al site_url del
      // progetto (localhost:3000), irraggiungibile dal telefono. Stesso
      // pattern di buildRecoveryRedirectUrl: scheme link su nativo, URL
      // corrente sul web — entrambi già in uri_allow_list.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: Linking.createURL('/') },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
  });
}
