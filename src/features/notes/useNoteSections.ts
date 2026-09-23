import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import type { NoteSection } from './types';

export function useNoteSections() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['note-sections', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<NoteSection[]> => {
      const { data, error } = await supabase
        .from('note_sections')
        .select('id, title, type, sort_order, encryption_salt, encryption_wrapped_key, encryption_canary')
        .eq('household_id', householdId!)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data as NoteSection[];
    },
  });
}

export function useCreateNoteSection() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  const { data: existingSections } = useNoteSections();

  return useMutation({
    mutationFn: async (input: { title: string }) => {
      if (!household) throw new Error('No household');
      const nextSortOrder = (existingSections ?? []).reduce((max, s) => Math.max(max, s.sort_order), -1) + 1;
      const { data, error } = await supabase
        .from('note_sections')
        .insert({
          household_id: household.id,
          title: input.title,
          type: 'custom',
          sort_order: nextSortOrder,
        })
        .select('id, title, type, sort_order, encryption_salt, encryption_wrapped_key, encryption_canary')
        .single();
      if (error) throw error;
      return data as NoteSection;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note-sections'] }),
  });
}

/** Salva salt+chiave avvolta+canary sulla sezione Password al primo utilizzo (chiamata da setupPasswordSection). Non è una creazione di sezione — la sezione Password esiste già dal bootstrap di create_household, qui si valorizzano solo i campi di cifratura ancora null. */
export function useConfigurePasswordSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sectionId: string; saltHex: string; wrappedKeyBase64: string; canaryBase64: string }) => {
      const { data, error } = await supabase
        .from('note_sections')
        .update({
          encryption_salt: input.saltHex,
          encryption_wrapped_key: input.wrappedKeyBase64,
          encryption_canary: input.canaryBase64,
        })
        .eq('id', input.sectionId)
        .is('encryption_salt', null)
        .select('id, title, type, sort_order, encryption_salt, encryption_wrapped_key, encryption_canary')
        .single();
      if (error) throw new Error('Questa sezione è già stata configurata da un altro dispositivo. Aggiorna e riprova a sbloccarla con la passphrase.');
      return data as NoteSection;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note-sections'] }),
  });
}

/** Deposita la DEK in chiaro nel deposito di recupero (note_section_recovery) — scrivibile da una sessione normale (setup iniziale, o backfill dopo uno sblocco riuscito), leggibile SOLO durante una sessione di recupero via email (RLS, migrazione 0014). INSERT semplice, non upsert: un `upsert` qui va in errore RLS (42501) anche al primo inserimento, perché la clausola ON CONFLICT richiede di poter vedere l'eventuale riga esistente per decidere se aggiornarla — proprio la visibilità che la policy di lettura nega di proposito a una sessione normale (verificato 2026-09-24 riproducendo l'errore contro il vero DB). La DEK non cambia mai dopo il primo setup (un reset passphrase riavvolge la stessa DEK, non ne crea una nuova), quindi non serve mai un aggiornamento: un tentativo di reinserimento va semplicemente ignorato (23505, chiave duplicata — la riga esiste già, niente da fare). */
export function useWriteRecoveryKey() {
  const { data: household } = useHousehold();
  return useMutation({
    mutationFn: async (input: { sectionId: string; recoveryKeyHex: string }) => {
      if (!household) throw new Error('No household');
      const { error } = await supabase.from('note_section_recovery').insert({
        section_id: input.sectionId,
        household_id: household.id,
        recovery_key_hex: input.recoveryKeyHex,
      });
      if (error && error.code !== '23505') throw error;
    },
  });
}

/** Legge la DEK di recupero — funziona SOLO durante una sessione di recupero via email (vedi RLS), altrimenti la query non trova righe (non un errore: la policy nasconde la riga, non nega l'accesso). */
export function useFetchRecoveryKey() {
  return useMutation({
    mutationFn: async (input: { sectionId: string }): Promise<string | null> => {
      const { data, error } = await supabase
        .from('note_section_recovery')
        .select('recovery_key_hex')
        .eq('section_id', input.sectionId)
        .maybeSingle();
      if (error) throw error;
      return data?.recovery_key_hex ?? null;
    },
  });
}

/** Aggiorna salt+chiave avvolta dopo un reset della passphrase via recupero email — la DEK resta la stessa (le note già cifrate restano leggibili), cambia solo con quale passphrase si sblocca. A differenza di useConfigurePasswordSection non richiede che i campi siano null: qui la sezione è già configurata, si sta sostituendo il wrap esistente. */
export function useResetPassphraseWrap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sectionId: string; saltHex: string; wrappedKeyBase64: string }) => {
      const { error } = await supabase
        .from('note_sections')
        .update({ encryption_salt: input.saltHex, encryption_wrapped_key: input.wrappedKeyBase64 })
        .eq('id', input.sectionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note-sections'] }),
  });
}
