import * as Notifications from 'expo-notifications';
import { ensureNotificationPermission } from './permissions';
import { clearStoredReminder, getStoredReminder, setStoredReminder } from './notificationStore';
import { isFutureReminder, reminderDateTime } from './reminderTiming';

async function cancelStored(key: string): Promise<void> {
  const stored = await getStoredReminder(key);
  if (!stored) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(stored.notificationId);
  } catch {
    // già scaduta/consumata — nessun problema, procediamo comunque a ripulire lo store locale.
  }
  await clearStoredReminder(key);
}

/** Cancella un eventuale promemoria precedente per questa chiave e ne schedula uno nuovo per (giorno prima, 20:00), se il permesso è concesso e l'orario è nel futuro. Silenzioso su qualunque fallimento — l'app resta funzionante senza promemoria. */
export async function syncReminderFor(
  key: string,
  title: string,
  body: string,
  eventDate: string,
  eventTime: string | null
): Promise<void> {
  await cancelStored(key);

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const when = reminderDateTime(eventDate, eventTime);
  if (!isFutureReminder(when)) return;

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
    await setStoredReminder(key, { notificationId, forDate: eventDate });
  } catch {
    // piattaforma non supportata o altro fallimento di scheduling — nessuna eccezione propagata.
  }
}

export async function cancelReminderFor(key: string): Promise<void> {
  await cancelStored(key);
}
