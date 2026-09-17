import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useCreateHousehold, useJoinHousehold } from '../features/household/useHousehold';

export default function JoinHouseholdScreen() {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const createHousehold = useCreateHousehold();
  const joinHousehold = useJoinHousehold();

  const pending = createHousehold.isPending || joinHousehold.isPending;
  const error = (createHousehold.error ?? joinHousehold.error) as Error | null;

  const handleSubmit = () => {
    if (mode === 'create') {
      createHousehold.mutate(name, { onSuccess: () => router.replace('/') });
    } else {
      joinHousehold.mutate(code, { onSuccess: () => router.replace('/') });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Benvenuto</Text>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleButton, mode === 'create' && styles.toggleButtonActive]}
          onPress={() => setMode('create')}
        >
          <Text>Crea nuovo nucleo</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, mode === 'join' && styles.toggleButtonActive]}
          onPress={() => setMode('join')}
        >
          <Text>Unisciti con codice</Text>
        </Pressable>
      </View>

      {mode === 'create' ? (
        <TextInput
          style={styles.input}
          placeholder="Nome del nucleo (es. Famiglia Rossi)"
          value={name}
          onChangeText={setName}
        />
      ) : (
        <TextInput
          style={styles.input}
          placeholder="Codice invito (6 caratteri)"
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
        />
      )}

      {error && <Text style={styles.error}>{error.message}</Text>}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={pending}>
        <Text style={styles.buttonText}>{pending ? 'Attendere...' : 'Continua'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
});
