import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../../features/clients/useClients';
import { useWorkSessionsByClient } from '../../features/work-sessions/useWorkSessions';
import { usePaymentsByClient } from '../../features/payments/usePayments';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: clients } = useClients();
  const client = clients?.find((c) => c.id === id);
  const { data: sessions } = useWorkSessionsByClient(id);
  const { data: payments } = usePaymentsByClient(id);

  if (!client) return <Text style={styles.padded}>Caricamento...</Text>;

  const totalDue = (sessions ?? []).reduce((sum, s) => sum + s.amount_due, 0);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const balance = totalDue - totalPaid;

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Indietro</Text>
      </Pressable>
      <Text style={styles.title}>{client.name}</Text>
      <Text>Tariffa: €{client.hourly_rate}/h</Text>
      <Text style={styles.balance}>Saldo da ricevere: €{balance.toFixed(2)}</Text>

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.actionButton}
          onPress={() => router.push({ pathname: '/add-work-session', params: { clientId: client.id } })}
        >
          <Text style={styles.actionButtonText}>+ Giornata</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => router.push({ pathname: '/add-payment', params: { clientId: client.id } })}
        >
          <Text style={styles.actionButtonText}>+ Pagamento</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Giornate lavorate</Text>
      <FlatList
        data={sessions ?? []}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: item.status === 'paid' ? '#dcfce7' : '#fee2e2' }]}>
            <Text>{item.date} — {item.hours}h</Text>
            <Text>€{item.amount_due.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>Nessuna giornata registrata.</Text>}
      />

      <Text style={styles.sectionTitle}>Pagamenti ricevuti</Text>
      <FlatList
        data={payments ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>{item.date}</Text>
            <Text>€{item.amount.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>Nessun pagamento registrato.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  padded: { padding: 24 },
  back: { color: '#2563eb', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  balance: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  actionsRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  actionButton: { flex: 1, backgroundColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center' },
  actionButtonText: { color: 'white', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6, marginTop: 4 },
});
