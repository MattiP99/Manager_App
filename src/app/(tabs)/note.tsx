import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useNoteSections } from '../../features/notes/useNoteSections';

export default function NoteScreen() {
  const { data: sections } = useNoteSections();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Note</Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/add-note-section')}>
          <Text style={styles.addButtonText}>+ Sezione</Text>
        </Pressable>
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={sections ?? []}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push({ pathname: '/note-section/[id]', params: { id: item.id } })}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            {item.type === 'password' && <Text style={styles.lockIcon}>🔒</Text>}
          </Pressable>
        )}
        ListEmptyComponent={<Text>Nessuna sezione ancora.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '600' },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  addButtonText: { color: 'white', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  lockIcon: { fontSize: 16 },
});
