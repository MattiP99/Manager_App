import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { CalendarView } from '../../components/CalendarView';
import { useAllWorkSessionsStatus } from '../../features/work-sessions/useWorkSessions';
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { useAllCalendarEvents } from '../../features/family-calendar/useCalendarEvents';
import { expandOccurrences } from '../../features/family-calendar/recurringOccurrences';
import { addDays, toLocalDateString } from '../../lib/dates';

type CalendarSection = 'lavoro' | 'francesca';

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

function FamilyDayIndicator({ count }: { count: number }) {
  if (count === 0) return null;
  return <View style={styles.familyDot} />;
}

export default function CalendarioScreen() {
  const [section, setSection] = useState<CalendarSection>('lavoro');

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

  const { data: templates } = useRecurringTemplates();
  const { data: events } = useAllCalendarEvents();
  const occurrenceCountByDate = useMemo(() => {
    const today = toLocalDateString(new Date());
    const range = { start: addDays(today, -90), end: addDays(today, 365) };
    const occurrences = expandOccurrences(templates ?? [], events ?? [], range);
    const map = new Map<string, number>();
    for (const o of occurrences) {
      map.set(o.date, (map.get(o.date) ?? 0) + 1);
    }
    return map;
  }, [templates, events]);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Calendario</Text>

      <View style={styles.sectionToggle}>
        <Pressable
          style={[styles.sectionButton, section === 'lavoro' && styles.sectionButtonActive]}
          onPress={() => setSection('lavoro')}
        >
          <Text style={section === 'lavoro' ? styles.sectionTextActive : styles.sectionText}>Lavoro</Text>
        </Pressable>
        <Pressable
          style={[styles.sectionButton, section === 'francesca' && styles.sectionButtonActive]}
          onPress={() => setSection('francesca')}
        >
          <Text style={section === 'francesca' ? styles.sectionTextActive : styles.sectionText}>Francesca</Text>
        </Pressable>
      </View>

      {section === 'lavoro' ? (
        <CalendarView
          key="lavoro"
          initialView="week"
          renderDay={(date) => {
            const status = statusByDate.get(date);
            return <DayStatusIndicator hasPaid={status?.hasPaid ?? false} hasUnpaid={status?.hasUnpaid ?? false} />;
          }}
          onDayPress={(date) => router.push(`/day/${date}`)}
        />
      ) : (
        <CalendarView
          key="francesca"
          initialView="week"
          renderDay={(date) => <FamilyDayIndicator count={occurrenceCountByDate.get(date) ?? 0} />}
          onDayPress={(date) => router.push(`/family-day/${date}`)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  sectionToggle: { flexDirection: 'row', gap: 8 },
  sectionButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, alignItems: 'center' },
  sectionButtonActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  sectionText: { color: '#374151' },
  sectionTextActive: { color: '#2563eb', fontWeight: '600' },
  statusIndicator: { flex: 1, minHeight: 16, borderRadius: 4, marginTop: 2, overflow: 'hidden' },
  statusHalf: { flex: 1 },
  familyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb', alignSelf: 'center', marginTop: 4 },
});
