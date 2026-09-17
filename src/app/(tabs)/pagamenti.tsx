import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useClients } from '../../features/clients/useClients';
import { useAllWorkSessions } from '../../features/work-sessions/useWorkSessions';
import { useAllPayments } from '../../features/payments/usePayments';
import { computeClientSummary, dateRangeForPeriod, filterByDateRange, Period } from '../../features/payments/computeClientSummary';

export default function PagamentiScreen() {
  const [period, setPeriod] = useState<Period>('all');
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessions();
  const { data: payments } = useAllPayments();

  const range = dateRangeForPeriod(period);
  const filteredSessions = filterByDateRange(sessions ?? [], range);
  const filteredPayments = filterByDateRange(payments ?? [], range);

  const rows = (clients ?? []).map((client) => {
    const clientSessions = filteredSessions.filter((s) => s.client_id === client.id);
    const clientPayments = filteredPayments.filter((p) => p.client_id === client.id);
    return { client, summary: computeClientSummary(clientSessions, clientPayments) };
  });

  const grandTotal = computeClientSummary(filteredSessions, filteredPayments);

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
            <Text>{p === 'week' ? 'Settimana' : p === 'month' ? 'Mese' : 'Tutto'}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.grandTotal}>
        <Text>Ore totali: {grandTotal.totalHours}</Text>
        <Text>Dovuto: €{grandTotal.totalDue.toFixed(2)}</Text>
        <Text>Ricevuto: €{grandTotal.totalPaid.toFixed(2)}</Text>
        <Text style={styles.balanceText}>Saldo: €{grandTotal.balance.toFixed(2)}</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.client.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/client/${item.client.id}`)}>
            <Text style={styles.clientName}>{item.client.name}</Text>
            <Text>{item.summary.totalHours}h — dovuto €{item.summary.totalDue.toFixed(2)} — ricevuto €{item.summary.totalPaid.toFixed(2)}</Text>
            <Text style={item.summary.balance > 0 ? styles.due : styles.settled}>
              Saldo: €{item.summary.balance.toFixed(2)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text>Nessun cliente ancora.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  periodRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  periodButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, alignItems: 'center' },
  periodButtonActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  grandTotal: { backgroundColor: '#f3f4f6', borderRadius: 8, padding: 12, gap: 2, marginBottom: 8 },
  balanceText: { fontWeight: '700' },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  clientName: { fontWeight: '600' },
  due: { color: '#dc2626' },
  settled: { color: '#16a34a' },
});
