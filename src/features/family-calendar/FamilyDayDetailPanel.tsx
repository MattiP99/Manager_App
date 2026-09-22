import { useState } from 'react';
import { Text, Pressable, StyleSheet, View, ScrollView } from 'react-native';
import { useRecurringTemplates } from './useRecurringTemplates';
import { useAllCalendarEvents, useUpsertOccurrenceOverride } from './useCalendarEvents';
import { expandOccurrences } from './recurringOccurrences';
import type { Occurrence } from './recurringOccurrences';
import { FamilyOccurrenceDetail } from './FamilyOccurrenceDetail';
import { AddFamilyEventForm } from './AddFamilyEventForm';
import { DetailModal } from '../../components/DetailModal';
import { formatDayLabel } from '../calendar/calendarGrid';
import { FAMILY_CATEGORIES, FAMILY_CATEGORY_COLORS } from './constants';
import { toShortTime } from '../../lib/dates';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface FamilyDayDetailPanelProps {
  date: string;
}

/** Contenuto del foglio "Riepilogo giornata" (Calendario Francesca) — guscio (DetailModal, chiamato da index.tsx) e contenuto separati, stesso principio di DayDetailPanel/NoteSectionDetail. Sostituisce l'ex pagina a tutto schermo family-day/[date].tsx. Il form "+ Evento" si apre come pannello laterale (variant="side") sopra questo foglio già aperto — stessa gerarchia a livelli di Pagamenti. */
export function FamilyDayDetailPanel({ date }: FamilyDayDetailPanelProps) {
  const { data: templates } = useRecurringTemplates();
  const { data: events } = useAllCalendarEvents();
  const skipOccurrence = useUpsertOccurrenceOverride();
  const [selectedOccurrence, setSelectedOccurrence] = useState<Occurrence | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);

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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{formatDayLabel(date)}</Text>

      {occurrences.length === 0 && <Text style={styles.empty}>Nessun impegno in questo giorno.</Text>}
      {occurrences.map((item) => (
        <View key={item.id} style={styles.row}>
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
      ))}

      <Pressable style={styles.addButton} onPress={() => setAddingEvent(true)}>
        <Text style={styles.addButtonText}>+ Evento</Text>
      </Pressable>

      <DetailModal visible={!!selectedOccurrence} onClose={() => setSelectedOccurrence(null)}>
        {selectedOccurrence && <FamilyOccurrenceDetail occurrence={selectedOccurrence} />}
      </DetailModal>

      <DetailModal visible={addingEvent} onClose={() => setAddingEvent(false)} variant="side">
        <AddFamilyEventForm preselectedDate={date} onSaved={() => setAddingEvent(false)} />
      </DetailModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { gap: Spacing.sm },
  title: { ...Typography.title, color: Colors.ink },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  rowMain: { flex: 1 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { ...Typography.bodyBold, color: Colors.ink },
  rowMeta: { ...Typography.small, color: Colors.inkMuted },
  skipLink: { ...Typography.body, color: Colors.error, marginLeft: Spacing.sm },
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
