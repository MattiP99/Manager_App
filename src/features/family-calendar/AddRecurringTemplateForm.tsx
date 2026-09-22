import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useCreateRecurringTemplate } from './useRecurringTemplates';
import { FAMILY_CATEGORIES, WEEKDAY_OPTIONS } from './constants';
import { isValidTimeRange } from '../../lib/dates';
import type { FamilyCategory } from './recurringOccurrences';
import { Button } from '../../components/Button';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface AddRecurringTemplateFormProps {
  onSaved: () => void;
}

/** Contenuto del modale "Nuovo impegno ricorrente" — guscio (DetailModal, chiamato da impostazioni.tsx) e contenuto separati, stesso principio già usato per AddExpenseForm/AddNoteSectionForm. Sostituisce l'ex pagina a tutto schermo add-recurring-template.tsx. ScrollView interna con maxHeight (pattern di NoteSectionDetail): il form ha troppi campi per stare sempre nella card di default. */
export function AddRecurringTemplateForm({ onSaved }: AddRecurringTemplateFormProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FamilyCategory>('altro');
  const [person, setPerson] = useState('Francesca');
  const [weekday, setWeekday] = useState<number | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const createTemplate = useCreateRecurringTemplate();
  const { height } = useWindowDimensions();

  const handleSubmit = () => {
    if (!title.trim() || !person.trim() || weekday === null) return;
    if (!isValidTimeRange(startTime, endTime)) {
      setValidationError("Orario non valido — usa il formato HH:MM con la fine dopo l'inizio.");
      return;
    }
    setValidationError(null);
    createTemplate.mutate(
      { title: title.trim(), category, person: person.trim(), weekday, startTime, endTime, note: note.trim() || undefined },
      { onSuccess: onSaved }
    );
  };

  return (
    <ScrollView style={{ maxHeight: height * 0.7 }} contentContainerStyle={styles.container}>
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
            <Text style={category === c.value ? styles.optionTextSelected : styles.optionText}>{c.label}</Text>
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
            <Text style={weekday === w.value ? styles.optionTextSelected : styles.optionText}>{w.label}</Text>
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
      <Button
        label={createTemplate.isPending ? 'Salvataggio...' : 'Salva'}
        onPress={handleSubmit}
        disabled={createTemplate.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  title: { ...Typography.title, color: Colors.ink },
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
