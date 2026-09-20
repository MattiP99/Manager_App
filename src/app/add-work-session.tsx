import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../features/clients/useClients';
import { useCreateWorkSession } from '../features/work-sessions/useWorkSessions';
import { hoursBetweenTimes, isValidTimeRange, toLocalDateString } from '../lib/dates';

export default function AddWorkSessionScreen() {
  const { clientId: preselectedClientId, date: preselectedDate } = useLocalSearchParams<{ clientId?: string; date?: string }>();
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState(preselectedClientId ?? '');
  const [date, setDate] = useState(preselectedDate ?? toLocalDateString(new Date()));
  const [hours, setHours] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const createSession = useCreateWorkSession();

  const selectedClient = clients?.find((c) => c.id === clientId);

  const handleSubmit = () => {
    const hoursNum = parseFloat(hours.replace(',', '.'));
    if (!selectedClient || isNaN(hoursNum) || hoursNum <= 0) return;
    if (!isValidTimeRange(startTime, endTime)) {
      setValidationError("Orario non valido — usa il formato HH:MM con la fine dopo l'inizio.");
      return;
    }
    if (hoursNum > hoursBetweenTimes(startTime, endTime)) {
      setValidationError('Le ore lavorate non possono superare la durata tra inizio e fine.');
      return;
    }
    setValidationError(null);
    createSession.mutate(
      { clientId, date, hours: hoursNum, rateSnapshot: selectedClient.hourly_rate, startTime, endTime, note: note.trim() || undefined },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nuova giornata lavorata</Text>

      {!preselectedClientId && (
        <View style={styles.clientPicker}>
          {(clients ?? []).filter((c) => c.active).map((c) => (
            <Pressable
              key={c.id}
              style={[styles.clientOption, clientId === c.id && styles.clientOptionSelected]}
              onPress={() => setClientId(c.id)}
            >
              <Text>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {selectedClient && <Text>Tariffa: €{selectedClient.hourly_rate}/h</Text>}

      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput style={styles.input} placeholder="Ore lavorate" keyboardType="decimal-pad" value={hours} onChangeText={setHours} />
      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora inizio (HH:MM)" value={startTime} onChangeText={setStartTime} />
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora fine (HH:MM)" value={endTime} onChangeText={setEndTime} />
      </View>
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {validationError && <Text style={styles.error}>{validationError}</Text>}
      {createSession.isError && <Text style={styles.error}>{(createSession.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createSession.isPending || !selectedClient}>
        <Text style={styles.buttonText}>{createSession.isPending ? 'Salvataggio...' : 'Salva'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  clientPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clientOption: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  clientOptionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  timeRow: { flexDirection: 'row', gap: 8 },
  timeInput: { flex: 1 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
