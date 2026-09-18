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
  // target month is shorter (the same bug class as the fixed
  // dateRangeForPeriod month-end rollover).
  const anchor = parseLocalDateString(anchorDate);
  const day = anchor.getDate();
  const targetMonthFirst = new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  const daysInTargetMonth = new Date(targetMonthFirst.getFullYear(), targetMonthFirst.getMonth() + 1, 0).getDate();
  targetMonthFirst.setDate(Math.min(day, daysInTargetMonth));
  return toLocalDateString(targetMonthFirst);
}
