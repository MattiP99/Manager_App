import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { useUpdateWorkSession } from './useWorkSessions';
import type { WorkSessionStatus } from './useWorkSessions';
import { toShortTime } from '../../lib/dates';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface WorkSessionDetailProps {
  session: WorkSessionStatus;
  clientName: string;
}

export function WorkSessionDetail({ session, clientName }: WorkSessionDetailProps) {
  const [note, setNote] = useState(session.note ?? '');
  const updateSession = useUpdateWorkSession();

  const handleSave = () => {
    updateSession.mutate({ id: session.id, note: note.trim() || null });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.clientName}>{clientName}</Text>
      <Text style={styles.meta}>
        {session.hours}h — €{session.amount_due.toFixed(2)}
        {session.start_time && session.end_time ? ` — ${toShortTime(session.start_time)}–${toShortTime(session.end_time)}` : ''}
      </Text>
      <Text style={styles.label}>Nota</Text>
      <TextInput
        style={styles.noteInput}
        placeholder="Aggiungi una nota..."
        value={note}
        onChangeText={setNote}
        multiline
      />
      {updateSession.isError && <Text style={styles.error}>{(updateSession.error as Error).message}</Text>}
      {updateSession.isSuccess && <Text style={styles.meta}>Nota salvata</Text>}
      <Button
        label={updateSession.isPending ? 'Salvataggio...' : 'Salva nota'}
        onPress={handleSave}
        disabled={updateSession.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  clientName: { ...Typography.title, color: Colors.ink },
  meta: { ...Typography.body, color: Colors.inkMuted },
  label: { ...Typography.bodyBold, color: Colors.ink, marginTop: Spacing.sm },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
    ...Typography.body,
    color: Colors.ink,
  },
  error: { color: Colors.error },
});
