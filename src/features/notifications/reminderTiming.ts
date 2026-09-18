import { parseLocalDateString } from '../../lib/dates';

/** Orario del promemoria: le 20:00 locali del giorno prima della data evento. L'orario dell'evento stesso non è usato (promemoria a orario fisso, per design). */
export function reminderDateTime(eventDateStr: string, _eventTimeStr: string | null): Date {
  const eventDate = parseLocalDateString(eventDateStr);
  const reminderDay = new Date(eventDate);
  reminderDay.setDate(reminderDay.getDate() - 1);
  reminderDay.setHours(20, 0, 0, 0);
  return reminderDay;
}

export function isFutureReminder(reminderDate: Date, now: Date = new Date()): boolean {
  return reminderDate.getTime() > now.getTime();
}
