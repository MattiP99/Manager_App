import { View, Text, StyleSheet } from 'react-native';

export default function SpeseScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spese</Text>
      <Text>Sezione in costruzione — arriva nel prossimo blocco.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
});
