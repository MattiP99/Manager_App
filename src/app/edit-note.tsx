import { useEffect, useState } from 'react';
import { TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useNoteSections } from '../features/notes/useNoteSections';
import { useDeleteNote, useNotesBySection, useUpdateNote } from '../features/notes/useNotes';
import { decryptText, encryptText, loadVerifiedKey } from '../features/notes/crypto/aesNotes';

export default function EditNoteScreen() {
  const { id, sectionId } = useLocalSearchParams<{ id: string; sectionId: string }>();
  const { data: sections } = useNoteSections();
  const section = sections?.find((s) => s.id === sectionId);
  const { data: notes } = useNotesBySection(sectionId);
  const note = notes?.find((n) => n.id === id);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const isPasswordSection = section?.type === 'password';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [decryptError, setDecryptError] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!note || !section) return;
    setTitle(note.title);
    setDecryptError(false);

    if (!isPasswordSection) {
      setContent(note.content ?? '');
      setHydrated(true);
      return;
    }

    if (!note.content_encrypted) {
      setHydrated(true);
      return;
    }
    loadVerifiedKey(section).then(async (key) => {
      if (!key) {
        setDecryptError(true);
        setHydrated(true);
        return;
      }
      try {
        const plain = await decryptText(note.content_encrypted!, key);
        setContent(plain);
      } catch {
        setDecryptError(true);
      }
      setHydrated(true);
    });
  }, [note?.id, section?.id]);

  // Guard di caricamento prima di "non trovata": sia sections sia notes
  // (via il rispettivo hook) devono aver risolto prima di concludere che la
  // nota non esiste — stesso pattern già stabilito nei blocchi precedenti
  // per evitare un flash di "non trovata" mentre i dati sono ancora in volo.
  if (!sections || !notes) return <Text style={styles.padded}>Caricamento...</Text>;
  if (!section || !note) return <Text style={styles.padded}>Nota non trovata.</Text>;
  if (isPasswordSection && !hydrated) return <Text style={styles.padded}>Decifratura...</Text>;

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;

    if (isPasswordSection) {
      const key = await loadVerifiedKey(section);
      if (!key) return;
      const contentEncrypted = await encryptText(content.trim(), key);
      updateNote.mutate(
        { id: note.id, sectionId: section.id, title: title.trim(), contentEncrypted },
        { onSuccess: () => router.back() }
      );
      return;
    }

    updateNote.mutate(
      { id: note.id, sectionId: section.id, title: title.trim(), content: content.trim() },
      { onSuccess: () => router.back() }
    );
  };

  const handleDelete = () => {
    deleteNote.mutate({ id: note.id, sectionId: section.id }, { onSuccess: () => router.back() });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Modifica nota — {section.title}</Text>
      {decryptError && <Text style={styles.error}>Impossibile decifrare questa nota (chiave mancante o passphrase diversa da quella usata per salvarla).</Text>}

      <TextInput style={styles.input} placeholder="Titolo" value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Contenuto"
        value={content}
        onChangeText={setContent}
        multiline
      />

      {updateNote.isError && <Text style={styles.error}>{(updateNote.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSave} disabled={updateNote.isPending || decryptError}>
        <Text style={styles.buttonText}>Salva</Text>
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleteNote.isPending}>
        <Text style={styles.deleteButtonText}>Elimina nota</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  padded: { padding: 24 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteButtonText: { color: '#dc2626', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
