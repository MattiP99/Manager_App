import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateExpense } from '../features/expenses/useExpenses';
import { EXPENSE_CATEGORIES, FRANCESCA_ACTIVITIES } from '../features/expenses/constants';
import type { ExpenseCategory, FrancescaActivity } from '../features/expenses/expenseSummary';
import { toLocalDateString } from '../lib/dates';

export default function AddExpenseScreen() {
  const { category: preselectedCategory, date: preselectedDate } = useLocalSearchParams<{ category?: string; date?: string }>();
  const [category] = useState<ExpenseCategory>((preselectedCategory as ExpenseCategory) ?? 'supermercato');
  const [label, setLabel] = useState('');
  const [francescaActivity, setFrancescaActivity] = useState<FrancescaActivity | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(preselectedDate ?? toLocalDateString(new Date()));
  const createExpense = useCreateExpense();

  const categoryLabel = EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category;

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
      { onSuccess: () => router.back() }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nuova spesa — {categoryLabel}</Text>

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

      {createExpense.isError && <Text style={styles.error}>{(createExpense.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createExpense.isPending}>
        <Text style={styles.buttonText}>{createExpense.isPending ? 'Salvataggio...' : 'Salva'}</Text>
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
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
