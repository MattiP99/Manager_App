import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useCreateNoteSection } from './useNoteSections';
import { Button } from '../../components/Button';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface AddNoteSectionFormProps {
  onSaved: () => void;
}

/** Contenuto del modale "Nuova sezione" — guscio (DetailModal, chiamato da note.tsx) e contenuto separati, stesso principio già usato per AddExpenseForm. Sostituisce l'ex pagina a tutto schermo add-note-section.tsx. */
export function AddNoteSectionForm({ onSaved }: AddNoteSectionFormProps) {
  const [title, setTitle] = useState('');
  const createSection = useCreateNoteSection();

  const handleSubmit = () => {
    if (!title.trim()) return;
    createSection.mutate({ title: title.trim() }, { onSuccess: onSaved });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuova sezione</Text>
      <TextInput style={styles.input} placeholder="Titolo (es. Ricette)" value={title} onChangeText={setTitle} />

      {createSection.isError && <Text style={styles.error}>{(createSection.error as Error).message}</Text>}
      <Button
        label={createSection.isPending ? 'Salvataggio...' : 'Salva'}
        onPress={handleSubmit}
        disabled={createSection.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  title: { ...Typography.title, color: Colors.ink },
  input: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    ...Typography.body,
    color: Colors.ink,
  },
  error: { ...Typography.body, color: Colors.error },
});
