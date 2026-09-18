# Calendario Lavoro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab Calendario con vista visuale giorno/settimana/mese delle giornate lavorate, con celle colorate pagato/non-pagato (verde/rosso, metà/metà se un giorno ha giornate di più clienti con stati misti), e una schermata di dettaglio giorno da cui registrare una nuova giornata lavorata.

**Architecture:** Un componente condiviso e parametrico `CalendarView` (giorno/settimana/mese, navigazione periodo, callback `renderDay`/`onDayPress`) costruito sopra funzioni pure di calcolo griglia data (`src/features/calendar/calendarGrid.ts`), riusando `work_session_status` (già esistente) per lo stato pagato/non-pagato e `useCreateWorkSession` (già esistente) per la registrazione. Nessuna nuova tabella/migrazione: blocco puramente frontend. `CalendarView` non contiene alcuna logica specifica ai clienti — la colorazione vive nello screen consumer, cosicché il prossimo blocco ("Calendario familiare") possa riusare lo stesso componente con un `renderDay` diverso, come previsto dalla spec.

**Tech Stack:** Stesso stack dei blocchi precedenti — Expo Router, TypeScript, `@supabase/supabase-js` con tipi generati, TanStack Query, Jest. Nessuna nuova dipendenza (niente date-fns/dayjs/librerie di calendario) — la griglia si costruisce con `View`/`Pressable` nativi.

**Spec:** `docs/superpowers/specs/2026-09-17-family-manager-app-design.md` (sezione 4.2 per `work_session_status`, sezione 5 per `CalendarView`)

**Precede questo piano (già completato):** `docs/superpowers/plans/2026-09-17-clienti-pagamenti.md` — questo piano assume che clienti/giornate/pagamenti/FIFO esistano già e funzionino, incluso `useWorkSessionsByClient`/`useCreateWorkSession` in `src/features/work-sessions/useWorkSessions.ts`.

**Decisioni di scope confermate con l'utente (brainstorming leggero):**
- Cella con giornate di più clienti in stati misti: metà cella verde / metà rossa (non un singolo colore aggregato).
- Tap su una cella giorno: naviga a una schermata dedicata `/day/[date]` (pattern analogo a `/client/[id]`), non un pannello inline.
- Vista di default all'apertura del tab: Settimana (non Mese).

## Global Constraints

- Nessuna nuova migrazione/tabella: questo blocco riusa `work_session_status` e `work_sessions` esistenti — è puro frontend.
- Tutta la logica di calcolo data (griglia calendario, spostamento periodo) vive in funzioni pure testabili in `src/features/calendar/calendarGrid.ts`, mai inline nei componenti — stesso principio già applicato a `computeClientSummary`/`dateRangeForPeriod` nel blocco precedente.
- Le date locali passano sempre da `src/lib/dates.ts` (`toLocalDateString`/`parseLocalDateString`/`addDays`), mai da `.toISOString()` o aritmetica `Date` fatta a mano nei componenti — evita la classe di bug UTC-vs-locale e di rollover di fine mese già trovata (e corretta) nel blocco Clienti+Pagamenti.
- Nessuna nuova dipendenza: griglia giorno/settimana/mese costruita con `View`/`Pressable`/`StyleSheet` nativi, coerente con la scelta YAGNI già presa per lo styling.
- `CalendarView` resta puramente parametrico (`renderDay`, `onDayPress`, `initialView`) senza alcuna logica specifica a clienti/pagamenti al suo interno.
- Ogni query con `.order()` su una colonna con possibili pareggi usa un secondo `.order()` di tiebreak (es. `created_at`), come da convenzione già stabilita nel progetto.
- Routing: nuove schermate fuori da `(tabs)/` vivono in `src/app/`, con bottone "Indietro" esplicito (`router.back()`) — il layout root usa `<Slot />` senza Stack navigator, quindi non c'è back automatico nella UI nativa. Rotta dinamica `day/[date].tsx` segue lo stesso pattern di `client/[id].tsx` già esistente.
- Dopo ogni step che tocca file `.ts`/`.tsx`, verificare `npx tsc --noEmit` con la sequenza anti-stale-router-types descritta in `docs/superpowers/PROGRESS.md` (avviare `expo start --web` in background, attendere "Waiting on http://...", forzare un bundle reale con `curl`, poi lanciare `tsc`, poi killare il server) — non fidarsi di un `tsc` lanciato subito dopo l'avvio del server.

