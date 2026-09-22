import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useCreateExpenseCategory } from './useExpenseCategories';
import { Button } from '../../components/Button';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface AddExpenseCategoryFormProps {
  onSaved: () => void;
}

/** Contenuto del modale "Nuova sezione" per Spese — guscio (DetailModal, chiamato da spese.tsx) e contenuto separati, stesso principio di AddNoteSectionForm. */
export function AddExpenseCategoryForm({ onSaved }: AddExpenseCategoryFormProps) {
  const [label, setLabel] = useState('');
  const createCategory = useCreateExpenseCategory();

  const handleSubmit = () => {
    if (!label.trim()) return;
    createCategory.mutate({ label: label.trim() }, { onSuccess: onSaved });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuova sezione</Text>
      <TextInput style={styles.input} placeholder="Titolo (es. Casa)" value={label} onChangeText={setLabel} />

      {createCategory.isError && <Text style={styles.error}>{(createCategory.error as Error).message}</Text>}
      <Button
        label={createCategory.isPending ? 'Salvataggio...' : 'Salva'}
        onPress={handleSubmit}
        disabled={createCategory.isPending}
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
