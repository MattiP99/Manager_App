import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useCreateRecurringTemplate } from '../features/family-calendar/useRecurringTemplates';
import { FAMILY_CATEGORIES, WEEKDAY_OPTIONS } from '../features/family-calendar/constants';
import { isValidTimeRange } from '../lib/dates';
import type { FamilyCategory } from '../features/family-calendar/recurringOccurrences';

export default function AddRecurringTemplateScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FamilyCategory>('altro');
  const [person, setPerson] = useState('Francesca');
  const [weekday, setWeekday] = useState<number | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const createTemplate = useCreateRecurringTemplate();

  const handleSubmit = () => {
    if (!title.trim() || !person.trim() || weekday === null) return;
    if (!isValidTimeRange(startTime, endTime)) {
      setValidationError("Orario non valido — usa il formato HH:MM con la fine dopo l'inizio.");
      return;
    }
    setValidationError(null);
    createTemplate.mutate(
      { title: title.trim(), category, person: person.trim(), weekday, startTime, endTime, note: note.trim() || undefined },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nuovo impegno ricorrente</Text>
      <TextInput style={styles.input} placeholder="Titolo (es. Piscina)" value={title} onChangeText={setTitle} />

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

      <TextInput style={styles.input} placeholder="Persona (es. Francesca)" value={person} onChangeText={setPerson} />

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

      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora inizio (HH:MM)" value={startTime} onChangeText={setStartTime} />
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora fine (HH:MM)" value={endTime} onChangeText={setEndTime} />
      </View>
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {validationError && <Text style={styles.error}>{validationError}</Text>}
      {createTemplate.isError && <Text style={styles.error}>{(createTemplate.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createTemplate.isPending}>
        <Text style={styles.buttonText}>{createTemplate.isPending ? 'Salvataggio...' : 'Salva'}</Text>
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
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  timeRow: { flexDirection: 'row', gap: 8 },
  timeInput: { flex: 1 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
