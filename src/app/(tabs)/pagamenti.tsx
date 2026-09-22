import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { useClients } from '../../features/clients/useClients';
import { useAllWorkSessions } from '../../features/work-sessions/useWorkSessions';
import { useAllPayments } from '../../features/payments/usePayments';
import { periodLabel } from '../../features/payments/computeClientSummary';
import type { PaymentPeriodMode } from '../../features/payments/computeClientSummary';
import { buildClientPaymentRows } from '../../features/payments/clientPaymentRows';
import type { ClientPaymentRow } from '../../features/payments/clientPaymentRows';
import { PAYMENT_METRICS, PERIOD_LABELS } from '../../features/payments/constants';
import type { PaymentMetric } from '../../features/payments/constants';
import { PaymentMetricList } from '../../features/payments/PaymentMetricList';
import { AddPaymentForm } from '../../features/payments/AddPaymentForm';
import { AddWorkSessionForm } from '../../features/work-sessions/AddWorkSessionForm';
import { ClientDetailPanel } from '../../features/clients/ClientDetailPanel';
import { PressableCard } from '../../components/PressableCard';
import { DetailModal } from '../../components/DetailModal';
import { shiftMonth, shiftWeek, toLocalDateString } from '../../lib/dates';
import { Colors, Fonts, Radii, Spacing, Typography } from '../../lib/theme';

export default function PagamentiScreen() {
  const [mode, setMode] = useState<PaymentPeriodMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => toLocalDateString(new Date()));
  const [openMetric, setOpenMetric] = useState<PaymentMetric | null>(null);
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [addingWorkSessionFor, setAddingWorkSessionFor] = useState<string | null>(null);
  const [addingPaymentFor, setAddingPaymentFor] = useState<string | null>(null);
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
          <PressableCard key={metric.key} onPress={() => setOpenMetric(metric.key)}>
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
          <PressableCard onPress={() => setOpenClientId(item.client.id)}>
            <Text style={styles.clientName}>{item.client.name}</Text>
            <Text style={styles.clientMeta}>
              {item.summary.totalHours.toFixed(2)}h — dovuto €{item.summary.totalDue.toFixed(2)} — ricevuto €{item.summary.totalPaid.toFixed(2)}
            </Text>
            <Text style={item.summary.balance > 0 ? styles.due : styles.settled}>Saldo: €{item.summary.balance.toFixed(2)}</Text>
          </PressableCard>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nessun cliente ancora.</Text>}
      />

      <DetailModal visible={!!openMetric} onClose={() => setOpenMetric(null)} variant="sheet">
        {openMetric && (
          <PaymentMetricList metric={openMetric} mode={mode} anchorDate={anchorDate} onSelectClient={setOpenClientId} />
        )}
      </DetailModal>

      <DetailModal visible={!!openClientId} onClose={() => setOpenClientId(null)} variant="sheet">
        {openClientId && (
          <ClientDetailPanel
            clientId={openClientId}
            onAddWorkSession={() => setAddingWorkSessionFor(openClientId)}
            onAddPayment={() => setAddingPaymentFor(openClientId)}
          />
        )}
      </DetailModal>

      <DetailModal visible={!!addingWorkSessionFor} onClose={() => setAddingWorkSessionFor(null)} variant="side">
        {addingWorkSessionFor && (
          <AddWorkSessionForm preselectedClientId={addingWorkSessionFor} onSaved={() => setAddingWorkSessionFor(null)} />
        )}
      </DetailModal>

      <DetailModal visible={!!addingPaymentFor} onClose={() => setAddingPaymentFor(null)} variant="side">
        {addingPaymentFor && (
          <AddPaymentForm clientId={addingPaymentFor} onSaved={() => setAddingPaymentFor(null)} />
        )}
      </DetailModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.md },
  headerContainer: { gap: Spacing.md, marginBottom: Spacing.sm },
  // Bianco, centrato, più grande, non grassetto — sopra il gradiente
  // canvas→accento di AppShell.
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
