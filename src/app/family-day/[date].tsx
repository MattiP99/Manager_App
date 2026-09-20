import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { useAllCalendarEvents, useUpsertOccurrenceOverride } from '../../features/family-calendar/useCalendarEvents';
import { expandOccurrences } from '../../features/family-calendar/recurringOccurrences';
import { formatDayLabel } from '../../features/calendar/calendarGrid';
import { FAMILY_CATEGORIES } from '../../features/family-calendar/constants';

export default function FamilyDayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: templates } = useRecurringTemplates();
  const { data: events } = useAllCalendarEvents();
  const skipOccurrence = useUpsertOccurrenceOverride();

  const occurrences = expandOccurrences(templates ?? [], events ?? [], { start: date, end: date });
  const categoryLabel = (value: string) => FAMILY_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  const handleSkip = (occurrence: (typeof occurrences)[number]) => {
    if (!occurrence.recurringTemplateId) return;
    skipOccurrence.mutate({
      recurringTemplateId: occurrence.recurringTemplateId,
      date: occurrence.date,
      title: occurrence.title,
      category: occurrence.category,
      person: occurrence.person,
      startTime: occurrence.start_time ?? undefined,
      endTime: occurrence.end_time ?? undefined,
      note: occurrence.note ?? undefined,
      isCancelled: true,
    });
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Indietro</Text>
      </Pressable>
      <Text style={styles.title}>{formatDayLabel(date)}</Text>

      <FlatList
        style={{ flex: 1 }}
        data={occurrences}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.rowMain}
              onPress={() =>
                router.push(
                  item.recurringTemplateId
                    ? { pathname: '/edit-family-event', params: { recurringTemplateId: item.recurringTemplateId, date: item.date } }
                    : { pathname: '/edit-family-event', params: { id: item.id } }
                )
              }
            >
              <Text style={styles.rowTitle}>{item.title} — {item.person}</Text>
              <Text style={styles.rowMeta}>
                {categoryLabel(item.category)}
                {item.start_time && item.end_time ? ` · ${item.start_time}–${item.end_time}` : ''}
              </Text>
            </Pressable>
            {item.recurringTemplateId && (
              <Pressable onPress={() => handleSkip(item)} disabled={skipOccurrence.isPending}>
                <Text style={styles.skipLink}>Salta oggi</Text>
              </Pressable>
            )}
          </View>
        )}
        ListEmptyComponent={<Text>Nessun impegno in questo giorno.</Text>}
      />

      <Pressable
        style={styles.addButton}
        onPress={() => router.push({ pathname: '/add-family-event', params: { date } })}
      >
        <Text style={styles.addButtonText}>+ Evento</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  back: { color: '#2563eb', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowMain: { flex: 1 },
  rowTitle: { fontWeight: '600' },
  rowMeta: { color: '#6b7280' },
  skipLink: { color: '#dc2626', marginLeft: 8 },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  addButtonText: { color: 'white', fontWeight: '600' },
});
