import { View, Text, StyleSheet } from 'react-native';

export default function NoteScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Note</Text>
      <Text>Sezione in costruzione — arriva nel prossimo blocco.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
});
