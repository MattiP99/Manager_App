import { useState } from 'react';
import { Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useCreateNote } from './useNotes';
import { encryptText } from './crypto/aesNotes';
import { Button } from '../../components/Button';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';
import type { NoteSection } from './types';

interface AddNoteFormProps {
  section: NoteSection;
  /** Chiave già verificata dal chiamante — il bottone "+ Nota" (NoteSectionDetail) è visibile solo a sezione sbloccata, quindi qui non serve ri-derivarla/ri-controllarla. Sempre null per le sezioni non-password. */
  encryptionKey: Uint8Array | null;
  onSaved: () => void;
}

/** Contenuto del modale-foglio "Nuova nota" — guscio (DetailModal sheet, chiamato da NoteSectionDetail) e contenuto separati, stesso principio di AddExpenseForm. Sostituisce l'ex pagina a tutto schermo add-note.tsx. */
export function AddNoteForm({ section, encryptionKey, onSaved }: AddNoteFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const createNote = useCreateNote();

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;

    if (section.type === 'password') {
      if (!encryptionKey) return;
      const contentEncrypted = await encryptText(content.trim(), encryptionKey);
      createNote.mutate(
        { sectionId: section.id, title: title.trim(), contentEncrypted },
        { onSuccess: onSaved }
      );
      return;
    }

    createNote.mutate(
      { sectionId: section.id, title: title.trim(), content: content.trim() },
      { onSuccess: onSaved }
    );
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nuova nota</Text>
      <Text style={styles.subtitle}>{section.title}</Text>
      <TextInput style={styles.input} placeholder="Titolo" value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Contenuto"
        value={content}
        onChangeText={setContent}
        multiline
      />

      {createNote.isError && <Text style={styles.error}>{(createNote.error as Error).message}</Text>}
      <Button
        label={createNote.isPending ? 'Salvataggio...' : 'Salva'}
        onPress={handleSubmit}
        disabled={createNote.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flex:1 invece di un maxHeight in px: il foglio (DetailModal sheet) ha
  // ora un'altezza fissa (75% schermo) — questo riempie esattamente lo
  // spazio verticale che il guscio gli lascia, senza duplicare qui il
  // calcolo dell'altezza dello schermo.
  scroll: { flex: 1 },
  container: { gap: Spacing.sm },
  title: { ...Typography.title, color: Colors.ink },
  subtitle: { ...Typography.body, color: Colors.inkMuted },
  input: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    ...Typography.body,
    color: Colors.ink,
  },
  multiline: { minHeight: 140, textAlignVertical: 'top' },
  error: { ...Typography.body, color: Colors.error },
});
