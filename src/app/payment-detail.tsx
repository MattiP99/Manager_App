import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../features/clients/useClients';
import { useAllWorkSessions } from '../features/work-sessions/useWorkSessions';
import { useAllPayments } from '../features/payments/usePayments';
import { buildClientPaymentRows } from '../features/payments/clientPaymentRows';
import type { ClientPaymentRow } from '../features/payments/clientPaymentRows';
import { PAYMENT_METRICS, PERIOD_LABELS } from '../features/payments/constants';
import type { PaymentMetric } from '../features/payments/constants';
import type { Period } from '../features/payments/computeClientSummary';
import { PressableCard } from '../components/PressableCard';
import { Colors, Spacing, Typography } from '../lib/theme';

export default function PaymentDetailScreen() {
  const { metric, period } = useLocalSearchParams<{ metric: PaymentMetric; period: Period }>();
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessions();
  const { data: payments } = useAllPayments();

  const metricConfig = PAYMENT_METRICS.find((m) => m.key === metric);
  if (!metricConfig) return <Text style={styles.padded}>Metrica non valida.</Text>;
  const safePeriod: Period = period === 'week' || period === 'month' ? period : 'all';

  const rows = buildClientPaymentRows(clients ?? [], sessions ?? [], payments ?? [], safePeriod);

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Indietro</Text>
      </Pressable>
      <Text style={styles.title}>{metricConfig.label}</Text>
      <Text style={styles.subtitle}>{PERIOD_LABELS[safePeriod]}</Text>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(r) => r.client.id}
        renderItem={({ item }: { item: ClientPaymentRow }) => (
          <PressableCard onPress={() => router.push(`/client/${item.client.id}`)}>
            <Text style={styles.clientName}>{item.client.name}</Text>
            <Text style={styles.clientValue}>{metricConfig.format(item.summary[metricConfig.key])}</Text>
          </PressableCard>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nessun cliente ancora.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.md, backgroundColor: Colors.canvas },
  padded: { padding: Spacing.lg },
  back: { color: Colors.ink, marginBottom: Spacing.xs },
  title: { ...Typography.title, color: Colors.ink },
  subtitle: { ...Typography.body, color: Colors.inkMuted },
  list: { flex: 1 },
  listContent: { gap: Spacing.sm, paddingTop: Spacing.xs },
  clientName: { ...Typography.bodyBold, color: Colors.ink },
  clientValue: { ...Typography.title, color: Colors.ink },
  empty: { ...Typography.body, color: Colors.inkMuted },
});
