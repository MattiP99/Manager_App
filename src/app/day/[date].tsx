import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../../features/clients/useClients';
import { useAllWorkSessionsStatus } from '../../features/work-sessions/useWorkSessions';
import { formatDayLabel } from '../../features/calendar/calendarGrid';

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessionsStatus();

  const daySessions = (sessions ?? []).filter((s) => s.date === date);
  const clientName = (clientId: string) => clients?.find((c) => c.id === clientId)?.name ?? 'Cliente';

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Indietro</Text>
      </Pressable>
      <Text style={styles.title}>{formatDayLabel(date)}</Text>

      <FlatList
        style={{ flex: 1 }}
        data={daySessions}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: item.status === 'paid' ? '#dcfce7' : '#fee2e2' }]}>
            <Text style={styles.rowClient}>{clientName(item.client_id)}</Text>
            <Text>{item.hours}h — €{item.amount_due.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>Nessuna giornata lavorata in questo giorno.</Text>}
      />

      <Pressable
        style={styles.addButton}
        onPress={() => router.push({ pathname: '/add-work-session', params: { date } })}
      >
        <Text style={styles.addButtonText}>+ Giornata</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  back: { color: '#2563eb', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 6, marginTop: 4 },
  rowClient: { fontWeight: '600' },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  addButtonText: { color: 'white', fontWeight: '600' },
});
