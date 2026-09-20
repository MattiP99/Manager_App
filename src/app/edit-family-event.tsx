import { useEffect, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  useAllCalendarEvents,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
  useUpsertOccurrenceOverride,
} from '../features/family-calendar/useCalendarEvents';
import { useRecurringTemplates } from '../features/family-calendar/useRecurringTemplates';
import { FAMILY_CATEGORIES } from '../features/family-calendar/constants';
import { isEndAfterStart, isValidTimeFormat } from '../lib/dates';
import type { FamilyCategory } from '../features/family-calendar/recurringOccurrences';

export default function EditFamilyEventScreen() {
  const { id, recurringTemplateId, date } = useLocalSearchParams<{ id?: string; recurringTemplateId?: string; date?: string }>();
  const { data: events } = useAllCalendarEvents();
  const { data: templates } = useRecurringTemplates();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const upsertOverride = useUpsertOccurrenceOverride();

  const isOverrideMode = !id && !!recurringTemplateId && !!date;
  const manualEvent = id ? events?.find((e) => e.id === id) : undefined;
  const existingOverride = isOverrideMode ? events?.find((e) => e.recurring_template_id === recurringTemplateId && e.date === date) : undefined;
  const template = isOverrideMode ? templates?.find((t) => t.id === recurringTemplateId) : undefined;

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FamilyCategory>('altro');
  const [person, setPerson] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    if (manualEvent) {
      setTitle(manualEvent.title);
      setCategory(manualEvent.category);
      setPerson(manualEvent.person);
      setStartTime(manualEvent.start_time ?? '');
      setEndTime(manualEvent.end_time ?? '');
      setNote(manualEvent.note ?? '');
      setLoaded(true);
    } else if (isOverrideMode && (existingOverride || template)) {
      const source = existingOverride ?? template!;
      setTitle(source.title);
      setCategory(source.category);
      setPerson(source.person);
      setStartTime(source.start_time ?? '');
      setEndTime(source.end_time ?? '');
      setNote(source.note ?? '');
      setLoaded(true);
    }
  }, [manualEvent?.id, existingOverride?.id, template?.id, loaded, isOverrideMode]);

  if (id && !events) return <Text style={styles.padded}>Caricamento...</Text>;
  if (!manualEvent && !isOverrideMode) return <Text style={styles.padded}>Evento non trovato.</Text>;
  if (isOverrideMode && !template) return <Text style={styles.padded}>Caricamento...</Text>;

  const handleSave = () => {
    if (!title.trim() || !person.trim()) return;
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime) || !isEndAfterStart(startTime, endTime)) return;
    if (manualEvent) {
      updateEvent.mutate(
        { id: manualEvent.id, title: title.trim(), category, person: person.trim(), date: manualEvent.date, startTime, endTime, note: note.trim() || undefined },
        { onSuccess: () => router.back() }
      );
    } else if (recurringTemplateId && date) {
      upsertOverride.mutate(
        { recurringTemplateId, date, title: title.trim(), category, person: person.trim(), startTime, endTime, note: note.trim() || undefined, isCancelled: false },
        { onSuccess: () => router.back() }
      );
    }
  };

  const handleDelete = () => {
    if (manualEvent) {
      deleteEvent.mutate(manualEvent.id, { onSuccess: () => router.back() });
    }
  };

  const isPending = updateEvent.isPending || upsertOverride.isPending;
  const error = (updateEvent.error ?? upsertOverride.error) as Error | null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{manualEvent ? 'Modifica evento' : 'Modifica solo questo giorno'}</Text>
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
      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora inizio (HH:MM)" value={startTime} onChangeText={setStartTime} />
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora fine (HH:MM)" value={endTime} onChangeText={setEndTime} />
      </View>
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {error && <Text style={styles.error}>{error.message}</Text>}
      <Pressable style={styles.button} onPress={handleSave} disabled={isPending}>
        <Text style={styles.buttonText}>Salva</Text>
      </Pressable>
      {manualEvent && (
        <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleteEvent.isPending}>
          <Text style={styles.deleteButtonText}>Elimina evento</Text>
        </Pressable>
      )}
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
  timeRow: { flexDirection: 'row', gap: 8 },
  timeInput: { flex: 1 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteButtonText: { color: '#dc2626', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
