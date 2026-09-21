import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { useAllCalendarEvents, useUpsertOccurrenceOverride } from '../../features/family-calendar/useCalendarEvents';
import { expandOccurrences } from '../../features/family-calendar/recurringOccurrences';
import type { Occurrence } from '../../features/family-calendar/recurringOccurrences';
import { FamilyOccurrenceDetail } from '../../features/family-calendar/FamilyOccurrenceDetail';
import { DetailModal } from '../../components/DetailModal';
import { GRADIENT_COLORS, GRADIENT_LOCATIONS } from '../../components/AppShell';
import { formatDayLabel } from '../../features/calendar/calendarGrid';
import { FAMILY_CATEGORIES, FAMILY_CATEGORY_COLORS } from '../../features/family-calendar/constants';
import { toShortTime } from '../../lib/dates';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

export default function FamilyDayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: templates } = useRecurringTemplates();
  const { data: events } = useAllCalendarEvents();
  const skipOccurrence = useUpsertOccurrenceOverride();
  const [selectedOccurrence, setSelectedOccurrence] = useState<Occurrence | null>(null);

  const occurrences = expandOccurrences(templates ?? [], events ?? [], { start: date, end: date });
  const categoryLabel = (value: string) => FAMILY_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  const handleSkip = (occurrence: Occurrence) => {
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
    <LinearGradient colors={GRADIENT_COLORS} locations={GRADIENT_LOCATIONS} style={styles.fill}>
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
              <Pressable style={styles.rowMain} onPress={() => setSelectedOccurrence(item)}>
                <View style={styles.rowTitleRow}>
                  <View style={[styles.categoryDot, { backgroundColor: FAMILY_CATEGORY_COLORS[item.category] }]} />
                  <Text style={styles.rowTitle}>{item.title} — {item.person}</Text>
                </View>
                <Text style={styles.rowMeta}>
                  {categoryLabel(item.category)}
                  {item.start_time && item.end_time ? ` · ${toShortTime(item.start_time)}–${toShortTime(item.end_time)}` : ''}
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

        <Pressable style={styles.addButton} onPress={() => router.push({ pathname: '/add-family-event', params: { date } })}>
          <Text style={styles.addButtonText}>+ Evento</Text>
        </Pressable>

        <DetailModal visible={!!selectedOccurrence} onClose={() => setSelectedOccurrence(null)}>
          {selectedOccurrence && <FamilyOccurrenceDetail occurrence={selectedOccurrence} />}
        </DetailModal>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.sm },
  back: { color: Colors.ink, marginBottom: Spacing.xs },
  title: { ...Typography.title, color: Colors.ink },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  rowMain: { flex: 1 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { ...Typography.bodyBold, color: Colors.ink },
  rowMeta: { ...Typography.small, color: Colors.inkMuted },
  skipLink: { color: Colors.error, marginLeft: Spacing.sm },
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
