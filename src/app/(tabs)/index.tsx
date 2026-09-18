import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { CalendarView } from '../../components/CalendarView';
import { useAllWorkSessionsStatus } from '../../features/work-sessions/useWorkSessions';

interface DayStatus {
  hasPaid: boolean;
  hasUnpaid: boolean;
}

function DayStatusIndicator({ hasPaid, hasUnpaid }: DayStatus) {
  if (!hasPaid && !hasUnpaid) return null;
  if (hasPaid && hasUnpaid) {
    return (
      <View style={styles.statusIndicator}>
        <View style={[styles.statusHalf, { backgroundColor: '#16a34a' }]} />
        <View style={[styles.statusHalf, { backgroundColor: '#dc2626' }]} />
      </View>
    );
  }
  return <View style={[styles.statusIndicator, { backgroundColor: hasPaid ? '#16a34a' : '#dc2626' }]} />;
}

export default function CalendarioScreen() {
  const { data: sessions } = useAllWorkSessionsStatus();

  const statusByDate = useMemo(() => {
    const map = new Map<string, DayStatus>();
    for (const s of sessions ?? []) {
      const entry = map.get(s.date) ?? { hasPaid: false, hasUnpaid: false };
      if (s.status === 'paid') entry.hasPaid = true;
      else entry.hasUnpaid = true;
      map.set(s.date, entry);
    }
    return map;
  }, [sessions]);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Calendario Lavoro</Text>
      <CalendarView
        initialView="week"
        renderDay={(date) => {
          const status = statusByDate.get(date);
          return <DayStatusIndicator hasPaid={status?.hasPaid ?? false} hasUnpaid={status?.hasUnpaid ?? false} />;
        }}
        onDayPress={(date) => router.push(`/day/${date}`)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  statusIndicator: { flex: 1, minHeight: 16, borderRadius: 4, marginTop: 2, overflow: 'hidden' },
  statusHalf: { flex: 1 },
});
