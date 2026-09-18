import { useEffect, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useDeleteRecurringTemplate, useRecurringTemplates, useUpdateRecurringTemplate } from '../features/family-calendar/useRecurringTemplates';
import { FAMILY_CATEGORIES, WEEKDAY_OPTIONS } from '../features/family-calendar/constants';
import type { FamilyCategory } from '../features/family-calendar/recurringOccurrences';

export default function EditRecurringTemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: templates } = useRecurringTemplates();
  const template = templates?.find((t) => t.id === id);
  const updateTemplate = useUpdateRecurringTemplate();
  const deleteTemplate = useDeleteRecurringTemplate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FamilyCategory>('altro');
  const [person, setPerson] = useState('');
  const [weekday, setWeekday] = useState<number | null>(null);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setCategory(template.category);
      setPerson(template.person);
      setWeekday(template.weekday);
      setTime(template.time ?? '');
      setNote(template.note ?? '');
    }
  }, [template?.id]);

  if (!template) return <Text style={styles.padded}>Impegno non trovato.</Text>;

  const handleSave = () => {
    if (!title.trim() || !person.trim() || weekday === null) return;
    updateTemplate.mutate(
      { id: template.id, title: title.trim(), category, person: person.trim(), weekday, time: time.trim() || undefined, note: note.trim() || undefined },
      { onSuccess: () => router.back() }
    );
  };

  const handleDelete = () => {
    deleteTemplate.mutate(template.id, { onSuccess: () => router.back() });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Modifica impegno ricorrente</Text>
      <TextInput style={styles.input} placeholder="Titolo" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.optionsRow}>
        {FAMILY_CATEGORIES.map((c) => (
          <Pressable
            key={c.value}
            style={[styles.option, category === c.value && styles.optionSelected]}
            onPress={() => setCategory(c.value)}
          >
            <Text>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Persona" value={person} onChangeText={setPerson} />

      <Text style={styles.label}>Giorno della settimana</Text>
      <View style={styles.optionsRow}>
        {WEEKDAY_OPTIONS.map((w) => (
          <Pressable
            key={w.value}
            style={[styles.option, weekday === w.value && styles.optionSelected]}
            onPress={() => setWeekday(w.value)}
          >
            <Text>{w.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Orario (HH:MM, opzionale)" value={time} onChangeText={setTime} />
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {updateTemplate.isError && <Text style={styles.error}>{(updateTemplate.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSave} disabled={updateTemplate.isPending}>
        <Text style={styles.buttonText}>Salva</Text>
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleteTemplate.isPending}>
        <Text style={styles.deleteButtonText}>Elimina impegno ricorrente</Text>
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
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteButtonText: { color: '#dc2626', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
