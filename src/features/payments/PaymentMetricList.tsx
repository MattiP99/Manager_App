import { Text, StyleSheet, ScrollView } from 'react-native';
import { useClients } from '../clients/useClients';
import { useAllWorkSessions } from '../work-sessions/useWorkSessions';
import { useAllPayments } from './usePayments';
import { buildClientPaymentRows } from './clientPaymentRows';
import type { ClientPaymentRow } from './clientPaymentRows';
import { PAYMENT_METRICS } from './constants';
import type { PaymentMetric } from './constants';
import { periodLabel } from './computeClientSummary';
import type { PaymentPeriodMode } from './computeClientSummary';
import { PressableCard } from '../../components/PressableCard';
import { Colors, Spacing, Typography } from '../../lib/theme';

interface PaymentMetricListProps {
  metric: PaymentMetric;
  mode: PaymentPeriodMode;
  anchorDate: string;
  onSelectClient: (clientId: string) => void;
}

/** Contenuto del foglio "Dettaglio metrica" (Ore totali/Dovuto/Ricevuto/Saldo per cliente) — guscio (DetailModal, chiamato da pagamenti.tsx) e contenuto separati, stesso principio di NoteSectionDetail. Sostituisce l'ex pagina a tutto schermo payment-detail.tsx. */
export function PaymentMetricList({ metric, mode, anchorDate, onSelectClient }: PaymentMetricListProps) {
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessions();
  const { data: payments } = useAllPayments();

  const metricConfig = PAYMENT_METRICS.find((m) => m.key === metric);
  if (!metricConfig) return <Text style={styles.padded}>Metrica non valida.</Text>;

  const rows = buildClientPaymentRows(clients ?? [], sessions ?? [], payments ?? [], mode, anchorDate);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{metricConfig.label}</Text>
      <Text style={styles.subtitle}>{periodLabel(mode, anchorDate)}</Text>
      <Text style={styles.metricSubtitle}>{metricConfig.subtitle}</Text>

      {rows.length === 0 && <Text style={styles.empty}>Nessun cliente ancora.</Text>}
      {rows.map((row: ClientPaymentRow) => {
        const value = row.summary[metricConfig.key];
        const valueStyle = metricConfig.key === 'balance' ? (value > 0 ? styles.due : styles.settled) : styles.clientValue;
        return (
          <PressableCard key={row.client.id} onPress={() => onSelectClient(row.client.id)}>
            <Text style={styles.clientName}>{row.client.name}</Text>
            <Text style={valueStyle}>{metricConfig.format(value)}</Text>
          </PressableCard>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { gap: Spacing.sm },
  padded: { padding: Spacing.md, ...Typography.body, color: Colors.ink },
  title: { ...Typography.title, color: Colors.ink },
  subtitle: { ...Typography.body, color: Colors.inkMuted },
  metricSubtitle: { ...Typography.small, color: Colors.inkMuted },
  clientName: { ...Typography.bodyBold, color: Colors.ink },
  clientValue: { ...Typography.title, color: Colors.ink },
  due: { ...Typography.title, color: Colors.error },
  settled: { ...Typography.title, color: Colors.success },
  empty: { ...Typography.body, color: Colors.inkMuted },
});