---

### Task 1: Utility data locali condivise (`src/lib/dates.ts`)

**Files:**
- Create: `src/lib/dates.ts`
- Create: `src/lib/dates.test.ts`
- Modify: `src/features/payments/computeClientSummary.ts`
- Modify: `src/features/payments/computeClientSummary.test.ts`
- Modify: `src/app/add-work-session.tsx`
- Modify: `src/app/add-payment.tsx`

**Interfaces:**
- Consumes: nulla di nuovo (puro refactor/estrazione)
- Produces: `toLocalDateString(date: Date): string`, `parseLocalDateString(dateStr: string): Date`, `addDays(dateStr: string, days: number): string` da `src/lib/dates.ts` — usate dal Task 2 (`calendarGrid.ts`) e da tutti gli screen esistenti che oggi importano `toLocalDateString` da `computeClientSummary.ts`

`toLocalDateString` oggi vive in `src/features/payments/computeClientSummary.ts` ma è già importata da 3 file diversi (`add-work-session.tsx`, `add-payment.tsx`, il suo stesso test) — un posto un po' fuori luogo per una utility generica. La griglia del calendario (Task 2) ne ha bisogno insieme a due nuove funzioni (`parseLocalDateString`, `addDays`), quindi la consolidiamo in `src/lib/dates.ts` prima di aggiungere altro codice che ne dipende, invece di creare una terza copia della stessa logica sensibile alle date.

- [ ] **Step 1: Scrivi `src/lib/dates.ts`**

```typescript
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDateString(dateStr);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}
```

- [ ] **Step 2: Scrivi `src/lib/dates.test.ts`**

```typescript
import { addDays, parseLocalDateString, toLocalDateString } from './dates';

describe('toLocalDateString', () => {
  const originalTZ = process.env.TZ;

  beforeAll(() => {
    // Rome: UTC+1 in March (DST starts later in the month), so a local
    // time just after midnight is still the previous day in UTC. This is
    // exactly the window where the old `.toISOString().slice(0,10)` bug bit.
    process.env.TZ = 'Europe/Rome';
  });

  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  it('returns the local calendar day, not the UTC day, just after local midnight', () => {
    const localMidnightish = new Date(2027, 2, 15, 0, 30); // 2027-03-15 00:30 local (Rome)
    expect(localMidnightish.toISOString().slice(0, 10)).toBe('2027-03-14');
    expect(toLocalDateString(localMidnightish)).toBe('2027-03-15');
  });

  it('formats a plain midday date as YYYY-MM-DD', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 13, 0))).toBe('2026-01-05');
  });
});

describe('parseLocalDateString', () => {
  it('round-trips with toLocalDateString', () => {
    expect(toLocalDateString(parseLocalDateString('2026-09-18'))).toBe('2026-09-18');
  });

  it('parses into a Date at local midnight, not UTC midnight', () => {
    const parsed = parseLocalDateString('2026-09-18');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8);
    expect(parsed.getDate()).toBe(18);
    expect(parsed.getHours()).toBe(0);
  });
});

describe('addDays', () => {
  it('adds days within the same month', () => {
    expect(addDays('2026-09-01', 5)).toBe('2026-09-06');
  });

  it('rolls over into the next month', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03');
  });

  it('rolls over into the previous month when subtracting', () => {
    expect(addDays('2026-09-02', -5)).toBe('2026-08-28');
  });

  it('handles the February leap-year boundary', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // 2028 is a leap year
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01'); // 2027 is not
  });
});
```

- [ ] **Step 3: Esegui i nuovi test**

Run: `npx jest src/lib/dates.test.ts`
Expected: PASS, 8/8.

- [ ] **Step 4: Aggiorna `src/features/payments/computeClientSummary.ts` per importare da `src/lib/dates.ts` invece di definire `toLocalDateString` localmente**

