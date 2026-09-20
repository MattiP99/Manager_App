import { expandOccurrences, nextOccurrenceDate, RecurringTemplate, CalendarEvent } from './recurringOccurrences';

function template(overrides: Partial<RecurringTemplate>): RecurringTemplate {
  return {
    id: 't1',
    title: 'Piscina',
    category: 'piscina',
    person: 'Francesca',
    weekday: 2, // martedì (2026-09-01 è martedì)
    start_time: '17:00',
    end_time: '17:30',
    note: null,
    ...overrides,
  };
}

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'e1',
    recurring_template_id: null,
    title: 'Evento',
    category: 'altro',
    person: 'Francesca',
    date: '2026-09-01',
    start_time: null,
    end_time: null,
    note: null,
    is_cancelled: false,
    ...overrides,
  };
}

describe('expandOccurrences', () => {
  it('generates a virtual occurrence for every date in range matching the weekday', () => {
    const occurrences = expandOccurrences(
      [template({ weekday: 2 })],
      [],
      { start: '2026-09-01', end: '2026-09-15' }
    );
    expect(occurrences.map((o) => o.date)).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
    expect(occurrences.every((o) => o.isVirtual)).toBe(true);
    expect(occurrences.every((o) => o.recurringTemplateId === 't1')).toBe(true);
  });

  it('a single exception overrides the fields of one occurrence without affecting others', () => {
    const occurrences = expandOccurrences(
      [template({ weekday: 2 })],
      [event({ id: 'override1', recurring_template_id: 't1', date: '2026-09-08', title: 'Piscina (orario speciale)', start_time: '19:00', end_time: '19:30' })],
      { start: '2026-09-01', end: '2026-09-15' }
    );
    const overridden = occurrences.find((o) => o.date === '2026-09-08')!;
    expect(overridden.title).toBe('Piscina (orario speciale)');
    expect(overridden.start_time).toBe('19:00');
    expect(overridden.end_time).toBe('19:30');
    expect(overridden.isVirtual).toBe(false);
    expect(overridden.id).toBe('override1');

    const untouched = occurrences.find((o) => o.date === '2026-09-01')!;
    expect(untouched.title).toBe('Piscina');
    expect(untouched.isVirtual).toBe(true);
  });

  it('a cancelled single occurrence is excluded entirely, other occurrences of the same template remain', () => {
    const occurrences = expandOccurrences(
      [template({ weekday: 2 })],
      [event({ id: 'cancel1', recurring_template_id: 't1', date: '2026-09-08', is_cancelled: true })],
      { start: '2026-09-01', end: '2026-09-15' }
    );
    expect(occurrences.map((o) => o.date)).toEqual(['2026-09-01', '2026-09-15']);
  });

  it('a manual event coexists with generated occurrences from a different template', () => {
    const occurrences = expandOccurrences(
      [template({ id: 't1', weekday: 2 })],
      [event({ id: 'manual1', recurring_template_id: null, date: '2026-09-08', title: 'Visita medica' })],
      { start: '2026-09-01', end: '2026-09-08' }
    );
    expect(occurrences).toHaveLength(3);
    const manual = occurrences.find((o) => o.id === 'manual1')!;
    expect(manual.recurringTemplateId).toBeNull();
    expect(manual.isVirtual).toBe(false);
    expect(manual.title).toBe('Visita medica');
  });

  it('a cancelled manual event is excluded', () => {
    const occurrences = expandOccurrences(
      [],
      [event({ id: 'manual1', date: '2026-09-08', is_cancelled: true })],
      { start: '2026-09-01', end: '2026-09-15' }
    );
    expect(occurrences).toEqual([]);
  });

  it('sorts results by date then by start time', () => {
    const occurrences = expandOccurrences(
      [],
      [
        event({ id: 'e-late', date: '2026-09-08', start_time: '18:00', end_time: '18:30' }),
        event({ id: 'e-early', date: '2026-09-08', start_time: '09:00', end_time: '09:30' }),
        event({ id: 'e-prev-day', date: '2026-09-01', start_time: '10:00', end_time: '10:30' }),
      ],
      { start: '2026-09-01', end: '2026-09-15' }
    );
    expect(occurrences.map((o) => o.id)).toEqual(['e-prev-day', 'e-early', 'e-late']);
  });

  it('excludes events and template occurrences entirely outside the range', () => {
    const occurrences = expandOccurrences(
      [template({ weekday: 2 })],
      [event({ id: 'out-of-range', date: '2026-10-01' })],
      { start: '2026-09-01', end: '2026-09-08' }
    );
    expect(occurrences.some((o) => o.id === 'out-of-range')).toBe(false);
    expect(occurrences.every((o) => o.date <= '2026-09-08')).toBe(true);
  });
});

describe('nextOccurrenceDate', () => {
  it('returns the same date when it already matches the weekday', () => {
    expect(nextOccurrenceDate(2, '2026-09-01')).toBe('2026-09-01');
  });

  it('returns the next matching date within the following week', () => {
    expect(nextOccurrenceDate(2, '2026-09-02')).toBe('2026-09-08');
  });

  it('wraps correctly across a month boundary', () => {
    expect(nextOccurrenceDate(2, '2026-09-30')).toBe('2026-10-06');
  });

  it('wraps correctly across a year boundary', () => {
    expect(nextOccurrenceDate(2, '2026-12-30')).toBe('2027-01-05');
  });
});
