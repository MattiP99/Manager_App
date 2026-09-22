import { Text, Pressable, StyleSheet, View, ScrollView } from 'react-native';
import { useClients } from './useClients';
import { useWorkSessionsByClient } from '../work-sessions/useWorkSessions';
import { usePaymentsByClient } from '../payments/usePayments';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface ClientDetailPanelProps {
  clientId: string;
  onAddWorkSession: () => void;
  onAddPayment: () => void;
}

/** Contenuto del pannello "Dettaglio cliente" — guscio (DetailModal, pannello a foglio dal basso) e contenuto separati, stesso principio di NoteSectionDetail. Sostituisce l'ex pagina a tutto schermo client/[id].tsx. I due bottoni aprono pannelli laterali (onAddWorkSession/onAddPayment, gestiti dal chiamante) invece di navigare. */
export function ClientDetailPanel({ clientId, onAddWorkSession, onAddPayment }: ClientDetailPanelProps) {
  const { data: clients, isLoading } = useClients();
  const client = clients?.find((c) => c.id === clientId);
  const { data: sessions } = useWorkSessionsByClient(clientId);
  const { data: payments } = usePaymentsByClient(clientId);

  if (isLoading) return <Text style={styles.padded}>Caricamento...</Text>;
  if (!client) return <Text style={styles.padded}>Cliente non trovato.</Text>;

  const totalDue = (sessions ?? []).reduce((sum, s) => sum + s.amount_due, 0);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const balance = totalDue - totalPaid;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{client.name}</Text>
      <Text style={styles.rate}>Tariffa: €{client.hourly_rate}/h</Text>
      <Text style={balance > 0 ? styles.due : styles.settled}>Saldo da ricevere: €{balance.toFixed(2)}</Text>

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton} onPress={onAddWorkSession}>
          <Text style={styles.actionButtonText}>+ Giornata</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onAddPayment}>
          <Text style={styles.actionButtonText}>+ Pagamento</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Giornate lavorate</Text>
      {/* .map() invece di FlatList: questo pannello vive già dentro la
          ScrollView di un DetailModal a foglio — annidare una FlatList
          (VirtualizedList) dentro una ScrollView produce un warning React
          Native, stesso motivo per cui NoteSectionDetail fa lo stesso. */}
      {(sessions ?? []).length === 0 && <Text style={styles.empty}>Nessuna giornata registrata.</Text>}
      {(sessions ?? []).map((item) => (
        <View key={item.id} style={[styles.row, { backgroundColor: item.status === 'paid' ? Colors.successBg : Colors.errorBg }]}>
          <Text style={styles.rowText}>{item.date} — {item.hours}h</Text>
          <Text style={styles.rowText}>€{item.amount_due.toFixed(2)}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Pagamenti ricevuti</Text>
      {(payments ?? []).length === 0 && <Text style={styles.empty}>Nessun pagamento registrato.</Text>}
      {(payments ?? []).map((item) => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.rowText}>{item.date}</Text>
          <Text style={styles.rowText}>€{item.amount.toFixed(2)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { gap: Spacing.sm },
  padded: { padding: Spacing.md, ...Typography.body, color: Colors.ink },
  title: { ...Typography.title, color: Colors.ink },
  rate: { ...Typography.body, color: Colors.inkMuted },
  due: { ...Typography.bodyBold, color: Colors.error },
  settled: { ...Typography.bodyBold, color: Colors.success },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.sm },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  actionButtonText: { ...Typography.bodyBold, color: Colors.ink },
  sectionTitle: { ...Typography.subtitle, color: Colors.ink, marginTop: Spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.sm,
    marginTop: Spacing.xs,
  },
  rowText: { ...Typography.body, color: Colors.ink },
  empty: { ...Typography.body, color: Colors.inkMuted, marginTop: Spacing.xs },
});
