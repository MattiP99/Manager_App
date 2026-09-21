import { addDays, parseLocalDateString, toLocalDateString } from '../../lib/dates';

export type CalendarViewMode = 'day' | 'week' | 'month';

export interface CalendarDay {
  date: string;
  inCurrentPeriod: boolean;
}

// Monday-first weekday index: Monday=0 ... Sunday=6 (JS Date.getDay() is Sunday=0..Saturday=6).
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function getDayView(anchorDate: string): CalendarDay[] {
  return [{ date: anchorDate, inCurrentPeriod: true }];
}

export function getWeekDays(anchorDate: string): CalendarDay[] {
  const offsetToMonday = mondayIndex(parseLocalDateString(anchorDate));
  const monday = addDays(anchorDate, -offsetToMonday);
  return Array.from({ length: 7 }, (_, i) => ({ date: addDays(monday, i), inCurrentPeriod: true }));
}

export function getMonthGridDays(anchorDate: string): CalendarDay[] {
  const anchor = parseLocalDateString(anchorDate);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  const firstOfMonth = toLocalDateString(new Date(year, month, 1));
  const gridStart = addDays(firstOfMonth, -mondayIndex(parseLocalDateString(firstOfMonth)));

  const lastOfMonth = toLocalDateString(new Date(year, month + 1, 0));
  const gridEnd = addDays(lastOfMonth, 6 - mondayIndex(parseLocalDateString(lastOfMonth)));

  const days: CalendarDay[] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    days.push({ date: cursor, inCurrentPeriod: parseLocalDateString(cursor).getMonth() === month });
  }
  return days;
}

export function shiftAnchorDate(anchorDate: string, view: CalendarViewMode, direction: 1 | -1): string {
  if (view === 'day') return addDays(anchorDate, direction);
  if (view === 'week') return addDays(anchorDate, direction * 7);

  // month: keep the same day-of-month, clamped into the target month's
  // actual length instead of letting JS roll the date forward when the
  // target month is shorter (the same bug class as a past money-totals
  // bug in this project's payments period filter, since fixed).
  const anchor = parseLocalDateString(anchorDate);
  const day = anchor.getDate();
  const targetMonthFirst = new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  const daysInTargetMonth = new Date(targetMonthFirst.getFullYear(), targetMonthFirst.getMonth() + 1, 0).getDate();
  targetMonthFirst.setDate(Math.min(day, daysInTargetMonth));
  return toLocalDateString(targetMonthFirst);
}

export const ITALIAN_MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
export const ITALIAN_WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export function weekdayShortLabel(dateStr: string): string {
  const jsDay = parseLocalDateString(dateStr).getDay(); // 0=Sun..6=Sat
  return ITALIAN_WEEKDAYS_SHORT[jsDay === 0 ? 6 : jsDay - 1];
}

export function formatDayLabel(dateStr: string): string {
  const d = parseLocalDateString(dateStr);
  return `${d.getDate()} ${ITALIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatPeriodLabel(view: CalendarViewMode, anchorDate: string, days: CalendarDay[]): string {
  if (view === 'day') {
    return formatDayLabel(anchorDate);
  }
  if (view === 'month') {
    const anchor = parseLocalDateString(anchorDate);
    return `${ITALIAN_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }

  // week
  const first = parseLocalDateString(days[0].date);
  const last = parseLocalDateString(days[days.length - 1].date);

  if (first.getFullYear() !== last.getFullYear()) {
    return `${first.getDate()} ${ITALIAN_MONTHS[first.getMonth()]} ${first.getFullYear()} - ${last.getDate()} ${ITALIAN_MONTHS[last.getMonth()]} ${last.getFullYear()}`;
  }
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} - ${last.getDate()} ${ITALIAN_MONTHS[first.getMonth()]} ${first.getFullYear()}`;
  }
  return `${first.getDate()} ${ITALIAN_MONTHS[first.getMonth()]} - ${last.getDate()} ${ITALIAN_MONTHS[last.getMonth()]} ${last.getFullYear()}`;
}
