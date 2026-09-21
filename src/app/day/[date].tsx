import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../../features/clients/useClients';
import { useAllWorkSessionsStatus } from '../../features/work-sessions/useWorkSessions';
import type { WorkSessionStatus } from '../../features/work-sessions/useWorkSessions';
import { WorkSessionDetail } from '../../features/work-sessions/WorkSessionDetail';
import { DetailModal } from '../../components/DetailModal';
import { GRADIENT_COLORS, GRADIENT_LOCATIONS } from '../../components/AppShell';
import { formatDayLabel } from '../../features/calendar/calendarGrid';
import { toShortTime } from '../../lib/dates';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessionsStatus();
  const [selectedSession, setSelectedSession] = useState<WorkSessionStatus | null>(null);

  const daySessions = (sessions ?? []).filter((s) => s.date === date);
  const clientName = (clientId: string) => clients?.find((c) => c.id === clientId)?.name ?? 'Cliente';

  return (
    <LinearGradient colors={GRADIENT_COLORS} locations={GRADIENT_LOCATIONS} style={styles.fill}>
      <View style={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Indietro</Text>
        </Pressable>
        <Text style={styles.title}>{formatDayLabel(date)}</Text>

        <FlatList
          style={{ flex: 1 }}
          data={daySessions}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => setSelectedSession(item)}>
              <Text style={styles.clientName}>{clientName(item.client_id)}</Text>
              <Text style={styles.meta}>
                {item.hours}h — €{item.amount_due.toFixed(2)}
                {item.start_time && item.end_time ? ` — ${toShortTime(item.start_time)}–${toShortTime(item.end_time)}` : ''}
              </Text>
              {item.note && <Text style={styles.note}>{item.note}</Text>}
            </Pressable>
          )}
          ListEmptyComponent={<Text>Nessuna giornata lavorata in questo giorno.</Text>}
        />

        <Pressable style={styles.addButton} onPress={() => router.push({ pathname: '/add-work-session', params: { date } })}>
          <Text style={styles.addButtonText}>+ Giornata</Text>
        </Pressable>

        <DetailModal visible={!!selectedSession} onClose={() => setSelectedSession(null)}>
          {selectedSession && <WorkSessionDetail session={selectedSession} clientName={clientName(selectedSession.client_id)} />}
        </DetailModal>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  back: { color: Colors.ink, marginBottom: Spacing.xs },
  title: { ...Typography.title, color: Colors.ink },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  clientName: { ...Typography.title, color: Colors.ink },
  meta: { ...Typography.body, color: Colors.inkMuted },
  note: { ...Typography.body, color: Colors.ink },
  addButton: {
    backgroundColor: Colors.actionBrown,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: Spacing.md,
  },
  addButtonText: { ...Typography.bodyBold, color: Colors.surface },
});
