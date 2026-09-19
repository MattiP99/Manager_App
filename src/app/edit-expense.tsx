import { useEffect, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAllExpenses, useDeleteExpense, useUpdateExpense } from '../features/expenses/useExpenses';
import { EXPENSE_CATEGORIES, FRANCESCA_ACTIVITIES } from '../features/expenses/constants';
import type { ExpenseCategory, FrancescaActivity } from '../features/expenses/expenseSummary';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: expenses } = useAllExpenses();
  const expense = expenses?.find((e) => e.id === id);
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const [category, setCategory] = useState<ExpenseCategory>('supermercato');
  const [label, setLabel] = useState('');
  const [francescaActivity, setFrancescaActivity] = useState<FrancescaActivity | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (expense) {
      setCategory(expense.category);
      setLabel(expense.label ?? '');
      setFrancescaActivity(expense.francesca_activity);
      setAmount(String(expense.amount));
      setDate(expense.date);
    }
  }, [expense?.id]);

  // Guard di caricamento: senza, "spesa non trovata" lampeggia mentre
  // useAllExpenses() sta ancora caricando (expenses è undefined) — stesso
  // bug già trovato e corretto in edit-family-event.tsx nel blocco
  // precedente, evitato qui fin dall'inizio.
  if (!expenses) return <Text style={styles.padded}>Caricamento...</Text>;
  if (!expense) return <Text style={styles.padded}>Spesa non trovata.</Text>;

  const categoryLabel = EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category;

  const handleSave = () => {
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (category === 'francesca' && !francescaActivity) return;
    updateExpense.mutate(
      {
        id: expense.id,
        category,
        label: label.trim() || undefined,
        francescaActivity: category === 'francesca' ? francescaActivity! : undefined,
        amount: amountNum,
        date,
      },
      { onSuccess: () => router.back() }
    );
  };

  const handleDelete = () => {
    deleteExpense.mutate(expense.id, { onSuccess: () => router.back() });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Modifica spesa — {categoryLabel}</Text>

      {category === 'francesca' && (
        <>
          <Text style={styles.label}>Attività</Text>
          <View style={styles.optionsRow}>
            {FRANCESCA_ACTIVITIES.map((a) => (
              <Pressable
                key={a.value}
                style={[styles.option, francescaActivity === a.value && styles.optionSelected]}
                onPress={() => setFrancescaActivity(a.value)}
              >
                <Text>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <TextInput style={styles.input} placeholder="Importo (€)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput
        style={styles.input}
        placeholder={category === 'extra' ? 'Tipologia (es. riparazione)' : 'Descrizione (opzionale)'}
        value={label}
        onChangeText={setLabel}
      />

      {updateExpense.isError && <Text style={styles.error}>{(updateExpense.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSave} disabled={updateExpense.isPending}>
        <Text style={styles.buttonText}>Salva</Text>
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleteExpense.isPending}>
        <Text style={styles.deleteButtonText}>Elimina spesa</Text>
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
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteButtonText: { color: '#dc2626', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
