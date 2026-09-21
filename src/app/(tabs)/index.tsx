import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { CalendarView } from '../../components/CalendarView';
import { DetailModal } from '../../components/DetailModal';
import { useAllWorkSessionsStatus } from '../../features/work-sessions/useWorkSessions';
import type { WorkSessionStatus } from '../../features/work-sessions/useWorkSessions';
import { WorkSessionDetail } from '../../features/work-sessions/WorkSessionDetail';
import { useClients } from '../../features/clients/useClients';
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { useAllCalendarEvents } from '../../features/family-calendar/useCalendarEvents';
import { expandOccurrences } from '../../features/family-calendar/recurringOccurrences';
import type { Occurrence } from '../../features/family-calendar/recurringOccurrences';
import { FamilyOccurrenceDetail } from '../../features/family-calendar/FamilyOccurrenceDetail';
import { FAMILY_CATEGORY_COLORS } from '../../features/family-calendar/constants';
import { splitByHalfDay } from '../../features/calendar/dayHalves';
import { addDays, toLocalDateString } from '../../lib/dates';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

type CalendarSection = 'lavoro' | 'francesca';

function WorkChip({ session, clientName, onPress }: { session: WorkSessionStatus; clientName: string; onPress: () => void }) {
  return (
    <Pressable
      style={styles.chip}
      onPress={(e) => {
        // Il chip vive dentro la cella-giorno, che ha il proprio Pressable
        // (onDayPress). Su web (react-native-web) i click del DOM
        // continuano a propagare fino al genitore anche tra due Pressable
        // RN annidati — senza stopPropagation, toccare un chip aprirebbe
        // il modale E navigherebbe alla pagina del giorno.
        e.stopPropagation();
        onPress();
      }}
    >
      <View style={[styles.chipDot, { backgroundColor: Colors.accent }]} />
      <Text style={styles.chipText} numberOfLines={1}>
        {session.start_time && session.end_time ? `${session.start_time}–${session.end_time} ` : ''}
        {clientName}
      </Text>
    </Pressable>
  );
}

function FamilyChip({ occurrence, onPress }: { occurrence: Occurrence; onPress: () => void }) {
  return (
    <Pressable
      style={styles.chip}
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      <View style={[styles.chipDot, { backgroundColor: FAMILY_CATEGORY_COLORS[occurrence.category] }]} />
      <Text style={styles.chipText} numberOfLines={1}>
        {occurrence.start_time && occurrence.end_time ? `${occurrence.start_time}–${occurrence.end_time} ` : ''}
        {occurrence.title}
      </Text>
    </Pressable>
  );
}

function DayHalves<T extends { start_time: string | null }>({ items, renderChip }: { items: T[]; renderChip: (item: T) => ReactNode }) {
  const { morning, afternoon } = splitByHalfDay(items);
  return (
    <View style={styles.halves}>
      <View style={[styles.half, { backgroundColor: Colors.morningTint }]}>{morning.map(renderChip)}</View>
      <View style={styles.halfDivider} />
      <View style={[styles.half, { backgroundColor: Colors.afternoonTint }]}>{afternoon.map(renderChip)}</View>
    </View>
  );
}

export default function CalendarioScreen() {
  const [section, setSection] = useState<CalendarSection>('lavoro');
  const [selectedSession, setSelectedSession] = useState<WorkSessionStatus | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<Occurrence | null>(null);

  const { data: sessions } = useAllWorkSessionsStatus();
  const { data: clients } = useClients();
  const clientName = (clientId: string) => clients?.find((c) => c.id === clientId)?.name ?? 'Cliente';

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkSessionStatus[]>();
    for (const s of sessions ?? []) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [sessions]);

  const { data: templates } = useRecurringTemplates();
  const { data: events } = useAllCalendarEvents();
  const occurrencesByDate = useMemo(() => {
    const today = toLocalDateString(new Date());
    const range = { start: addDays(today, -90), end: addDays(today, 365) };
    const occurrences = expandOccurrences(templates ?? [], events ?? [], range);
    const map = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      const list = map.get(o.date) ?? [];
      list.push(o);
      map.set(o.date, list);
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
          renderDay={(date) => (
            <DayHalves
              items={sessionsByDate.get(date) ?? []}
              renderChip={(s) => (
                <WorkChip key={s.id} session={s} clientName={clientName(s.client_id)} onPress={() => setSelectedSession(s)} />
              )}
            />
          )}
          onDayPress={(date) => router.push(`/day/${date}`)}
        />
      ) : (
        <CalendarView
          key="francesca"
          initialView="week"
          renderDay={(date) => (
            <DayHalves
              items={occurrencesByDate.get(date) ?? []}
              renderChip={(o) => <FamilyChip key={o.id} occurrence={o} onPress={() => setSelectedOccurrence(o)} />}
            />
          )}
          onDayPress={(date) => router.push(`/family-day/${date}`)}
        />
      )}

      <DetailModal visible={!!selectedSession} onClose={() => setSelectedSession(null)}>
        {selectedSession && <WorkSessionDetail session={selectedSession} clientName={clientName(selectedSession.client_id)} />}
      </DetailModal>

      <DetailModal visible={!!selectedOccurrence} onClose={() => setSelectedOccurrence(null)}>
        {selectedOccurrence && <FamilyOccurrenceDetail occurrence={selectedOccurrence} />}
      </DetailModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.md },
  title: { ...Typography.title, color: Colors.ink },
  sectionToggle: { flexDirection: 'row', gap: Spacing.sm },
  sectionButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: 10,
    alignItems: 'center',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionButtonActive: { borderColor: Colors.accent },
  sectionText: { ...Typography.body, color: Colors.inkMuted },
  sectionTextActive: { ...Typography.bodyBold, color: Colors.ink },
  halves: { flexGrow: 1, flexBasis: 'auto', gap: 2 },
  half: { flexGrow: 1, flexBasis: 'auto', minHeight: 20, borderRadius: Radii.sm, padding: 2, gap: 2 },
  halfDivider: { height: 1, backgroundColor: Colors.hairline },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 10, color: Colors.ink, flexShrink: 1 },
});
