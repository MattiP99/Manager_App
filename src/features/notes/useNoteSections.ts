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
        .select('id, title, type, sort_order, encryption_salt, encryption_canary')
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
        .select('id, title, type, sort_order, encryption_salt, encryption_canary')
        .single();
      if (error) throw error;
      return data as NoteSection;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note-sections'] }),
  });
}

/** Salva salt+canary sulla sezione Password al primo utilizzo (chiamata da setupPasswordSection nel Task 6). Non è una creazione di sezione — la sezione Password esiste già dal bootstrap di create_household, qui si valorizzano solo i due campi di cifratura ancora null. */
export function useConfigurePasswordSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sectionId: string; saltHex: string; canaryBase64: string }) => {
      const { data, error } = await supabase
        .from('note_sections')
        .update({ encryption_salt: input.saltHex, encryption_canary: input.canaryBase64 })
        .eq('id', input.sectionId)
        .select('id, title, type, sort_order, encryption_salt, encryption_canary')
        .single();
      if (error) throw error;
      return data as NoteSection;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note-sections'] }),
  });
}
