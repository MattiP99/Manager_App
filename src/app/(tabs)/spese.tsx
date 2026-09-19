import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAllExpenses } from '../../features/expenses/useExpenses';
import { EXPENSE_CATEGORIES, FRANCESCA_ACTIVITIES } from '../../features/expenses/constants';
import { monthLabel, summarizeByCategory, summarizeFrancescaByActivity } from '../../features/expenses/expenseSummary';
import { filterByDateRange } from '../../features/payments/computeClientSummary';
import { endOfMonth, shiftMonth, startOfMonth, toLocalDateString } from '../../lib/dates';

export default function SpeseScreen() {
  const [anchorDate, setAnchorDate] = useState(() => toLocalDateString(new Date()));
  const { data: expenses } = useAllExpenses();

  const range = { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
  const monthExpenses = filterByDateRange(expenses ?? [], range);
  const categorySummaries = summarizeByCategory(monthExpenses, EXPENSE_CATEGORIES.map((c) => c.value));
  const francescaActivitySummaries = summarizeFrancescaByActivity(monthExpenses, FRANCESCA_ACTIVITIES.map((a) => a.value));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spese</Text>

      <View style={styles.monthRow}>
        <Pressable style={styles.monthArrowButton} onPress={() => setAnchorDate(shiftMonth(anchorDate, -1))}>
          <Text style={styles.monthArrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel(anchorDate)}</Text>
        <Pressable style={styles.monthArrowButton} onPress={() => setAnchorDate(shiftMonth(anchorDate, 1))}>
          <Text style={styles.monthArrow}>›</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.sections}>
        {categorySummaries.map((summary) => {
          const meta = EXPENSE_CATEGORIES.find((c) => c.value === summary.category)!;
          return (
            <View key={summary.category} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{meta.label}</Text>
                <Text style={styles.cardTotal}>€{summary.total.toFixed(2)}</Text>
                <Pressable
                  style={styles.addButton}
                  onPress={() => router.push({ pathname: '/add-expense', params: { category: summary.category } })}
                >
                  <Text style={styles.addButtonText}>+</Text>
                </Pressable>
              </View>

              {summary.category === 'francesca' ? (
                francescaActivitySummaries.map((activitySummary) => {
                  const activityMeta = FRANCESCA_ACTIVITIES.find((a) => a.value === activitySummary.activity)!;
                  return (
                    <View key={activitySummary.activity} style={styles.activityGroup}>
                      <View style={styles.activityHeader}>
                        <Text style={styles.activityLabel}>{activityMeta.label}</Text>
                        <Text style={styles.activityTotal}>€{activitySummary.total.toFixed(2)}</Text>
                      </View>
                      {activitySummary.expenses.map((e) => (
                        <Pressable
                          key={e.id}
                          style={styles.row}
                          onPress={() => router.push({ pathname: '/edit-expense', params: { id: e.id } })}
                        >
                          <Text>{e.date}{e.label ? ` — ${e.label}` : ''}</Text>
                          <Text>€{e.amount.toFixed(2)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })
              ) : summary.expenses.length === 0 ? (
                <Text style={styles.empty}>Nessuna spesa questo mese.</Text>
              ) : (
                summary.expenses.map((e) => (
                  <Pressable
                    key={e.id}
                    style={styles.row}
                    onPress={() => router.push({ pathname: '/edit-expense', params: { id: e.id } })}
                  >
                    <Text>{e.date}{e.label ? ` — ${e.label}` : ''}</Text>
                    <Text>€{e.amount.toFixed(2)}</Text>
                  </Pressable>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginVertical: 4 },
  monthArrowButton: { padding: 8 },
  monthArrow: { fontSize: 20, fontWeight: '600' },
  monthLabel: { fontSize: 16, fontWeight: '600', minWidth: 140, textAlign: 'center' },
  sections: { gap: 12, paddingBottom: 24 },
  card: { backgroundColor: '#f3f4f6', borderRadius: 8, padding: 12, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  cardTotal: { fontWeight: '700' },
  addButton: { backgroundColor: '#2563eb', borderRadius: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: 'white', fontWeight: '700' },
  activityGroup: { gap: 2, marginTop: 4 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  activityLabel: { fontWeight: '600' },
  activityTotal: { fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  empty: { color: '#6b7280' },
});
