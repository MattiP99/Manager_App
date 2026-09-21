import { useEffect, useState } from 'react';
import { Alert, Platform, View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients, useDeleteClient, useUpdateClient } from '../features/clients/useClients';

export default function EditClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: clients } = useClients();
  const client = clients?.find((c) => c.id === id);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [name, setName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');

  useEffect(() => {
    if (client) {
      setName(client.name);
      setHourlyRate(String(client.hourly_rate));
    }
  }, [client?.id]);

  if (!client) return <Text style={styles.padded}>Cliente non trovato.</Text>;

  const handleSave = () => {
    const rate = parseFloat(hourlyRate.replace(',', '.'));
    if (!name.trim() || isNaN(rate) || rate <= 0) return;
    updateClient.mutate({ id: client.id, name: name.trim(), hourlyRate: rate }, { onSuccess: () => router.back() });
  };

  const handleToggleActive = () => {
    updateClient.mutate({ id: client.id, active: !client.active }, { onSuccess: () => router.back() });
  };

  const handleDelete = () => {
    const message = `Questa azione è irreversibile: eliminerà anche tutte le giornate lavorate e i pagamenti registrati per "${client.name}". Se il cliente ha solo pausato il rapporto, usa "Disattiva cliente" invece.`;
    const confirmDelete = () => deleteClient.mutate(client.id, { onSuccess: () => router.back() });

    // react-native-web's Alert.alert is a complete no-op (no dialog, no
    // callbacks ever fire) — window.confirm is the real cross-platform
    // fix, not a workaround: it's the native browser confirm dialog.
    if (Platform.OS === 'web') {
      if (window.confirm(`Eliminare il cliente?\n\n${message}`)) confirmDelete();
      return;
    }

    Alert.alert('Eliminare il cliente?', message, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modifica cliente</Text>
      <TextInput style={styles.input} placeholder="Nome" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Tariffa oraria (€)"
        keyboardType="decimal-pad"
        value={hourlyRate}
        onChangeText={setHourlyRate}
      />
      {updateClient.isError && <Text style={styles.error}>{(updateClient.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSave} disabled={updateClient.isPending}>
        <Text style={styles.buttonText}>Salva</Text>
      </Pressable>
      <Pressable style={styles.toggleButton} onPress={handleToggleActive} disabled={updateClient.isPending}>
        <Text style={styles.toggleButtonText}>{client.active ? 'Disattiva cliente' : 'Riattiva cliente'}</Text>
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleteClient.isPending}>
        <Text style={styles.deleteButtonText}>Elimina cliente</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  padded: { padding: 24 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  toggleButton: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  toggleButtonText: { color: '#dc2626', fontWeight: '600' },
  deleteButton: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteButtonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