Sostituisci l'intero contenuto del file con:

```typescript
import { toLocalDateString } from '../../lib/dates';
import type { WorkSession } from '../work-sessions/useWorkSessions';
import type { Payment } from './usePayments';

export interface ClientSummary {
  totalHours: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
}

export function computeClientSummary(sessions: WorkSession[], payments: Payment[]): ClientSummary {
  const totalHours = sessions.reduce((sum, s) => sum + s.hours, 0);
  const totalDue = sessions.reduce((sum, s) => sum + s.amount_due, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  return { totalHours, totalDue, totalPaid, balance: totalDue - totalPaid };
}

export type Period = 'week' | 'month' | 'all';

export function dateRangeForPeriod(period: Period, now = new Date()): { start: string; end: string } | null {
  if (period === 'all') return null;

  const end = toLocalDateString(now);
  const start = new Date(now);
  if (period === 'week') {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(start.getDate() - 30);
  }
  return { start: toLocalDateString(start), end };
}

export function filterByDateRange<T extends { date: string }>(items: T[], range: { start: string; end: string } | null): T[] {
  if (!range) return items;
  return items.filter((item) => item.date >= range.start && item.date <= range.end);
}
```

- [ ] **Step 5: Aggiorna `src/features/payments/computeClientSummary.test.ts` — rimuovi i test di `toLocalDateString` (spostati in `src/lib/dates.test.ts`) e l'import**

Sostituisci l'intero contenuto del file con:

```typescript
import { computeClientSummary, dateRangeForPeriod, filterByDateRange } from './computeClientSummary';
import type { WorkSession } from '../work-sessions/useWorkSessions';
import type { Payment } from './usePayments';

function session(overrides: Partial<WorkSession>): WorkSession {
  return {
    id: 'ws1',
    client_id: 'c1',
    date: '2026-09-01',
    hours: 2,
    rate_snapshot: 10,
    amount_due: 20,
    note: null,
    ...overrides,
  };
}

function payment(overrides: Partial<Payment>): Payment {
  return { id: 'p1', client_id: 'c1', date: '2026-09-02', amount: 20, note: null, ...overrides };
}

describe('computeClientSummary', () => {
  it('sums hours and amount due across sessions', () => {
    const summary = computeClientSummary(
      [session({ hours: 2, amount_due: 20 }), session({ id: 'ws2', hours: 3, amount_due: 30 })],
      []
    );
    expect(summary.totalHours).toBe(5);
    expect(summary.totalDue).toBe(50);
  });

  it('sums payments separately from sessions', () => {
    const summary = computeClientSummary(
      [session({ amount_due: 50 })],
      [payment({ amount: 20 }), payment({ id: 'p2', amount: 10 })]
    );
    expect(summary.totalPaid).toBe(30);
    expect(summary.balance).toBe(20);
  });

  it('returns zeros for no sessions and no payments', () => {
    const summary = computeClientSummary([], []);
    expect(summary).toEqual({ totalHours: 0, totalDue: 0, totalPaid: 0, balance: 0 });
  });

  it('balance can be negative when a client has overpaid', () => {
    const summary = computeClientSummary([session({ amount_due: 20 })], [payment({ amount: 50 })]);
    expect(summary.balance).toBe(-30);
  });
});

describe('dateRangeForPeriod', () => {
  it("returns null for 'all' (pass-through)", () => {
    expect(dateRangeForPeriod('all')).toBeNull();
  });

  it("'week' is a rolling 7-day window ending today", () => {
    const now = new Date(2026, 8, 18); // 2026-09-18
    expect(dateRangeForPeriod('week', now)).toEqual({ start: '2026-09-11', end: '2026-09-18' });
  });

  it("'month' is a rolling 30-day window, not a calendar month", () => {
    const now = new Date(2026, 8, 18); // 2026-09-18
    expect(dateRangeForPeriod('month', now)).toEqual({ start: '2026-08-19', end: '2026-09-18' });
  });

  it.each([
    ['2027-03-31', '2027-03-01'],
    ['2027-03-29', '2027-02-27'],
    ['2027-05-31', '2027-05-01'],
    ['2026-10-31', '2026-10-01'],
  ])('month window for %s starts at %s (no rollover)', (endDate, expectedStart) => {
    const [y, m, d] = endDate.split('-').map(Number);
    const now = new Date(y, m - 1, d);
    expect(dateRangeForPeriod('month', now)).toEqual({ start: expectedStart, end: endDate });
  });
});

describe('filterByDateRange', () => {
  it('returns items unchanged when range is null', () => {
    const items = [session({ date: '2026-01-01' })];
    expect(filterByDateRange(items, null)).toBe(items);
  });

  it('includes items exactly on the start and end boundaries', () => {
    const items = [
      session({ id: 'on-start', date: '2026-09-01' }),
      session({ id: 'on-end', date: '2026-09-08' }),
    ];
    const result = filterByDateRange(items, { start: '2026-09-01', end: '2026-09-08' });
    expect(result.map((i) => i.id)).toEqual(['on-start', 'on-end']);
  });

  it('excludes items one day outside either boundary', () => {
    const items = [
      session({ id: 'before', date: '2026-08-31' }),
      session({ id: 'inside', date: '2026-09-05' }),
      session({ id: 'after', date: '2026-09-09' }),
    ];
    const result = filterByDateRange(items, { start: '2026-09-01', end: '2026-09-08' });
    expect(result.map((i) => i.id)).toEqual(['inside']);
  });
});
```

