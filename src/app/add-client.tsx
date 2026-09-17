import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useCreateClient } from '../features/clients/useClients';

export default function AddClientScreen() {
  const [name, setName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const createClient = useCreateClient();

  const handleSubmit = () => {
    const rate = parseFloat(hourlyRate.replace(',', '.'));
    if (!name.trim() || isNaN(rate) || rate <= 0) return;
    createClient.mutate({ name: name.trim(), hourlyRate: rate }, { onSuccess: () => router.back() });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuovo cliente</Text>
      <TextInput style={styles.input} placeholder="Nome" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Tariffa oraria (€)"
        keyboardType="decimal-pad"
        value={hourlyRate}
        onChangeText={setHourlyRate}
      />
      {createClient.isError && <Text style={styles.error}>{(createClient.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createClient.isPending}>
        <Text style={styles.buttonText}>{createClient.isPending ? 'Salvataggio...' : 'Salva'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
