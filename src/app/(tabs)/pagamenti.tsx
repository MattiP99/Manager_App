import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useClients } from '../../features/clients/useClients';
import { useAllWorkSessions } from '../../features/work-sessions/useWorkSessions';
import { useAllPayments } from '../../features/payments/usePayments';
import { periodLabel } from '../../features/payments/computeClientSummary';
import type { PaymentPeriodMode } from '../../features/payments/computeClientSummary';
import { buildClientPaymentRows } from '../../features/payments/clientPaymentRows';
import type { ClientPaymentRow } from '../../features/payments/clientPaymentRows';
import { PAYMENT_METRICS, PERIOD_LABELS } from '../../features/payments/constants';
import { PressableCard } from '../../components/PressableCard';
import { shiftMonth, shiftWeek, toLocalDateString } from '../../lib/dates';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

export default function PagamentiScreen() {
  const [mode, setMode] = useState<PaymentPeriodMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => toLocalDateString(new Date()));
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessions();
  const { data: payments } = useAllPayments();

  const shiftAnchor = (direction: 1 | -1) => {
    setAnchorDate(mode === 'week' ? shiftWeek(anchorDate, direction) : shiftMonth(anchorDate, direction));
  };

  const rows = buildClientPaymentRows(clients ?? [], sessions ?? [], payments ?? [], mode, anchorDate);
  const grandTotal = rows.reduce(
    (acc, r) => ({
      totalHours: acc.totalHours + r.summary.totalHours,
      totalDue: acc.totalDue + r.summary.totalDue,
      totalPaid: acc.totalPaid + r.summary.totalPaid,
      balance: acc.balance + r.summary.balance,
    }),
    { totalHours: 0, totalDue: 0, totalPaid: 0, balance: 0 }
  );

  const listHeader = (
    <View style={styles.headerContainer}>
      <Text style={styles.title}>Pagamenti</Text>

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

      <View style={styles.summaryGrid}>
        {PAYMENT_METRICS.map((metric) => (
          <PressableCard
            key={metric.key}
            onPress={() => router.push({ pathname: '/payment-detail', params: { metric: metric.key, mode, anchorDate } })}
          >
            <Text style={styles.summaryLabel}>{metric.label}</Text>
            <Text style={styles.summaryValue}>{metric.format(grandTotal[metric.key])}</Text>
          </PressableCard>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(r) => r.client.id}
        ListHeaderComponent={listHeader}
        renderItem={({ item }: { item: ClientPaymentRow }) => (
          <PressableCard onPress={() => router.push(`/client/${item.client.id}`)}>
            <Text style={styles.clientName}>{item.client.name}</Text>
            <Text style={styles.clientMeta}>
              {item.summary.totalHours.toFixed(2)}h — dovuto €{item.summary.totalDue.toFixed(2)} — ricevuto €{item.summary.totalPaid.toFixed(2)}
            </Text>
            <Text style={item.summary.balance > 0 ? styles.due : styles.settled}>Saldo: €{item.summary.balance.toFixed(2)}</Text>
          </PressableCard>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nessun cliente ancora.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.md },
  headerContainer: { gap: Spacing.md, marginBottom: Spacing.sm },
  title: { ...Typography.title, color: Colors.ink },
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
  summaryGrid: { gap: Spacing.sm },
  summaryLabel: { ...Typography.caption, color: Colors.inkMuted },
  summaryValue: { ...Typography.title, color: Colors.ink },
  list: { flex: 1 },
  listContent: { gap: Spacing.sm, paddingTop: Spacing.xs },
  clientName: { ...Typography.bodyBold, color: Colors.ink },
  clientMeta: { ...Typography.body, color: Colors.inkMuted },
  due: { ...Typography.bodyBold, color: Colors.error },
  settled: { ...Typography.bodyBold, color: Colors.success },
  empty: { ...Typography.body, color: Colors.inkMuted },
});
