import { addDays, parseLocalDateString } from '../../lib/dates';

export type FamilyCategory = 'mensa' | 'palestra' | 'cavallo' | 'piscina' | 'teatro' | 'altro';

export interface RecurringTemplate {
  id: string;
  title: string;
  category: FamilyCategory;
  person: string;
  /** Date.getDay() convention: 0 = Domenica ... 6 = Sabato. */
  weekday: number;
  time: string | null;
  note: string | null;
}

export interface CalendarEvent {
  id: string;
  recurring_template_id: string | null;
  title: string;
  category: FamilyCategory;
  person: string;
  date: string;
  time: string | null;
  note: string | null;
  is_cancelled: boolean;
}

export interface Occurrence {
  id: string;
  recurringTemplateId: string | null;
  date: string;
  title: string;
  category: FamilyCategory;
  person: string;
  time: string | null;
  note: string | null;
  /** true se non esiste ancora una riga calendar_events reale per questa occorrenza. */
  isVirtual: boolean;
}

export interface DateRange {
  start: string;
  end: string;
}

export function expandOccurrences(
  templates: RecurringTemplate[],
  events: CalendarEvent[],
  range: DateRange
): Occurrence[] {
  const overridesByKey = new Map<string, CalendarEvent>();
  for (const e of events) {
    if (e.recurring_template_id) {
      overridesByKey.set(`${e.recurring_template_id}|${e.date}`, e);
    }
  }

  const occurrences: Occurrence[] = [];

  for (const template of templates) {
    for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
      if (parseLocalDateString(date).getDay() !== template.weekday) continue;

      const override = overridesByKey.get(`${template.id}|${date}`);
      if (override) {
        if (!override.is_cancelled) {
          occurrences.push({
            id: override.id,
            recurringTemplateId: template.id,
            date,
            title: override.title,
            category: override.category,
            person: override.person,
            time: override.time,
            note: override.note,
            isVirtual: false,
          });
        }
        continue;
      }

      occurrences.push({
        id: `virtual-${template.id}-${date}`,
        recurringTemplateId: template.id,
        date,
        title: template.title,
        category: template.category,
        person: template.person,
        time: template.time,
        note: template.note,
        isVirtual: true,
      });
    }
  }

  for (const e of events) {
    if (e.recurring_template_id) continue;
    if (e.is_cancelled) continue;
    if (e.date < range.start || e.date > range.end) continue;
    occurrences.push({
      id: e.id,
      recurringTemplateId: null,
      date: e.date,
      title: e.title,
      category: e.category,
      person: e.person,
      time: e.time,
      note: e.note,
      isVirtual: false,
    });
  }

  occurrences.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const at = a.time ?? '';
    const bt = b.time ?? '';
    return at < bt ? -1 : at > bt ? 1 : 0;
  });

  return occurrences;
}

/** Prossima data >= from (inclusa) il cui Date.getDay() corrisponde a weekday. */
export function nextOccurrenceDate(weekday: number, from: string): string {
  let date = from;
  for (let i = 0; i < 7; i++) {
    if (parseLocalDateString(date).getDay() === weekday) return date;
    date = addDays(date, 1);
  }
  return date;
}
