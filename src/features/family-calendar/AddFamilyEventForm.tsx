import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useCreateCalendarEvent } from './useCalendarEvents';
import { FAMILY_CATEGORIES } from './constants';
import { isValidTimeRange, toLocalDateString } from '../../lib/dates';
import type { FamilyCategory } from './recurringOccurrences';
import { Button } from '../../components/Button';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface AddFamilyEventFormProps {
  preselectedDate?: string;
  onSaved: () => void;
}

/** Contenuto del form "Nuovo evento" — guscio (DetailModal, pannello laterale chiamato da FamilyDayDetailPanel) e contenuto separato, stesso principio di AddExpenseForm. Sostituisce l'ex pagina a tutto schermo add-family-event.tsx. Crea sempre un singolo calendar_event con recurring_template_id null — un evento ricorrente si crea solo da Impostazioni ("+ Impegno"), mai da qui, per design (vedi useCreateCalendarEvent). */
export function AddFamilyEventForm({ preselectedDate, onSaved }: AddFamilyEventFormProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FamilyCategory>('altro');
  const [person, setPerson] = useState('Francesca');
  const [date, setDate] = useState(preselectedDate ?? toLocalDateString(new Date()));
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const createEvent = useCreateCalendarEvent();

  const handleSubmit = () => {
    if (!title.trim() || !person.trim() || !date.trim()) return;
    if (!isValidTimeRange(startTime, endTime)) {
      setValidationError("Orario non valido — usa il formato HH:MM con la fine dopo l'inizio.");
      return;
    }
    setValidationError(null);
    createEvent.mutate(
      { title: title.trim(), category, person: person.trim(), date: date.trim(), startTime, endTime, note: note.trim() || undefined },
      { onSuccess: onSaved }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuovo evento</Text>
      <Text style={styles.subtitle}>Evento singolo per questo giorno — per un impegno che si ripete ogni settimana usa "+ Impegno" in Impostazioni.</Text>
      <TextInput style={styles.input} placeholder="Titolo" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.optionsRow}>
        {FAMILY_CATEGORIES.map((c) => (
          <Pressable
            key={c.value}
            style={[styles.option, category === c.value && styles.optionSelected]}
            onPress={() => setCategory(c.value)}
          >
            <Text style={category === c.value ? styles.optionTextSelected : styles.optionText}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Persona" value={person} onChangeText={setPerson} />
      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora inizio (HH:MM)" value={startTime} onChangeText={setStartTime} />
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora fine (HH:MM)" value={endTime} onChangeText={setEndTime} />
      </View>
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {validationError && <Text style={styles.error}>{validationError}</Text>}
      {createEvent.isError && <Text style={styles.error}>{(createEvent.error as Error).message}</Text>}
      <Button
        label={createEvent.isPending ? 'Salvataggio...' : 'Salva'}
        onPress={handleSubmit}
        disabled={createEvent.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  title: { ...Typography.title, color: Colors.ink },
  subtitle: { ...Typography.small, color: Colors.inkMuted },
  label: { ...Typography.bodyBold, color: Colors.ink },
  input: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    ...Typography.body,
    color: Colors.ink,
  },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  option: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  optionSelected: { borderColor: Colors.accent, backgroundColor: Colors.canvas },
  optionText: { ...Typography.body, color: Colors.inkMuted },
  optionTextSelected: { ...Typography.bodyBold, color: Colors.ink },
  timeRow: { flexDirection: 'row', gap: Spacing.sm },
  timeInput: { flex: 1 },
  error: { ...Typography.body, color: Colors.error },
});
