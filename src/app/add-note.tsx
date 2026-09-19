import { useEffect, useState } from 'react';
import { TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useNoteSections } from '../features/notes/useNoteSections';
import { useCreateNote } from '../features/notes/useNotes';
import { encryptText, loadVerifiedKey } from '../features/notes/crypto/aesNotes';

export default function AddNoteScreen() {
  const { sectionId } = useLocalSearchParams<{ sectionId: string }>();
  const { data: sections } = useNoteSections();
  const section = sections?.find((s) => s.id === sectionId);
  const createNote = useCreateNote();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [keyMissing, setKeyMissing] = useState(false);

  const isPasswordSection = section?.type === 'password';

  useEffect(() => {
    if (isPasswordSection && section) {
      loadVerifiedKey(section).then((key) => setKeyMissing(!key));
    }
  }, [isPasswordSection, section?.id, section?.encryption_canary]);

  if (!sections) return <Text style={styles.padded}>Caricamento...</Text>;
  if (!section) return <Text style={styles.padded}>Sezione non trovata.</Text>;
  if (isPasswordSection && keyMissing) {
    return <Text style={styles.padded}>Sezione bloccata — torna indietro e sblocca prima di aggiungere una nota.</Text>;
  }

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;

    if (isPasswordSection) {
      const key = await loadVerifiedKey(section);
      if (!key) return;
      const contentEncrypted = await encryptText(content.trim(), key);
      createNote.mutate(
        { sectionId: section.id, title: title.trim(), contentEncrypted },
        { onSuccess: () => router.back() }
      );
      return;
    }

    createNote.mutate(
      { sectionId: section.id, title: title.trim(), content: content.trim() },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nuova nota — {section.title}</Text>
      <TextInput style={styles.input} placeholder="Titolo" value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Contenuto"
        value={content}
        onChangeText={setContent}
        multiline
      />

      {createNote.isError && <Text style={styles.error}>{(createNote.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createNote.isPending}>
        <Text style={styles.buttonText}>{createNote.isPending ? 'Salvataggio...' : 'Salva'}</Text>
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
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
