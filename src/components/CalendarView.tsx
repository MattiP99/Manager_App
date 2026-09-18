import { useState } from 'react';
import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  CalendarDay,
  CalendarViewMode,
  getDayView,
  getMonthGridDays,
  getWeekDays,
  shiftAnchorDate,
} from '../features/calendar/calendarGrid';
import { parseLocalDateString, toLocalDateString } from '../lib/dates';

const ITALIAN_MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
const ITALIAN_WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const VIEW_LABELS: Record<CalendarViewMode, string> = { day: 'Giorno', week: 'Settimana', month: 'Mese' };

export interface CalendarViewProps {
  initialView?: CalendarViewMode;
  renderDay: (date: string, meta: { inCurrentPeriod: boolean }) => ReactNode;
  onDayPress: (date: string) => void;
}

function getDaysForView(view: CalendarViewMode, anchorDate: string): CalendarDay[] {
  if (view === 'day') return getDayView(anchorDate);
  if (view === 'week') return getWeekDays(anchorDate);
  return getMonthGridDays(anchorDate);
}

function formatPeriodLabel(view: CalendarViewMode, days: CalendarDay[]): string {
  const first = parseLocalDateString(days[0].date);
  const last = parseLocalDateString(days[days.length - 1].date);

  if (view === 'day') {
    return `${first.getDate()} ${ITALIAN_MONTHS[first.getMonth()]} ${first.getFullYear()}`;
  }
  if (view === 'month') {
    const current = days.find((d) => d.inCurrentPeriod)!;
    const currentDate = parseLocalDateString(current.date);
    return `${ITALIAN_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} - ${last.getDate()} ${ITALIAN_MONTHS[first.getMonth()]} ${first.getFullYear()}`;
  }
  return `${first.getDate()} ${ITALIAN_MONTHS[first.getMonth()]} - ${last.getDate()} ${ITALIAN_MONTHS[last.getMonth()]} ${last.getFullYear()}`;
}

function weekdayShortLabel(dateStr: string): string {
  const jsDay = parseLocalDateString(dateStr).getDay(); // 0=Sun..6=Sat
  return ITALIAN_WEEKDAYS_SHORT[jsDay === 0 ? 6 : jsDay - 1];
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

  const days = getDaysForView(view, anchorDate);
  const periodLabel = formatPeriodLabel(view, days);

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

      {chunkIntoWeeks(days).map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((day) => (
            <Pressable
              key={day.date}
              style={[styles.dayCell, !day.inCurrentPeriod && styles.dayCellDimmed]}
              onPress={() => onDayPress(day.date)}
            >
              {view !== 'month' && <Text style={styles.weekdayLabel}>{weekdayShortLabel(day.date)}</Text>}
              <Text style={styles.dayNumber}>{parseLocalDateString(day.date).getDate()}</Text>
              {renderDay(day.date, { inCurrentPeriod: day.inCurrentPeriod })}
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
  modeButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, alignItems: 'center' },
  modeButtonActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  modeText: { color: '#374151' },
  modeTextActive: { color: '#2563eb', fontWeight: '600' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { padding: 8, minWidth: 36, alignItems: 'center' },
  navButtonText: { fontSize: 20, fontWeight: '600' },
  periodLabel: { fontSize: 16, fontWeight: '600' },
  weekdayHeaderRow: { flexDirection: 'row' },
  weekdayHeaderText: { flex: 1, textAlign: 'center', fontSize: 12, color: '#6b7280' },
  weekRow: { flexDirection: 'row', gap: 4 },
  dayCell: { flex: 1, minHeight: 56, borderRadius: 6, borderWidth: 1, borderColor: '#eee', padding: 4, overflow: 'hidden' },
  dayCellDimmed: { opacity: 0.4 },
  weekdayLabel: { fontSize: 10, color: '#6b7280', textAlign: 'center' },
  dayNumber: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