- [ ] **Step 6: Aggiorna l'import in `src/app/add-work-session.tsx`**

Sostituisci la riga:

```typescript
import { toLocalDateString } from '../features/payments/computeClientSummary';
```

con:

```typescript
import { toLocalDateString } from '../lib/dates';
```

- [ ] **Step 7: Aggiorna l'import in `src/app/add-payment.tsx`**

Sostituisci la riga:

```typescript
import { toLocalDateString } from '../features/payments/computeClientSummary';
```

con:

```typescript
import { toLocalDateString } from '../lib/dates';
```

- [ ] **Step 8: Esegui l'intera suite unit e verifica `tsc`**

Run: `npx jest --testPathIgnorePatterns=tests/rls`
Expected: tutti i test PASS (nessuna regressione rispetto a prima del refactor).

Run: `npx tsc --noEmit` (con la sequenza anti-stale-router-types dei Global Constraints)
Expected: pulito.

- [ ] **Step 9: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts src/features/payments/computeClientSummary.ts src/features/payments/computeClientSummary.test.ts src/app/add-work-session.tsx src/app/add-payment.tsx
git commit -m "refactor: extract local-date utilities to src/lib/dates.ts"
```

---

### Task 2: Funzioni pure di griglia calendario (`src/features/calendar/calendarGrid.ts`)

**Files:**
- Create: `src/features/calendar/calendarGrid.ts`
- Create: `src/features/calendar/calendarGrid.test.ts`

**Interfaces:**
- Consumes: `addDays`, `parseLocalDateString`, `toLocalDateString` dal Task 1 (`src/lib/dates.ts`)
- Produces: `CalendarViewMode` (`'day' | 'week' | 'month'`), `CalendarDay { date: string; inCurrentPeriod: boolean }`, `getDayView(anchorDate)`, `getWeekDays(anchorDate)`, `getMonthGridDays(anchorDate)`, `shiftAnchorDate(anchorDate, view, direction)` — usati dal Task 4 (`CalendarView`)

- [ ] **Step 1: Scrivi il test per la funzione pura (TDD)**

`src/features/calendar/calendarGrid.test.ts`:

```typescript
import { getDayView, getMonthGridDays, getWeekDays, shiftAnchorDate } from './calendarGrid';
import { addDays, parseLocalDateString } from '../../lib/dates';

describe('getDayView', () => {
  it('returns a single day marked as in the current period', () => {
    expect(getDayView('2026-09-18')).toEqual([{ date: '2026-09-18', inCurrentPeriod: true }]);
  });
});

