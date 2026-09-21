import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { useAllExpenses } from '../../features/expenses/useExpenses';
import { EXPENSE_CATEGORIES, FRANCESCA_ACTIVITIES } from '../../features/expenses/constants';
import { summarizeByCategory, summarizeFrancescaByActivity } from '../../features/expenses/expenseSummary';
import type { Expense, ExpenseCategory } from '../../features/expenses/expenseSummary';
import { AddExpenseForm } from '../../features/expenses/AddExpenseForm';
import { EditExpenseForm } from '../../features/expenses/EditExpenseForm';
import { dateRangeForAnchor, filterByDateRange, periodLabel } from '../../features/payments/computeClientSummary';
import type { PaymentPeriodMode } from '../../features/payments/computeClientSummary';
import { shiftMonth, shiftWeek, toLocalDateString } from '../../lib/dates';
import { isWideLayout } from '../../lib/layout';
import { Card } from '../../components/Card';
import { DetailModal } from '../../components/DetailModal';
import { PERIOD_LABELS } from '../../features/payments/constants';
import { Colors, Fonts, Radii, Spacing, Typography } from '../../lib/theme';

export default function SpeseScreen() {
  const [mode, setMode] = useState<PaymentPeriodMode>('month');
  const [anchorDate, setAnchorDate] = useState(() => toLocalDateString(new Date()));
  const [addingCategory, setAddingCategory] = useState<ExpenseCategory | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const { data: expenses } = useAllExpenses();
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && isWideLayout(width);

  const shiftAnchor = (direction: 1 | -1) => {
    setAnchorDate(mode === 'week' ? shiftWeek(anchorDate, direction) : shiftMonth(anchorDate, direction));
  };

  const range = dateRangeForAnchor(mode, anchorDate);
  const periodExpenses = filterByDateRange(expenses ?? [], range);
  const categorySummaries = summarizeByCategory(periodExpenses, EXPENSE_CATEGORIES.map((c) => c.value));
  const francescaActivitySummaries = summarizeFrancescaByActivity(periodExpenses, FRANCESCA_ACTIVITIES.map((a) => a.value));

  const addingCategoryLabel = addingCategory
    ? EXPENSE_CATEGORIES.find((c) => c.value === addingCategory)?.label ?? addingCategory
    : '';

  return (
    <View style={[styles.container, isWideWeb && styles.containerWide]}>
      <Text style={styles.title}>Spese</Text>

      <View style={styles.modeRow}>
        {(['week', 'month'] as PaymentPeriodMode[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.modeButton, mode === m && styles.modeButtonActive]}
            onPress={() => setMode(m)}
          >
            <Text style={mode === m ? styles.modeTextActive : styles.modeText}>{PERIOD_LABELS[m]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.anchorRow}>
        <Pressable style={styles.anchorArrowButton} onPress={() => shiftAnchor(-1)}>
          <Text style={styles.anchorArrow}>‹</Text>
        </Pressable>
        <Text style={styles.anchorLabel}>{periodLabel(mode, anchorDate)}</Text>
        <Pressable style={styles.anchorArrowButton} onPress={() => shiftAnchor(1)}>
          <Text style={styles.anchorArrow}>›</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.sections}>
        {categorySummaries.map((summary) => {
          const meta = EXPENSE_CATEGORIES.find((c) => c.value === summary.category)!;
          return (
            <Card key={summary.category} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, isWideWeb && styles.cardTitleWide]}>{meta.label}</Text>
                <Text style={styles.cardTotal}>€{summary.total.toFixed(2)}</Text>
                <Pressable style={styles.addButton} onPress={() => setAddingCategory(summary.category)}>
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
                        <Pressable key={e.id} style={styles.row} onPress={() => setEditingExpense(e)}>
                          <Text style={styles.rowText} numberOfLines={1}>{e.date}{e.label ? ` — ${e.label}` : ''}</Text>
                          <Text style={styles.rowAmount}>€{e.amount.toFixed(2)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })
              ) : summary.expenses.length === 0 ? (
                <Text style={styles.empty}>Nessuna spesa in questo periodo.</Text>
              ) : (
                summary.expenses.map((e) => (
                  <Pressable key={e.id} style={styles.row} onPress={() => setEditingExpense(e)}>
                    <Text style={styles.rowText} numberOfLines={1}>{e.date}{e.label ? ` — ${e.label}` : ''}</Text>
                    <Text style={styles.rowAmount}>€{e.amount.toFixed(2)}</Text>
                  </Pressable>
                ))
              )}
            </Card>
          );
        })}
      </ScrollView>

      <DetailModal visible={!!addingCategory} onClose={() => setAddingCategory(null)}>
        {addingCategory && (
          <AddExpenseForm
            category={addingCategory}
            categoryLabel={addingCategoryLabel}
            initialDate={anchorDate}
            onSaved={() => setAddingCategory(null)}
          />
        )}
      </DetailModal>

      <DetailModal visible={!!editingExpense} onClose={() => setEditingExpense(null)}>
        {editingExpense && <EditExpenseForm expense={editingExpense} onSaved={() => setEditingExpense(null)} />}
      </DetailModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  // Web: meno padding laterale così le card guadagnano larghezza (circa
  // +10% rispetto al padding standard) — non è una misura esatta
  // verificabile in questo ambiente senza browser, solo un'approssimazione
  // ragionevole nella stessa direzione richiesta.
  containerWide: { paddingHorizontal: Spacing.xs },
  // Bianco, centrato, più grande, non grassetto — sopra il gradiente
  // canvas→accento di AppShell. Diverso da cardTitle sotto (quello resta
  // scuro/allineato a sinistra, è un titolo di card, non di pagina).
  title: { fontFamily: Fonts.regular, fontSize: 32, lineHeight: 38, color: Colors.surface, textAlign: 'center' },
  modeRow: { flexDirection: 'row', gap: Spacing.sm },
  modeButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    alignItems: 'center',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  modeButtonActive: { borderColor: Colors.accent },
  modeText: { ...Typography.body, color: Colors.inkMuted },
  modeTextActive: { ...Typography.bodyBold, color: Colors.ink },
  anchorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  anchorArrowButton: { padding: Spacing.xs },
  anchorArrow: { fontSize: 20, fontWeight: '600', color: Colors.ink },
  anchorLabel: { ...Typography.bodyBold, color: Colors.ink, minWidth: 160, textAlign: 'center' },
  sections: { gap: Spacing.md, paddingBottom: Spacing.xl },
  card: { gap: Spacing.xs },
  // Spazio tra il titolo categoria e la prima riga di spesa — almeno
  // quanto l'altezza di una riga (~30px: padding verticale + testo +
  // bordo), non solo il gap standard usato tra le righe stesse.
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 32 },
  // fontFamily regular invece di semiBold (Typography.title): titolo più
  // sottile su richiesta esplicita, stessa dimensione del token.
  cardTitle: { fontFamily: Fonts.regular, fontSize: Typography.title.fontSize, lineHeight: Typography.title.lineHeight, color: Colors.ink, flex: 1 },
  cardTitleWide: { fontSize: Typography.title.fontSize + 8 },
  cardTotal: { ...Typography.bodyBold, color: Colors.ink },
  addButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: Colors.ink, fontWeight: '700', fontSize: 16, lineHeight: 18 },
  activityGroup: { gap: Spacing.xs / 2, marginTop: Spacing.xs },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  activityLabel: { ...Typography.bodyBold, color: Colors.ink },
  activityTotal: { ...Typography.bodyBold, color: Colors.ink },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  rowText: { ...Typography.body, color: Colors.ink },
  rowAmount: { ...Typography.body, color: Colors.inkMuted },
  empty: { ...Typography.body, color: Colors.inkMuted },
});
