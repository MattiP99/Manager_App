import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useDeleteExpense, useUpdateExpense } from './useExpenses';
import { FRANCESCA_ACTIVITIES } from './constants';
import { labelPlaceholder } from './AddExpenseForm';
import type { Expense, FrancescaActivity } from './expenseSummary';
import { Button } from '../../components/Button';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface EditExpenseFormProps {
  expense: Expense;
  categoryLabel: string;
  onSaved: () => void;
}

/** Contenuto del modale "Modifica spesa" — guscio (DetailModal) e contenuto separati, stesso principio di AddExpenseForm. La spesa arriva già caricata da spese.tsx (useAllExpenses); categoryLabel arriva da lì (categorie ora dinamiche per famiglia, migrazione 0013 — niente più lookup su un array statico). */
export function EditExpenseForm({ expense, categoryLabel, onSaved }: EditExpenseFormProps) {
  const [francescaActivity, setFrancescaActivity] = useState<FrancescaActivity | null>(expense.francesca_activity);
  const [amount, setAmount] = useState(String(expense.amount));
  const [date, setDate] = useState(expense.date);
  const [label, setLabel] = useState(expense.label ?? '');
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const handleSave = () => {
    if (!/^\d+([.,]\d{1,2})?$/.test(amount.trim())) return;
    const amountNum = parseFloat(amount.trim().replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (!date.trim()) return;
    if (expense.category === 'francesca' && !francescaActivity) return;
    updateExpense.mutate(
      {
        id: expense.id,
        category: expense.category,
        label: label.trim() || undefined,
        francescaActivity: expense.category === 'francesca' ? francescaActivity! : undefined,
        amount: amountNum,
        date,
      },
      { onSuccess: onSaved }
    );
  };

  const handleDelete = () => {
    deleteExpense.mutate(expense.id, { onSuccess: onSaved });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modifica spesa — {categoryLabel}</Text>

      {expense.category === 'francesca' && (
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
        placeholder={labelPlaceholder(expense.category, francescaActivity)}
        value={label}
        onChangeText={setLabel}
        multiline
      />

      {(updateExpense.isError || deleteExpense.isError) && (
        <Text style={styles.error}>{((updateExpense.error ?? deleteExpense.error) as Error).message}</Text>
      )}
      <Button label={updateExpense.isPending ? 'Salvataggio...' : 'Salva'} onPress={handleSave} disabled={updateExpense.isPending} />
      <Button label="Elimina spesa" onPress={handleDelete} disabled={deleteExpense.isPending} tone="danger" />
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
