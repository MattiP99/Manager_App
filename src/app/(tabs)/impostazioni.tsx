import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../../features/household/useHousehold';
import { useClients } from '../../features/clients/useClients';
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { WEEKDAY_OPTIONS } from '../../features/family-calendar/constants';
import { clearStoredKey } from '../../features/notes/crypto/secureKeyStore';

export default function ImpostazioniScreen() {
  const { data: household, isLoading } = useHousehold();
  const { data: clients } = useClients();
  const { data: recurringTemplates } = useRecurringTemplates();
  const weekdayLabel = (weekday: number) => WEEKDAY_OPTIONS.find((w) => w.value === weekday)?.label ?? '?';

  if (isLoading) return <Text style={styles.padded}>Caricamento...</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{household?.name}</Text>
      <Text>Codice invito per far entrare un altro membro:</Text>
      <Text style={styles.code}>{household?.invite_code}</Text>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Clienti</Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/add-client')}>
          <Text style={styles.addButtonText}>+ Cliente</Text>
        </Pressable>
      </View>
      <View style={styles.listWrapper}>
        <FlatList
          style={{ flex: 1 }}
          data={clients ?? []}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.clientRow}
              onPress={() => router.push({ pathname: '/edit-client', params: { id: item.id } })}
            >
              <Text style={styles.clientName}>{item.name}{!item.active ? ' (disattivo)' : ''}</Text>
              <Text>€{item.hourly_rate}/h</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text>Nessun cliente ancora.</Text>}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Impegni ricorrenti</Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/add-recurring-template')}>
          <Text style={styles.addButtonText}>+ Impegno</Text>
        </Pressable>
      </View>
      <View style={styles.listWrapper}>
        <FlatList
          style={{ flex: 1 }}
          data={recurringTemplates ?? []}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.clientRow}
              onPress={() => router.push({ pathname: '/edit-recurring-template', params: { id: item.id } })}
            >
              <Text style={styles.clientName}>{item.title} — {item.person}</Text>
              <Text>{weekdayLabel(item.weekday)}{item.time ? ` ${item.time}` : ''}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text>Nessun impegno ricorrente ancora.</Text>}
        />
      </View>

      <Pressable
        style={styles.button}
        onPress={async () => {
          await clearStoredKey();
          await supabase.auth.signOut();
        }}
      >
        <Text style={styles.buttonText}>Esci</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  padded: { padding: 24 },
  title: { fontSize: 22, fontWeight: '600' },
  code: { fontSize: 28, fontWeight: '700', letterSpacing: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  listWrapper: { flex: 1 },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  addButtonText: { color: 'white', fontWeight: '600' },
  clientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  clientName: { fontWeight: '500' },
  button: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: 'white', fontWeight: '600' },
});
