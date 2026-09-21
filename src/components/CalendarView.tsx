import { useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import {
  CalendarDay,
  CalendarViewMode,
  formatPeriodLabel,
  getDayView,
  getMonthGridDays,
  getWeekDays,
  ITALIAN_WEEKDAYS_SHORT,
  shiftAnchorDate,
  weekdayShortLabel,
} from '../features/calendar/calendarGrid';
import { parseLocalDateString, toLocalDateString } from '../lib/dates';
import { isWideLayout } from '../lib/layout';
import { Colors, Radii, Typography } from '../lib/theme';

const VIEW_LABELS: Record<CalendarViewMode, string> = { day: 'Giorno', week: 'Settimana', month: 'Mese' };

export interface CalendarViewProps {
  initialView?: CalendarViewMode;
  renderDay: (date: string, meta: { inCurrentPeriod: boolean; view: CalendarViewMode }) => ReactNode;
  onDayPress: (date: string) => void;
}

function getDaysForView(view: CalendarViewMode, anchorDate: string): CalendarDay[] {
  if (view === 'day') return getDayView(anchorDate);
  if (view === 'week') return getWeekDays(anchorDate);
  return getMonthGridDays(anchorDate);
}

function chunkIntoWeeks(days: CalendarDay[]): CalendarDay[][] {
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function CalendarView({ initialView = 'week', renderDay, onDayPress }: CalendarViewProps) {
  const [view, setView] = useState<CalendarViewMode>(initialView);
  const [anchorDate, setAnchorDate] = useState(() => toLocalDateString(new Date()));
  // "web" da solo non basta: un browser su telefono riporta comunque
  // Platform.OS === 'web'. Il trattamento "grande" è pensato per un
  // layout desktop largo, quindi serve anche la larghezza reale della
  // finestra — stessa soglia già usata da AppShell per sidebar/tab bar.
  const { width, height } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && isWideLayout(width);

  const days = getDaysForView(view, anchorDate);
  const periodLabel = formatPeriodLabel(view, anchorDate, days);

  // Su mobile, Settimana non è più una riga di 7 celle strette ma 7 righe
  // impilate verticalmente (una per giorno), ciascuna più grande — la
  // label del giorno della settimana sotto usa già il font "grande"
  // incondizionatamente perché Giorno/Settimana sono sempre spaziosi ora
  // (boost desktop esistente, oppure impilamento/riempimento pagina qui).
  const stackedWeek = view === 'week' && !isWideWeb;
  const dayRows = stackedWeek ? days.map((d) => [d]) : chunkIntoWeeks(days);

  // Stima grezza dello spazio occupato da titolo/toggle/header sopra la
  // griglia sulla stessa pagina, più un margine per il padding attorno
  // alla cella stessa (vedi dayCellDayMobile) — non misurabile con
  // precisione senza layout imperativo in questo ambiente, va verificata
  // a occhio.
  const dayMobileMinHeight = Math.max(260, height - 300);

  const cellSizeStyle = view === 'month'
    ? isWideWeb ? styles.dayCellMonthWeb : undefined
    : isWideWeb
      ? styles.dayCellDayWeekWeb
      : view === 'day'
        ? [styles.dayCellDayMobile, { minHeight: dayMobileMinHeight }]
        : styles.dayCellWeekStackedMobile;

  const dayNumberStyle = view === 'month'
    ? isWideWeb ? styles.dayNumberMonthWeb : undefined
    : styles.dayNumberDayWeekWeb;

  return (
    <View style={styles.container}>
      <View style={styles.modeRow}>
        {(['day', 'week', 'month'] as CalendarViewMode[]).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.modeButton, view === mode && styles.modeButtonActive]}
            onPress={() => setView(mode)}
          >
            <Text style={view === mode ? styles.modeTextActive : styles.modeText}>{VIEW_LABELS[mode]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.navRow}>
        <Pressable style={styles.navButton} onPress={() => setAnchorDate(shiftAnchorDate(anchorDate, view, -1))}>
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.periodLabel}>{periodLabel}</Text>
        <Pressable style={styles.navButton} onPress={() => setAnchorDate(shiftAnchorDate(anchorDate, view, 1))}>
          <Text style={styles.navButtonText}>›</Text>
        </Pressable>
      </View>

      {view === 'month' && (
        <View style={styles.weekdayHeaderRow}>
          {ITALIAN_WEEKDAYS_SHORT.map((label) => (
            <Text key={label} style={styles.weekdayHeaderText}>{label}</Text>
          ))}
        </View>
      )}

      {dayRows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.weekRow}>
          {row.map((day) => (
            <Pressable
              key={day.date}
              style={[styles.dayCell, !day.inCurrentPeriod && styles.dayCellDimmed, cellSizeStyle]}
              onPress={() => onDayPress(day.date)}
            >
              {view !== 'month' && (
                <Text style={[styles.weekdayLabel, styles.weekdayLabelWeb]}>{weekdayShortLabel(day.date)}</Text>
              )}
              <Text style={[styles.dayNumber, dayNumberStyle]}>{parseLocalDateString(day.date).getDate()}</Text>
              {renderDay(day.date, { inCurrentPeriod: day.inCurrentPeriod, view })}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: 8,
    alignItems: 'center',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  modeButtonActive: { borderColor: Colors.accent },
  modeText: { ...Typography.body, color: Colors.inkMuted },
  modeTextActive: { ...Typography.bodyBold, color: Colors.ink },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { padding: 8, minWidth: 36, alignItems: 'center' },
  navButtonText: { fontSize: 20, fontWeight: '600', color: Colors.ink },
  periodLabel: { ...Typography.bodyBold, color: Colors.ink },
  weekdayHeaderRow: { flexDirection: 'row', gap: 4 },
  weekdayHeaderText: { flex: 1, textAlign: 'center', ...Typography.caption, color: Colors.inkMuted },
  weekRow: { flexDirection: 'row', gap: 4 },
  dayCell: {
    flex: 1,
    minHeight: 72,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.surface,
    padding: 4,
  },
  dayCellDimmed: { opacity: 0.4 },
  // Solo web: su Giorno/Settimana le celle diventano molto più alte per
  // "scendere meglio nella pagina" su schermi larghi; su Mese la crescita
  // resta modesta (stesso layout a griglia, meno spazio verticale per cella).
  // La larghezza segue senza stile dedicato: il contenitore del calendario
  // (vedi useFullWidthContent in AppShell) diventa già più largo su web.
  dayCellDayWeekWeb: { minHeight: 72 * 7 },
  dayCellMonthWeb: { minHeight: 72 * 1.5 },
  // Giorno su mobile: la cella non riempie più il contenitore a filo,
  // resta un po' di padding visibile ai lati e sopra/sotto.
  dayCellDayMobile: { marginHorizontal: 12, marginVertical: 8 },
  // Settimana su mobile: 7 celle impilate verticalmente invece che una riga
  // stretta di 7 colonne — ciascuna più grande di prima, niente boost
  // dinamico basato sulla finestra come per Giorno (qui il contenuto è già
  // ripartito su 7 righe, non serve riempire l'intera pagina per riga).
  dayCellWeekStackedMobile: { minHeight: 180 },
  weekdayLabel: { fontSize: 10, color: Colors.inkMuted, textAlign: 'center' },
  weekdayLabelWeb: { fontSize: 16 },
  dayNumber: { fontSize: 13, fontWeight: '600', textAlign: 'center', color: Colors.ink },
  dayNumberDayWeekWeb: { fontSize: 26 },
  dayNumberMonthWeb: { fontSize: 16 },
});
