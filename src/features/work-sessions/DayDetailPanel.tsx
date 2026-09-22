import { useState } from 'react';
import { Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useClients } from '../clients/useClients';
import { useAllWorkSessionsStatus } from './useWorkSessions';
import type { WorkSessionStatus } from './useWorkSessions';
import { WorkSessionDetail } from './WorkSessionDetail';
import { AddWorkSessionForm } from './AddWorkSessionForm';
import { DetailModal } from '../../components/DetailModal';
import { formatDayLabel } from '../calendar/calendarGrid';
import { toShortTime } from '../../lib/dates';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface DayDetailPanelProps {
  date: string;
}

/** Contenuto del foglio "Riepilogo giornata" (Calendario Lavoro) — guscio (DetailModal, chiamato da index.tsx) e contenuto separati, stesso principio di NoteSectionDetail/ClientDetailPanel. Sostituisce l'ex pagina a tutto schermo day/[date].tsx. Il form "+ Giornata" si apre come pannello laterale (variant="side") sopra questo foglio già aperto — stessa gerarchia a livelli di Pagamenti. */
export function DayDetailPanel({ date }: DayDetailPanelProps) {
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessionsStatus();
  const [selectedSession, setSelectedSession] = useState<WorkSessionStatus | null>(null);
  const [addingSession, setAddingSession] = useState(false);

  const daySessions = (sessions ?? []).filter((s) => s.date === date);
  const clientName = (clientId: string) => clients?.find((c) => c.id === clientId)?.name ?? 'Cliente';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{formatDayLabel(date)}</Text>

      {daySessions.length === 0 && <Text style={styles.empty}>Nessuna giornata lavorata in questo giorno.</Text>}
      {daySessions.map((item) => (
        <Pressable key={item.id} style={styles.card} onPress={() => setSelectedSession(item)}>
          <Text style={styles.clientName}>{clientName(item.client_id)}</Text>
          <Text style={styles.meta}>
            {item.hours}h — €{item.amount_due.toFixed(2)}
            {item.start_time && item.end_time ? ` — ${toShortTime(item.start_time)}–${toShortTime(item.end_time)}` : ''}
          </Text>
          {item.note && <Text style={styles.note}>{item.note}</Text>}
        </Pressable>
      ))}

      <Pressable style={styles.addButton} onPress={() => setAddingSession(true)}>
        <Text style={styles.addButtonText}>+ Giornata</Text>
      </Pressable>

      <DetailModal visible={!!selectedSession} onClose={() => setSelectedSession(null)}>
        {selectedSession && <WorkSessionDetail session={selectedSession} clientName={clientName(selectedSession.client_id)} />}
      </DetailModal>

      <DetailModal visible={addingSession} onClose={() => setAddingSession(false)} variant="side">
        <AddWorkSessionForm preselectedDate={date} onSaved={() => setAddingSession(false)} />
      </DetailModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { gap: Spacing.md },
  title: { ...Typography.title, color: Colors.ink },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  clientName: { ...Typography.title, color: Colors.ink },
  meta: { ...Typography.body, color: Colors.inkMuted },
  note: { ...Typography.body, color: Colors.ink },
  empty: { ...Typography.body, color: Colors.inkMuted },
  addButton: {
    backgroundColor: Colors.actionBrown,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    alignSelf: 'center',
  },
  addButtonText: { ...Typography.bodyBold, color: Colors.surface },
});