describe('getWeekDays', () => {
  it('returns 7 consecutive days starting on Monday and ending on Sunday', () => {
    const days = getWeekDays('2026-09-18');
    expect(days).toHaveLength(7);
    expect(parseLocalDateString(days[0].date).getDay()).toBe(1); // Monday
    expect(parseLocalDateString(days[6].date).getDay()).toBe(0); // Sunday
    for (let i = 1; i < 7; i++) {
      expect(days[i].date).toBe(addDays(days[i - 1].date, 1));
    }
  });

  it('returns the same week whether anchored on its Monday or its Sunday', () => {
    const fromMonday = getWeekDays('2026-09-14');
    const fromSunday = getWeekDays('2026-09-20');
    expect(fromMonday.map((d) => d.date)).toEqual(fromSunday.map((d) => d.date));
  });

  it('marks every day of the week as in the current period', () => {
    const days = getWeekDays('2026-09-18');
    expect(days.every((d) => d.inCurrentPeriod)).toBe(true);
  });
});

describe('getMonthGridDays', () => {
  it('returns full weeks only (a multiple of 7 days)', () => {
    const days = getMonthGridDays('2026-09-01');
    expect(days.length % 7).toBe(0);
  });

  it('starts the grid on a Monday and ends on a Sunday', () => {
    const days = getMonthGridDays('2026-09-01');
    expect(parseLocalDateString(days[0].date).getDay()).toBe(1);
    expect(parseLocalDateString(days[days.length - 1].date).getDay()).toBe(0);
  });

  it('contains every day of the anchor month marked in-period, contiguously', () => {
    const days = getMonthGridDays('2026-09-15');
    for (let i = 1; i < days.length; i++) {
      expect(days[i].date).toBe(addDays(days[i - 1].date, 1));
    }
    const currentPeriodDays = days.filter((d) => d.inCurrentPeriod);
    expect(currentPeriodDays).toHaveLength(30); // September has 30 days
    expect(currentPeriodDays[0].date).toBe('2026-09-01');
    expect(currentPeriodDays[29].date).toBe('2026-09-30');
  });

  it('marks leading/trailing days from adjacent months as not in-period', () => {
    const days = getMonthGridDays('2026-09-15');
    const leading = days.filter((d) => d.date < '2026-09-01');
    const trailing = days.filter((d) => d.date > '2026-09-30');
    expect(leading.length + trailing.length).toBeGreaterThan(0);
    expect(leading.every((d) => !d.inCurrentPeriod)).toBe(true);
    expect(trailing.every((d) => !d.inCurrentPeriod)).toBe(true);
  });

  it('handles February in a leap year (29 days)', () => {
    const days = getMonthGridDays('2028-02-10');
    const currentPeriodDays = days.filter((d) => d.inCurrentPeriod);
    expect(currentPeriodDays).toHaveLength(29);
  });
});

