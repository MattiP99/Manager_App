import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { CalendarView } from '../../components/CalendarView';
import type { CalendarViewMode } from '../../features/calendar/calendarGrid';
import { useFullWidthContent } from '../../components/AppShell';
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
import { addDays, formatCompactHour, toLocalDateString, toShortTime } from '../../lib/dates';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

type CalendarSection = 'lavoro' | 'francesca';

// Giorno/Settimana sono sempre "spaziosi" ora, su qualunque piattaforma
// (vedi CalendarView: boost di larghezza/altezza su desktop, impilamento
// verticale/riempimento pagina su mobile) — i chip al loro interno
// scalano di conseguenza. Solo Mese resta compatto ovunque.
function isBigChip(view: CalendarViewMode): boolean {
  return view !== 'month';
}

// Fuori dalla vista "big" (solo Mese) lo spazio è stretto: niente
// "HH:MM–HH:MM" completo, solo l'essenziale (es. "8-13", "8:30-11:30").
function formatChipTimeRange(start: string, end: string, big: boolean): string {
  if (big) return `${toShortTime(start)}–${toShortTime(end)}`;
  return `${formatCompactHour(toShortTime(start))}-${formatCompactHour(toShortTime(end))}`;
}

function WorkChip({ session, clientName, onPress, big }: { session: WorkSessionStatus; clientName: string; onPress: () => void; big: boolean }) {
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
      <View style={styles.chipTimeRow}>
        <View style={[styles.chipDot, big && styles.chipDotBig, { backgroundColor: Colors.accent }]} />
        {session.start_time && session.end_time && (
          <Text style={[styles.chipTime, big && styles.chipTimeBig]} numberOfLines={1}>
            {formatChipTimeRange(session.start_time, session.end_time, big)}
          </Text>
        )}
      </View>
      <Text style={[styles.chipName, big && styles.chipNameBig]} numberOfLines={1}>
        {clientName}
      </Text>
    </Pressable>
  );
}

function FamilyChip({ occurrence, onPress, big }: { occurrence: Occurrence; onPress: () => void; big: boolean }) {
  return (
    <Pressable
      style={styles.chip}
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      <View style={styles.chipTimeRow}>
        <View style={[styles.chipDot, big && styles.chipDotBig, { backgroundColor: FAMILY_CATEGORY_COLORS[occurrence.category] }]} />
        {occurrence.start_time && occurrence.end_time && (
          <Text style={[styles.chipTime, big && styles.chipTimeBig]} numberOfLines={1}>
            {formatChipTimeRange(occurrence.start_time, occurrence.end_time, big)}
          </Text>
        )}
      </View>
      <Text style={[styles.chipName, big && styles.chipNameBig]} numberOfLines={1}>
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
  useFullWidthContent();
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
          renderDay={(date, meta) => (
            <DayHalves
              items={sessionsByDate.get(date) ?? []}
              renderChip={(s) => (
                <WorkChip
                  key={s.id}
                  session={s}
                  clientName={clientName(s.client_id)}
                  onPress={() => setSelectedSession(s)}
                  big={isBigChip(meta.view)}
                />
              )}
            />
          )}
          onDayPress={(date) => router.push(`/day/${date}`)}
        />
      ) : (
        <CalendarView
          key="francesca"
          initialView="week"
          renderDay={(date, meta) => (
            <DayHalves
              items={occurrencesByDate.get(date) ?? []}
              renderChip={(o) => (
                <FamilyChip key={o.id} occurrence={o} onPress={() => setSelectedOccurrence(o)} big={isBigChip(meta.view)} />
              )}
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
  // Orario e nome su righe separate (non più una singola riga troncata)
  // così entrambi restano leggibili invece di tagliarsi a vicenda in uno
  // spazio stretto. Il font mobile (non "big") è ridotto di un punto
  // rispetto a prima per compensare lo spazio verticale in più che due
  // righe per chip richiedono su una cella piccola.
  chip: { gap: 1 },
  chipTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipDotBig: { width: 10, height: 10, borderRadius: 5 },
  chipTime: { fontSize: 7, color: Colors.inkMuted, flexShrink: 1 },
  chipTimeBig: { fontSize: 13 },
  chipName: { fontSize: 9, color: Colors.ink, flexShrink: 1 },
  chipNameBig: { fontSize: 15 },
});
