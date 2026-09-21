import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useCreateExpense } from './useExpenses';
import { FRANCESCA_ACTIVITIES } from './constants';
import type { ExpenseCategory, FrancescaActivity } from './expenseSummary';
import { Button } from '../../components/Button';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface AddExpenseFormProps {
  category: ExpenseCategory;
  categoryLabel: string;
  initialDate: string;
  onSaved: () => void;
}

export function labelPlaceholder(category: ExpenseCategory, francescaActivity: FrancescaActivity | null): string {
  if (category === 'extra') return 'Tipologia (es. riparazione)';
  if (category === 'francesca' && francescaActivity === 'altro') return 'Descrizione (es. dentista, cinema)';
  return 'Descrizione (opzionale)';
}

/** Contenuto del modale "Nuova spesa" — guscio (DetailModal) e contenuto separati, stesso principio già usato per WorkSessionDetail/FamilyOccurrenceDetail. */
export function AddExpenseForm({ category, categoryLabel, initialDate, onSaved }: AddExpenseFormProps) {
  const [francescaActivity, setFrancescaActivity] = useState<FrancescaActivity | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(initialDate);
  const [label, setLabel] = useState('');
  const createExpense = useCreateExpense();

  const handleSubmit = () => {
    if (!/^\d+([.,]\d{1,2})?$/.test(amount.trim())) return;
    const amountNum = parseFloat(amount.trim().replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (!date.trim()) return;
    if (category === 'francesca' && !francescaActivity) return;
    createExpense.mutate(
      {
        category,
        label: label.trim() || undefined,
        francescaActivity: category === 'francesca' ? francescaActivity! : undefined,
        amount: amountNum,
        date,
      },
      { onSuccess: onSaved }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuova spesa — {categoryLabel}</Text>

      {category === 'francesca' && (
        <View style={styles.optionsRow}>
          {FRANCESCA_ACTIVITIES.map((a) => (
            <Pressable
              key={a.value}
              style={[styles.option, francescaActivity === a.value && styles.optionSelected]}
              onPress={() => setFrancescaActivity(a.value)}
            >
              <Text style={francescaActivity === a.value ? styles.optionTextSelected : styles.optionText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Importo (€)"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />
      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput
        style={styles.descriptionInput}
        placeholder={labelPlaceholder(category, francescaActivity)}
        value={label}
        onChangeText={setLabel}
        multiline
      />

      {createExpense.isError && <Text style={styles.error}>{(createExpense.error as Error).message}</Text>}
      <Button
        label={createExpense.isPending ? 'Salvataggio...' : 'Salva'}
        onPress={handleSubmit}
        disabled={createExpense.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  title: { ...Typography.title, color: Colors.ink },
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
  input: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    ...Typography.body,
    color: Colors.ink,
  },
  // Multi-riga: la lista in spese.tsx tronca la descrizione a una riga
  // (numberOfLines=1), ma qui — dove la si scrive/legge per intero — deve
  // poter crescere su più righe.
  descriptionInput: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
    ...Typography.body,
    color: Colors.ink,
  },
  error: { color: Colors.error },
});
