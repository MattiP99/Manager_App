import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useClients } from '../clients/useClients';
import { useCreateWorkSession } from './useWorkSessions';
import { hoursBetweenTimes, isValidTimeRange, toLocalDateString } from '../../lib/dates';
import { Button } from '../../components/Button';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface AddWorkSessionFormProps {
  /** Se passato, il selettore cliente non viene mostrato — stesso principio già usato altrove (es. AddExpenseForm riceve la categoria già scelta). */
  preselectedClientId?: string;
  preselectedDate?: string;
  onSaved: () => void;
}

/** Contenuto del form "Nuova giornata lavorata" — guscio (DetailModal) e contenuto separati, stesso principio di AddExpenseForm. Usato sia dalla rotta add-work-session.tsx (Calendario, nessun cliente preselezionato) sia dal pannello laterale del dettaglio cliente (Pagamenti, clientId già noto). */
export function AddWorkSessionForm({ preselectedClientId, preselectedDate, onSaved }: AddWorkSessionFormProps) {
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
      { onSuccess: onSaved }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuova giornata lavorata</Text>

      {!preselectedClientId && (
        <View style={styles.optionsRow}>
          {(clients ?? []).filter((c) => c.active).map((c) => (
            <Pressable
              key={c.id}
              style={[styles.option, clientId === c.id && styles.optionSelected]}
              onPress={() => setClientId(c.id)}
            >
              <Text style={clientId === c.id ? styles.optionTextSelected : styles.optionText}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {selectedClient && <Text style={styles.rateLabel}>Tariffa: €{selectedClient.hourly_rate}/h</Text>}

      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput style={styles.input} placeholder="Ore lavorate" keyboardType="decimal-pad" value={hours} onChangeText={setHours} />
      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora inizio (HH:MM)" value={startTime} onChangeText={setStartTime} />
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora fine (HH:MM)" value={endTime} onChangeText={setEndTime} />
      </View>
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {validationError && <Text style={styles.error}>{validationError}</Text>}
      {createSession.isError && <Text style={styles.error}>{(createSession.error as Error).message}</Text>}
      <Button
        label={createSession.isPending ? 'Salvataggio...' : 'Salva'}
        onPress={handleSubmit}
        disabled={createSession.isPending || !selectedClient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  title: { ...Typography.title, color: Colors.ink },
  rateLabel: { ...Typography.body, color: Colors.inkMuted },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  option: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  optionSelected: { borderColor: Colors.accent, backgroundColor: Colors.canvas },
  optionText: { ...Typography.body, color: Colors.inkMuted },
  optionTextSelected: { ...Typography.bodyBold, color: Colors.ink },
  input: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    ...Typography.body,
    color: Colors.ink,
  },
  timeRow: { flexDirection: 'row', gap: Spacing.sm },
  timeInput: { flex: 1 },
  error: { ...Typography.body, color: Colors.error },
});
