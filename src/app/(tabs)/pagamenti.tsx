import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useClients } from '../../features/clients/useClients';
import { useAllWorkSessions } from '../../features/work-sessions/useWorkSessions';
import { useAllPayments } from '../../features/payments/usePayments';
import type { Period } from '../../features/payments/computeClientSummary';
import { buildClientPaymentRows } from '../../features/payments/clientPaymentRows';
import type { ClientPaymentRow } from '../../features/payments/clientPaymentRows';
import { PAYMENT_METRICS } from '../../features/payments/constants';
import { PressableCard } from '../../components/PressableCard';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

const PERIOD_LABELS: Record<Period, string> = { week: 'Settimana', month: 'Mese', all: 'Tutto' };

export default function PagamentiScreen() {
  const [period, setPeriod] = useState<Period>('all');
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessions();
  const { data: payments } = useAllPayments();

  const rows = buildClientPaymentRows(clients ?? [], sessions ?? [], payments ?? [], period);
  const grandTotal = rows.reduce(
    (acc, r) => ({
      totalHours: acc.totalHours + r.summary.totalHours,
      totalDue: acc.totalDue + r.summary.totalDue,
      totalPaid: acc.totalPaid + r.summary.totalPaid,
      balance: acc.balance + r.summary.balance,
    }),
    { totalHours: 0, totalDue: 0, totalPaid: 0, balance: 0 }
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pagamenti</Text>

      <View style={styles.periodRow}>
        {(['week', 'month', 'all'] as Period[]).map((p) => (
          <Pressable
            key={p}
            style={[styles.periodButton, period === p && styles.periodButtonActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={period === p ? styles.periodTextActive : styles.periodText}>{PERIOD_LABELS[p]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.summaryGrid}>
        {PAYMENT_METRICS.map((metric) => (
          <PressableCard
            key={metric.key}
            onPress={() => router.push({ pathname: '/payment-detail', params: { metric: metric.key, period } })}
          >
            <Text style={styles.summaryLabel}>{metric.label}</Text>
            <Text style={styles.summaryValue}>{metric.format(grandTotal[metric.key])}</Text>
          </PressableCard>
        ))}
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(r) => r.client.id}
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
  container: { flex: 1, padding: Spacing.md, gap: Spacing.md },
  title: { ...Typography.title, color: Colors.ink },
  periodRow: { flexDirection: 'row', gap: Spacing.sm },
  periodButton: {
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
  periodButtonActive: { borderColor: Colors.accent },
  periodText: { ...Typography.body, color: Colors.inkMuted },
  periodTextActive: { ...Typography.bodyBold, color: Colors.ink },
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