describe('shiftAnchorDate', () => {
  it('day view: shifts by one day', () => {
    expect(shiftAnchorDate('2026-09-18', 'day', 1)).toBe('2026-09-19');
    expect(shiftAnchorDate('2026-09-18', 'day', -1)).toBe('2026-09-17');
  });

  it('week view: shifts by seven days', () => {
    expect(shiftAnchorDate('2026-09-18', 'week', 1)).toBe('2026-09-25');
    expect(shiftAnchorDate('2026-09-18', 'week', -1)).toBe('2026-09-11');
  });

  it('month view: moves to the same day-of-month in the next/previous month', () => {
    expect(shiftAnchorDate('2026-09-15', 'month', 1)).toBe('2026-10-15');
    expect(shiftAnchorDate('2026-09-15', 'month', -1)).toBe('2026-08-15');
  });

  it('month view: clamps into a shorter target month instead of rolling over (the historical bug)', () => {
    // 31 March minus a month must land on 28 Feb (2026 is not a leap year), not roll forward into March.
    expect(shiftAnchorDate('2026-03-31', 'month', -1)).toBe('2026-02-28');
    expect(shiftAnchorDate('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(shiftAnchorDate('2028-01-31', 'month', 1)).toBe('2028-02-29'); // leap year
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/features/calendar/calendarGrid.test.ts`
Expected: FAIL — `Cannot find module './calendarGrid'`

- [ ] **Step 3: Scrivi `src/features/calendar/calendarGrid.ts`**

```typescript
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
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/features/calendar/calendarGrid.test.ts`
Expected: PASS, 13/13.

- [ ] **Step 5: Commit**

```bash
git add src/features/calendar
git commit -m "feat: add pure calendar grid functions for day/week/month views"
```

---

### Task 3: Stato pagato/non-pagato per l'intero household

**Files:**
- Modify: `src/features/work-sessions/useWorkSessions.ts`
- Modify: `src/features/payments/usePayments.ts`

**Interfaces:**
- Consumes: `WorkSessionStatus` interface e view `work_session_status` (già esistenti dal blocco Clienti+Pagamenti)
- Produces: `useAllWorkSessionsStatus()` — query TanStack di tutte le `work_session_status` dell'household corrente, usata dal Task 6 (tab Calendario) e dal Task 5 (schermata `/day/[date]`)

- [ ] **Step 1: Aggiungi `useAllWorkSessionsStatus()` in `src/features/work-sessions/useWorkSessions.ts`**

Aggiungi in fondo al file (dopo `useAllWorkSessions`, prima di `useCreateWorkSession`):

```typescript
export function useAllWorkSessionsStatus() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['work-session-status-all', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<WorkSessionStatus[]> => {
      const { data, error } = await supabase
        .from('work_session_status')
        .select('id, client_id, date, hours, rate_snapshot, amount_due, note, status')
        .eq('household_id', householdId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WorkSessionStatus[];
    },
  });
}
```

Poi, dentro `useCreateWorkSession`, aggiungi l'invalidazione della nuova query key nel suo `onSuccess` esistente:

```typescript
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-session-status', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['work-session-status-all'] });
      queryClient.invalidateQueries({ queryKey: ['work-sessions'] });
    },
```

(Senza questa invalidazione, registrare una giornata dalla schermata `/day/[date]` del Task 5 non aggiornerebbe subito i colori del calendario.)

- [ ] **Step 2: Aggiungi la stessa invalidazione in `useCreatePayment` (`src/features/payments/usePayments.ts`)**

Un pagamento cambia lo stato pagato/non-pagato di più giornate passate dello stesso cliente (logica FIFO) — anche questo deve invalidare la vista aggregata per household. Aggiorna il suo `onSuccess` esistente:

```typescript
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['payments-all'] });
      queryClient.invalidateQueries({ queryKey: ['work-session-status', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['work-session-status-all'] });
    },
```

- [ ] **Step 3: Verifica**

Run: `npx tsc --noEmit` (con la sequenza anti-stale-router-types) — deve essere pulito.
Run: `npx jest --testPathIgnorePatterns=tests/rls` — nessuna regressione.

- [ ] **Step 4: Commit**

```bash
git add src/features/work-sessions/useWorkSessions.ts src/features/payments/usePayments.ts
git commit -m "feat: add household-wide work session status query"
```

---

### Task 4: Componente condiviso `CalendarView`

**Files:**
- Create: `src/components/CalendarView.tsx`

**Interfaces:**
- Consumes: `CalendarViewMode`, `CalendarDay`, `getDayView`, `getWeekDays`, `getMonthGridDays`, `shiftAnchorDate` dal Task 2; `parseLocalDateString`, `toLocalDateString` dal Task 1
- Produces: `CalendarView` component con props `{ initialView?: CalendarViewMode; renderDay: (date: string, meta: { inCurrentPeriod: boolean }) => React.ReactNode; onDayPress: (date: string) => void }` — usato dal Task 6 (tab Calendario) e, in un blocco futuro, dal calendario Francesca con un `renderDay` diverso

- [ ] **Step 1: Scrivi `src/components/CalendarView.tsx`**

```tsx
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
```

- [ ] **Step 2: Verifica**

Run: `npx tsc --noEmit` (con la sequenza anti-stale-router-types) — deve essere pulito. Il componente non è ancora montato da nessuno screen (arriva nel Task 6), quindi non c'è verifica manuale a runtime in questo task — solo controllo tipi, coerente con gli step "solo schema/funzioni pure" già usati nel blocco precedente.

- [ ] **Step 3: Commit**

```bash
git add src/components/CalendarView.tsx
git commit -m "feat: add parametric CalendarView component (day/week/month)"
```

---

### Task 5: Schermata dettaglio giorno + prefill data in add-work-session

**Files:**
- Create: `src/app/day/[date].tsx`
- Modify: `src/app/add-work-session.tsx`

**Interfaces:**
- Consumes: `useClients()` (blocco Clienti+Pagamenti), `useAllWorkSessionsStatus()` (Task 3)
- Produces: schermata `/day/[date]` che elenca le giornate lavorate di quel giorno e apre `add-work-session` precompilato con quella data

- [ ] **Step 1: Scrivi `src/app/day/[date].tsx`**

```tsx
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../../features/clients/useClients';
import { useAllWorkSessionsStatus } from '../../features/work-sessions/useWorkSessions';

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessionsStatus();

  const daySessions = (sessions ?? []).filter((s) => s.date === date);
  const clientName = (clientId: string) => clients?.find((c) => c.id === clientId)?.name ?? 'Cliente';

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Indietro</Text>
      </Pressable>
      <Text style={styles.title}>{date}</Text>

      <FlatList
        style={{ flex: 1 }}
        data={daySessions}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: item.status === 'paid' ? '#dcfce7' : '#fee2e2' }]}>
            <Text style={styles.rowClient}>{clientName(item.client_id)}</Text>
            <Text>{item.hours}h — €{item.amount_due.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>Nessuna giornata lavorata in questo giorno.</Text>}
      />

      <Pressable
        style={styles.addButton}
        onPress={() => router.push({ pathname: '/add-work-session', params: { date } })}
      >
        <Text style={styles.addButtonText}>+ Giornata</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  back: { color: '#2563eb', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 6, marginTop: 4 },
  rowClient: { fontWeight: '600' },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  addButtonText: { color: 'white', fontWeight: '600' },
});
```

- [ ] **Step 2: Aggiungi il prefill opzionale della data in `src/app/add-work-session.tsx`**

Sostituisci le prime due righe dentro il componente (dopo gli import):

```typescript
  const { clientId: preselectedClientId } = useLocalSearchParams<{ clientId?: string }>();
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState(preselectedClientId ?? '');
  const [date, setDate] = useState(toLocalDateString(new Date()));
