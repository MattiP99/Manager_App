import { useState } from 'react';
import { Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useDeleteNote, useUpdateNote } from './useNotes';
import { encryptText } from './crypto/aesNotes';
import { Button } from '../../components/Button';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';
import type { Note, NoteSection } from './types';

interface EditNoteFormProps {
  section: NoteSection;
  note: Note;
  /** Contenuto già decifrato dal chiamante — NoteSectionDetail lo decifra comunque per l'anteprima in lista, niente doppia decifratura qui. */
  initialContent: string;
  /** true se questa nota specifica non è stata decifrabile (chiave sbagliata/canary non corrispondente) — blocca solo il salvataggio, non l'eliminazione. */
  decryptError: boolean;
  encryptionKey: Uint8Array | null;
  onSaved: () => void;
}

/** Contenuto del modale-foglio "Modifica nota" — guscio (DetailModal sheet, chiamato da NoteSectionDetail) e contenuto separati, stesso principio di EditExpenseForm. Sostituisce l'ex pagina a tutto schermo edit-note.tsx. */
export function EditNoteForm({ section, note, initialContent, decryptError, encryptionKey, onSaved }: EditNoteFormProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(initialContent);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;

    if (section.type === 'password') {
      if (!encryptionKey) return;
      const contentEncrypted = await encryptText(content.trim(), encryptionKey);
      updateNote.mutate(
        { id: note.id, sectionId: section.id, title: title.trim(), contentEncrypted },
        { onSuccess: onSaved }
      );
      return;
    }

    updateNote.mutate(
      { id: note.id, sectionId: section.id, title: title.trim(), content: content.trim() },
      { onSuccess: onSaved }
    );
  };

  const handleDelete = () => {
    deleteNote.mutate({ id: note.id, sectionId: section.id }, { onSuccess: onSaved });
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Modifica nota</Text>
      <Text style={styles.subtitle}>{section.title}</Text>
      {decryptError && (
        <Text style={styles.error}>
          Impossibile decifrare questa nota (chiave mancante o passphrase diversa da quella usata per salvarla).
        </Text>
      )}

      <TextInput style={styles.input} placeholder="Titolo" value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Contenuto"
        value={content}
        onChangeText={setContent}
        multiline
      />

      {(updateNote.isError || deleteNote.isError) && (
        <Text style={styles.error}>{((updateNote.error ?? deleteNote.error) as Error).message}</Text>
      )}
      <Button
        label={updateNote.isPending ? 'Salvataggio...' : 'Salva'}
        onPress={handleSave}
        disabled={updateNote.isPending || decryptError}
      />
      <Button label="Elimina nota" onPress={handleDelete} disabled={deleteNote.isPending} tone="danger" />
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
