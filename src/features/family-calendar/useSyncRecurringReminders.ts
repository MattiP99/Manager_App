import { useEffect } from 'react';
import { AppState } from 'react-native';
import { toLocalDateString } from '../../lib/dates';
import { cancelReminderFor, syncReminderFor } from '../notifications/syncReminders';
import { nextOccurrenceDate } from './recurringOccurrences';
import { useAllCalendarEvents } from './useCalendarEvents';
import { useRecurringTemplates } from './useRecurringTemplates';

/** Ricalcola e ri-schedula, alla creazione/modifica di un impegno ricorrente e ad ogni apertura dell'app, il promemoria per la prossima occorrenza futura di ciascun impegno ricorrente attivo. Le occorrenze cancellate con "Salta oggi" non ricevono un promemoria. */
export function useSyncRecurringReminders() {
  const { data: templates } = useRecurringTemplates();
  const { data: events } = useAllCalendarEvents();

  useEffect(() => {
    if (!templates) return;

    const sync = () => {
      const today = toLocalDateString(new Date());
      for (const template of templates) {
        const nextDate = nextOccurrenceDate(template.weekday, today);
        const override = (events ?? []).find(
          (e) => e.recurring_template_id === template.id && e.date === nextDate
        );

        if (override) {
          // This occurrence now has a real calendar_events row (an edit or
          // a skip via "Salta oggi") — that row's own mutation already
          // owns the reminder for it (event:<id>, or none at all if
          // cancelled). The sweep must not also hold a stale
          // template:<id> reminder for the same date.
          cancelReminderFor(`template:${template.id}`);
          continue;
        }

        syncReminderFor(`template:${template.id}`, `Promemoria: ${template.title}`, `${template.person} — domani`, nextDate, template.time);
      }
    };

    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [templates, events]);
}
