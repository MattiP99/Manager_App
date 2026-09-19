import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useCreateNoteSection } from '../features/notes/useNoteSections';

export default function AddNoteSectionScreen() {
  const [title, setTitle] = useState('');
  const createSection = useCreateNoteSection();

  const handleSubmit = () => {
    if (!title.trim()) return;
    createSection.mutate({ title: title.trim() }, { onSuccess: () => router.back() });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nuova sezione</Text>
      <TextInput style={styles.input} placeholder="Titolo (es. Ricette)" value={title} onChangeText={setTitle} />

      {createSection.isError && <Text style={styles.error}>{(createSection.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createSection.isPending}>
        <Text style={styles.buttonText}>{createSection.isPending ? 'Salvataggio...' : 'Salva'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