```

con:

```typescript
  const { clientId: preselectedClientId, date: preselectedDate } = useLocalSearchParams<{ clientId?: string; date?: string }>();
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState(preselectedClientId ?? '');
  const [date, setDate] = useState(preselectedDate ?? toLocalDateString(new Date()));
```

- [ ] **Step 3: Verifica**

Run: `npx tsc --noEmit` (sequenza anti-stale-router-types) — pulito.

Manuale: `npx expo start --web`. Naviga direttamente a `/day/2026-09-18` digitando l'URL (raggiungibile dalla UI solo dal Task 6) — verifica che la lista mostri le giornate esistenti per quella data con colore corretto, poi tocca "+ Giornata" e verifica che il campo data sia già precompilato con `2026-09-18`.

- [ ] **Step 4: Commit**

```bash
git add src/app/day src/app/add-work-session.tsx
git commit -m "feat: add day detail screen with date-prefilled work session creation"
```

---

### Task 6: Tab Calendario — integrazione finale

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `CalendarView` (Task 4), `useAllWorkSessionsStatus()` (Task 3)
- Produces: tab Calendario funzionante — vista giorno/settimana/mese con celle colorate pagato/non-pagato, navigazione verso `/day/[date]`

- [ ] **Step 1: Riscrivi `src/app/(tabs)/index.tsx`**

```tsx
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { CalendarView } from '../../components/CalendarView';
import { useAllWorkSessionsStatus } from '../../features/work-sessions/useWorkSessions';

interface DayStatus {
  hasPaid: boolean;
  hasUnpaid: boolean;
}

