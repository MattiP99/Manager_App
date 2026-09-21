import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import type { Note } from './types';

export function useNotesBySection(sectionId: string | undefined) {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['notes', sectionId],
    enabled: !!householdId && !!sectionId,
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await supabase
        .from('notes')
        .select('id, section_id, title, content, content_encrypted, created_at')
        .eq('section_id', sectionId!)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });
}

interface NoteInput {
  sectionId: string;
  title: string;
  content?: string;
  contentEncrypted?: string;
}

export function useCreateNote() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NoteInput) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('notes')
        .insert({
          household_id: household.id,
          section_id: input.sectionId,
          title: input.title,
          content: input.content ?? null,
          content_encrypted: input.contentEncrypted ?? null,
        })
        .select('id, section_id, title, content, content_encrypted, created_at')
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ['notes', variables.sectionId] }),
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NoteInput & { id: string }) => {
      const { data, error } = await supabase
        .from('notes')
        .update({
          title: input.title,
          content: input.content ?? null,
          content_encrypted: input.contentEncrypted ?? null,
        })
        .eq('id', input.id)
        .select('id, section_id, title, content, content_encrypted, created_at')
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ['notes', data.section_id] }),
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; sectionId: string }) => {
      const { error } = await supabase.from('notes').delete().eq('id', input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => queryClient.invalidateQueries({ queryKey: ['notes', input.sectionId] }),
  });
}
