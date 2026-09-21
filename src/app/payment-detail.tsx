import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../features/clients/useClients';
import { useAllWorkSessions } from '../features/work-sessions/useWorkSessions';
import { useAllPayments } from '../features/payments/usePayments';
import { buildClientPaymentRows } from '../features/payments/clientPaymentRows';
import type { ClientPaymentRow } from '../features/payments/clientPaymentRows';
import { PAYMENT_METRICS } from '../features/payments/constants';
import type { PaymentMetric } from '../features/payments/constants';
import { periodLabel } from '../features/payments/computeClientSummary';
import type { PaymentPeriodMode } from '../features/payments/computeClientSummary';
import { PressableCard } from '../components/PressableCard';
import { GRADIENT_COLORS, GRADIENT_LOCATIONS } from '../components/AppShell';
import { Colors, Spacing, Typography } from '../lib/theme';

export default function PaymentDetailScreen() {
  const { metric, mode, anchorDate } = useLocalSearchParams<{ metric: PaymentMetric; mode: PaymentPeriodMode; anchorDate: string }>();
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessions();
  const { data: payments } = useAllPayments();

  const metricConfig = PAYMENT_METRICS.find((m) => m.key === metric);
  if (!metricConfig) return <Text style={styles.padded}>Metrica non valida.</Text>;
  // mode/anchorDate arrivano solo dal tap su una card di riepilogo in
  // pagamenti.tsx (mai da un link diretto) — mode è comunque validato per
  // sicurezza, stesso trattamento di metric sopra.
  const safeMode: PaymentPeriodMode = mode === 'month' ? 'month' : 'week';

  const rows = buildClientPaymentRows(clients ?? [], sessions ?? [], payments ?? [], safeMode, anchorDate);

  return (
    <LinearGradient colors={GRADIENT_COLORS} locations={GRADIENT_LOCATIONS} style={styles.fill}>
      <View style={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Indietro</Text>
        </Pressable>
        <Text style={styles.title}>{metricConfig.label}</Text>
        <Text style={styles.subtitle}>{periodLabel(safeMode, anchorDate)}</Text>

        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={rows}
          keyExtractor={(r) => r.client.id}
          renderItem={({ item }: { item: ClientPaymentRow }) => {
            const value = item.summary[metricConfig.key];
            const valueStyle =
              metricConfig.key === 'balance' ? (value > 0 ? styles.due : styles.settled) : styles.clientValue;
            return (
              <PressableCard onPress={() => router.push(`/client/${item.client.id}`)}>
                <Text style={styles.clientName}>{item.client.name}</Text>
                <Text style={valueStyle}>{metricConfig.format(value)}</Text>
              </PressableCard>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Nessun cliente ancora.</Text>}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  padded: { padding: Spacing.lg },
  back: { color: Colors.ink, marginBottom: Spacing.xs },
  title: { ...Typography.title, color: Colors.ink },
  subtitle: { ...Typography.body, color: Colors.inkMuted },
  list: { flex: 1 },
  listContent: { gap: Spacing.sm, paddingTop: Spacing.xs },
  clientName: { ...Typography.bodyBold, color: Colors.ink },
  clientValue: { ...Typography.title, color: Colors.ink },
  due: { ...Typography.title, color: Colors.error },
  settled: { ...Typography.title, color: Colors.success },
  empty: { ...Typography.body, color: Colors.inkMuted },
});