function DayStatusIndicator({ hasPaid, hasUnpaid }: DayStatus) {
  if (!hasPaid && !hasUnpaid) return null;
  if (hasPaid && hasUnpaid) {
    return (
      <View style={styles.statusIndicator}>
        <View style={[styles.statusHalf, { backgroundColor: '#16a34a' }]} />
        <View style={[styles.statusHalf, { backgroundColor: '#dc2626' }]} />
      </View>
    );
  }
  return <View style={[styles.statusIndicator, { backgroundColor: hasPaid ? '#16a34a' : '#dc2626' }]} />;
}

export default function CalendarioScreen() {
  const { data: sessions } = useAllWorkSessionsStatus();

  const statusByDate = useMemo(() => {
    const map = new Map<string, DayStatus>();
    for (const s of sessions ?? []) {
      const entry = map.get(s.date) ?? { hasPaid: false, hasUnpaid: false };
      if (s.status === 'paid') entry.hasPaid = true;
      else entry.hasUnpaid = true;
      map.set(s.date, entry);
    }
    return map;
  }, [sessions]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calendario Lavoro</Text>
      <CalendarView
        initialView="week"
        renderDay={(date) => {
          const status = statusByDate.get(date);
          return <DayStatusIndicator hasPaid={status?.hasPaid ?? false} hasUnpaid={status?.hasUnpaid ?? false} />;
        }}
        onDayPress={(date) => router.push(`/day/${date}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  statusIndicator: { flex: 1, minHeight: 16, borderRadius: 4, marginTop: 2, overflow: 'hidden' },
  statusHalf: { flex: 1 },
});
```

- [ ] **Step 2: Verifica manuale end-to-end**

Run: `npx expo start --web` (poi seguire la sequenza anti-stale-router-types per un `tsc` pulito prima di procedere alla verifica manuale).

Percorso di test (usando i clienti/giornate/pagamenti già creati nei blocchi precedenti, o crearne di nuovi da Impostazioni/dettaglio cliente se l'ambiente è vuoto):
1. Apri il tab Calendario — deve aprirsi in vista Settimana, con la settimana corrente.
2. Verifica che i giorni con giornate lavorate non pagate mostrino un indicatore rosso, quelli pagati un indicatore verde, quelli con entrambi (più clienti, stati misti) un indicatore metà verde/metà rosso, e i giorni senza giornate nessun indicatore.
3. Passa a vista Mese — la griglia deve mostrare tutte le settimane del mese corrente, con i giorni dei mesi adiacenti visivamente attenuati; gli indicatori di stato devono comparire anche lì.
4. Passa a vista Giorno — deve mostrare solo il giorno corrente.
5. Usa le frecce ‹ › per navigare avanti/indietro in ciascuna vista e verifica che l'etichetta del periodo cambi coerentemente (es. mese che cambia a fine mese, senza salti).
6. Tocca un giorno con almeno una giornata lavorata — deve aprire `/day/<data>` con la lista corretta (cliente, ore, importo, colore stato).
7. Da `/day/<data>` tocca "+ Giornata", verifica che la data sia precompilata, seleziona un cliente, salva — torna indietro e verifica che il calendario mostri subito il nuovo indicatore aggiornato per quel giorno (nessun refresh manuale necessario).

- [ ] **Step 3: Esegui l'intera suite e verifica tipi**

Run: `npx jest --testPathIgnorePatterns=tests/rls`
Expected: tutti PASS.

Run: `npx tsc --noEmit` (sequenza anti-stale-router-types)
Expected: pulito.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "feat: wire Calendario tab with day/week/month view and paid/unpaid coloring"
```

---

## Al termine di questo piano

Deliverable funzionante e testabile: tab Calendario con vista giorno/settimana/mese navigabile, celle colorate in base allo stato pagato/non-pagato delle giornate lavorate (incluso il caso misto multi-cliente), e una schermata di dettaglio giorno da cui registrare una nuova giornata lavorata con la data già precompilata. `CalendarView` è pronto per essere riusato tal quale dal prossimo blocco ("Calendario familiare") con un `renderDay` diverso per gli impegni di Francesca, come previsto dalla spec (sezione 5).
