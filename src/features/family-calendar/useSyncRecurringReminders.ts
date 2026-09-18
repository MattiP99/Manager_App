import { useEffect } from 'react';
import { AppState } from 'react-native';
import { toLocalDateString } from '../../lib/dates';
import { syncReminderFor } from '../notifications/syncReminders';
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
        if (override?.is_cancelled) continue;

        const title = override?.title ?? template.title;
        const person = override?.person ?? template.person;
        const time = override?.time ?? template.time;
        syncReminderFor(`template:${template.id}`, `Promemoria: ${title}`, `${person} — domani`, nextDate, time);
      }
    };

    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [templates, events]);
}
