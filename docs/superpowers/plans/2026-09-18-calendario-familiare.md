# Calendario Familiare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calendario familiare (impegni ricorrenti + eventi manuali di Francesca e altri), integrato nel tab Calendario esistente con un toggle Lavoro|Francesca, con promemoria locali (`expo-notifications`) il giorno prima alle 20:00 — sia per gli eventi salvati sia per le occorrenze ricorrenti regolari non ancora materializzate.

**Architecture:** Due nuove tabelle household-scoped (`recurring_templates`, `calendar_events`) con lo stesso pattern RLS già stabilito. Le occorrenze ricorrenti non sono mai materializzate in anticipo: una funzione pura TypeScript (`expandOccurrences`) le espande al volo per un intervallo di date, sovrascrivendole con eventuali eccezioni puntuali (`calendar_events` con lo stesso `recurring_template_id` + data) o escludendole se cancellate. Il componente condiviso `CalendarView` (dal blocco Calendario Lavoro) viene riusato tal quale con un `renderDay` diverso — nessuna modifica al componente stesso, la sua natura parametrica viene messa alla prova per la prima volta da un secondo consumatore reale. Le notifiche sono interamente locali/on-device: nessun identificativo di notifica finisce nel database condiviso (ogni dispositivo ha il proprio stato OS), solo in `AsyncStorage`.

**Tech Stack:** Stesso stack dei blocchi precedenti — Expo Router, TypeScript, `@supabase/supabase-js` con tipi generati, TanStack Query, Jest. Nuova dipendenza: `expo-notifications` (SDK 57 — API verificata contro `https://docs.expo.dev/versions/v57.0.0/sdk/notifications/`, non assumere la sintassi di versioni precedenti). Persistenza locale per lo stato notifiche: `@react-native-async-storage/async-storage` (già una dipendenza del progetto).

**Spec:** `docs/superpowers/specs/2026-09-17-family-manager-app-design.md` (sezione 4.3 per lo schema, sezione 5 per il toggle e il riuso di `CalendarView`, sezione 6 per le notifiche, sezione 7 punto 2 per i test della funzione di espansione)

**Precede questo piano (già completato):** `docs/superpowers/plans/2026-09-18-calendario-lavoro.md` — questo piano assume che `CalendarView`, `calendarGrid.ts`, `src/lib/dates.ts` esistano già e funzionino, e riusa `is_household_member(household_id)` da `0002_fix_household_members_rls_recursion.sql`.

**Decisioni di scope confermate con l'utente (brainstorming leggero):**
- Toggle Lavoro|Francesca in cima al tab Calendario esistente; gli impegni ricorrenti si creano/modificano/eliminano da Impostazioni (stesso pattern della sezione Clienti); gli eventi manuali singoli si creano dal dettaglio giorno, come le giornate lavorate.
- Eccezione singola: dal dettaglio giorno, due azioni distinte — "Salta solo oggi" (cancella solo quell'occorrenza) e "Modifica solo oggi" (modifica puntuale). Modificare il modello ricorrente stesso (da Impostazioni) vale per tutte le occorrenze future.
- Notifiche incluse in questo blocco, e devono coprire anche le occorrenze ricorrenti "regolari" non materializzate (non solo gli eventi/eccezioni effettivamente salvati) — richiede un piccolo "sweep" che ricalcola la prossima occorrenza futura di ogni impegno ricorrente alla creazione/modifica del modello e ad ogni apertura dell'app.

## Global Constraints

- Nessuna nuova RPC: le due nuove tabelle usano RLS via `is_household_member(household_id)` (funzione già esistente), con un'unica policy `for all` per tabella (using + with check) — stesso pattern di `clients`/`work_sessions`/`payments`.
- **Convenzione weekday — attenzione, diversa da quella della griglia calendario:** `recurring_templates.weekday` e tutta la logica di espansione usano la convenzione nativa di `Date.getDay()` di JavaScript (0 = Domenica … 6 = Sabato), NON la convenzione Lunedì-primo già usata internamente da `calendarGrid.ts` per disegnare la griglia. Questo evita conversioni nella funzione pura di espansione (che deve solo confrontare `date.getDay() === template.weekday`), ma richiede attenzione nelle schermate di form: i bottoni di selezione giorno si mostrano in ordine Lun→Dom (coerente con il resto della UI) ma memorizzano il valore `Date.getDay()` corrispondente — la mappatura è esplicita in `src/features/family-calendar/constants.ts` (Task 4), non implicita.
- Tutta la logica di calcolo (espansione occorrenze, prossima occorrenza, orario del promemoria) vive in funzioni pure testabili in `src/features/family-calendar/` e `src/features/notifications/`, mai inline nei componenti — stesso principio già applicato a `calendarGrid.ts` e `computeClientSummary.ts`, rinforzato dopo che una violazione di questa regola nel blocco precedente ha causato un bug reale passato inosservato per sei revisioni di task.
- Le date locali passano sempre da `src/lib/dates.ts`, mai da `.toISOString()` o aritmetica `Date` manuale.
- `CalendarView` (`src/components/CalendarView.tsx`) non viene modificato in questo blocco — è già parametrico (`renderDay`, `onDayPress`, `initialView`) ed è esattamente il secondo consumatore per cui è stato progettato.
- **Finestra fissa per il calcolo delle occorrenze:** `CalendarView` non espone al genitore l'intervallo di date attualmente visibile (limite noto, non risolto in questo blocco — vedi `docs/superpowers/PROGRESS.md`). Il tab Calendario Francesca calcola quindi le occorrenze su una finestra fissa (90 giorni nel passato, 365 giorni nel futuro da oggi) invece di seguire la navigazione dell'utente — scelta pragmatica esplicita, non una svista: naviga oltre un anno nel futuro e le celle di quel periodo non mostreranno occorrenze ricorrenti finché non si aggiorna la pagina.
- Nessuna notifica programmata sopravvive al di fuori del dispositivo che l'ha creata: gli identificativi di notifica (`notificationId`) vivono solo in `AsyncStorage` locale, mai in una colonna del database condiviso — coerente con "notifiche locali on-device, nessuna infrastruttura server" della spec.
- Ogni fallimento di `expo-notifications` (permesso negato, piattaforma non supportata) deve essere silenzioso e non bloccante: l'app resta pienamente funzionante senza promemoria.
- Dopo ogni modifica allo schema, rigenerare `src/lib/database.types.ts` (`npx supabase gen types typescript --project-id qivxrbhbffwqqmaadpnl > src/lib/database.types.ts`).
- Routing: nuove schermate fuori da `(tabs)/` vivono in `src/app/`, con bottone "Indietro" esplicito (`router.back()`). Rotta dinamica `family-day/[date].tsx` segue lo stesso pattern di `day/[date].tsx` già esistente.
- Verifica `tsc --noEmit`: per ogni task che tocca file sotto `src/app/` (nuove rotte o modifiche a rotte esistenti), usare la sequenza anti-stale-router-types descritta in `docs/superpowers/PROGRESS.md` (avviare `expo start --web` in background, attendere "Waiting on http://...", forzare un bundle reale con `curl`, poi `tsc`, poi killare il server) — non fidarsi di un `tsc` lanciato subito dopo l'avvio del server. Per task che toccano solo file puri in `src/features/`/`src/lib/` (nessuna rotta), un `tsc --noEmit` semplice basta.
- Questo ambiente di esecuzione non ha strumenti di browser headless/interattivo: la verifica manuale delle schermate è sempre una lettura attenta del codice (parametri di route corrispondenti end-to-end, logica condizionale non invertita, uso corretto dei campi) invece di un click-through — pratica già stabilita e accettata in questo progetto.

---

### Task 1: Schema Postgres — recurring_templates, calendar_events + RLS

**Files:**
- Create: `supabase/migrations/0006_family_calendar.sql`
- Modify: `src/lib/database.types.ts` (rigenerato dalla CLI)

**Interfaces:**
- Consumes: `is_household_member(uuid)` da `0002_fix_household_members_rls_recursion.sql`
- Produces: tabelle `recurring_templates` (id, household_id, title, category, person, weekday, time, note, created_at) e `calendar_events` (id, household_id, recurring_template_id, title, category, person, date, time, note, is_cancelled, created_at), con `unique (recurring_template_id, date)` su `calendar_events`

- [ ] **Step 1: Scrivi la migrazione `supabase/migrations/0006_family_calendar.sql`**

```sql
-- Calendario familiare: impegni ricorrenti (modelli) + eventi puntuali
-- (eccezioni a un modello ricorrente, o eventi manuali non ricorrenti).
-- Le occorrenze ricorrenti "regolari" non vengono mai materializzate qui:
-- il client le espande al volo da recurring_templates per l'intervallo
-- visualizzato, sovrascrivendole con eventuali righe calendar_events con
-- lo stesso recurring_template_id + date.

create table recurring_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  category text not null check (category in ('mensa', 'palestra', 'cavallo', 'piscina', 'teatro', 'altro')),
  person text not null,
  weekday smallint not null check (weekday between 0 and 6),
  time time,
  note text,
  created_at timestamptz not null default now()
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recurring_template_id uuid references recurring_templates(id) on delete cascade,
  title text not null,
  category text not null check (category in ('mensa', 'palestra', 'cavallo', 'piscina', 'teatro', 'altro')),
  person text not null,
  date date not null,
  time time,
  note text,
  is_cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  -- Al massimo una riga (eccezione o cancellazione) per occorrenza di un
  -- modello ricorrente. NULL su recurring_template_id non collide mai con
  -- se stesso in un vincolo unique Postgres, quindi gli eventi manuali
  -- (recurring_template_id null) non sono limitati da questo vincolo.
  unique (recurring_template_id, date)
);

alter table recurring_templates enable row level security;
alter table calendar_events enable row level security;

create policy "household members manage recurring_templates" on recurring_templates
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "household members manage calendar_events" on calendar_events
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));
```

- [ ] **Step 2: Applica la migrazione al progetto Cloud**

```bash
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env | cut -d '=' -f2)
npx supabase db push
```

Expected: conferma applicazione di `0006_family_calendar.sql` senza errori. Non stampare mai il valore del token.

- [ ] **Step 3: Verifica con `supabase migration list`**

```bash
npx supabase migration list
```

Expected: remote mostra `0001`...`0006` tutti applicati.

- [ ] **Step 4: Rigenera i tipi TypeScript**

```bash
npx supabase gen types typescript --project-id qivxrbhbffwqqmaadpnl > src/lib/database.types.ts
```

Expected: il file include ora `recurring_templates` e `calendar_events`. Verifica con `npx tsc --noEmit` che non ci siano errori.

- [ ] **Step 5: Commit**

```bash
git add supabase src/lib/database.types.ts
git commit -m "feat: add recurring_templates and calendar_events schema with RLS"
```

---

### Task 2: Test di integrazione RLS per recurring_templates/calendar_events

**Files:**
- Create: `tests/rls/family-calendar.test.ts`

**Interfaces:**
- Consumes: `adminClient`, `createTestUser`, `signInAs` da `tests/rls/helpers.ts` (già esistenti)
- Produces: nessuna nuova interfaccia — solo copertura di test

- [ ] **Step 1: Scrivi `tests/rls/family-calendar.test.ts`**

```typescript
import { adminClient as admin, createTestUser, signInAs } from './helpers';

describe('recurring_templates/calendar_events RLS isolation', () => {
  const password = 'Test1234!';
  const userAEmail = `family-test-a-${Date.now()}@example.com`;
  const userBEmail = `family-test-b-${Date.now()}@example.com`;
  let userAId: string;
  let userBId: string;
  const createdHouseholdIds: string[] = [];

  beforeAll(async () => {
    const userA = await createTestUser(userAEmail, password);
    const userB = await createTestUser(userBEmail, password);
    userAId = userA.id;
    userBId = userB.id;
  });

  afterAll(async () => {
    if (createdHouseholdIds.length > 0) {
      await admin.from('households').delete().in('id', createdHouseholdIds);
    }
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it('a user cannot see or write recurring_templates/calendar_events from another household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', { p_name: 'Household A Family Test' });
    createdHouseholdIds.push(householdA.id);

    const { data: template, error: templateError } = await clientA
      .from('recurring_templates')
      .insert({ household_id: householdA.id, title: 'Piscina', category: 'piscina', person: 'Francesca', weekday: 2 })
      .select()
      .single();
    expect(templateError).toBeNull();

    await clientA.from('calendar_events').insert({
      household_id: householdA.id,
      title: 'Visita medica',
      category: 'altro',
      person: 'Francesca',
      date: '2026-09-22',
    });

    const clientB = await signInAs(userBEmail, password);
    const { data: visibleTemplates } = await clientB
      .from('recurring_templates')
      .select('*')
      .eq('household_id', householdA.id);
    const { data: visibleEvents } = await clientB
      .from('calendar_events')
      .select('*')
      .eq('household_id', householdA.id);

    expect(visibleTemplates).toEqual([]);
    expect(visibleEvents).toEqual([]);

    const insertAttempt = await clientB
      .from('recurring_templates')
      .insert({ household_id: householdA.id, title: 'Sneaky', category: 'altro', person: 'X', weekday: 0 });
    expect(insertAttempt.error).not.toBeNull();

    void template;
  });

  it('a user can fully manage recurring_templates and calendar_events in their own household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Family CRUD Test' });
    createdHouseholdIds.push(household.id);

    const { data: template, error: createError } = await clientA
      .from('recurring_templates')
      .insert({ household_id: household.id, title: 'Mensa', category: 'mensa', person: 'Francesca', weekday: 1 })
      .select()
      .single();
    expect(createError).toBeNull();

    const { data: updated, error: updateError } = await clientA
      .from('recurring_templates')
      .update({ weekday: 3 })
      .eq('id', template.id)
      .select()
      .single();
    expect(updateError).toBeNull();
    expect(updated.weekday).toBe(3);

    const { error: deleteError } = await clientA.from('recurring_templates').delete().eq('id', template.id);
    expect(deleteError).toBeNull();
  });

  it('the unique constraint on (recurring_template_id, date) rejects a duplicate override but allows multiple manual events on the same date', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Unique Constraint Test' });
    createdHouseholdIds.push(household.id);

    const { data: template } = await clientA
      .from('recurring_templates')
      .insert({ household_id: household.id, title: 'Palestra', category: 'palestra', person: 'Francesca', weekday: 4 })
      .select()
      .single();

    const { error: firstOverrideError } = await clientA.from('calendar_events').insert({
      household_id: household.id,
      recurring_template_id: template.id,
      title: 'Palestra',
      category: 'palestra',
      person: 'Francesca',
      date: '2026-10-01',
      is_cancelled: true,
    });
    expect(firstOverrideError).toBeNull();

    const { error: duplicateOverrideError } = await clientA.from('calendar_events').insert({
      household_id: household.id,
      recurring_template_id: template.id,
      title: 'Palestra',
      category: 'palestra',
      person: 'Francesca',
      date: '2026-10-01',
    });
    expect(duplicateOverrideError).not.toBeNull();

    const { error: manualEvent1Error } = await clientA.from('calendar_events').insert({
      household_id: household.id,
      title: 'Compleanno',
      category: 'altro',
      person: 'Francesca',
      date: '2026-10-01',
    });
    const { error: manualEvent2Error } = await clientA.from('calendar_events').insert({
      household_id: household.id,
      title: 'Teatro',
      category: 'teatro',
      person: 'Francesca',
      date: '2026-10-01',
    });
    expect(manualEvent1Error).toBeNull();
    expect(manualEvent2Error).toBeNull();
  });
});
```

- [ ] **Step 2: Esegui tutti i test RLS**

Run: `npm run test:rls`
Expected: tutti PASS (quelli esistenti + i 3 nuovi di `family-calendar.test.ts`).

- [ ] **Step 3: Commit**

```bash
git add tests/rls/family-calendar.test.ts
git commit -m "test: add RLS coverage for recurring_templates and calendar_events"
```

---

### Task 3: Logica pura — espansione occorrenze e calcolo orario promemoria

**Files:**
- Create: `src/features/family-calendar/recurringOccurrences.ts`
- Create: `src/features/family-calendar/recurringOccurrences.test.ts`
- Create: `src/features/notifications/reminderTiming.ts`
- Create: `src/features/notifications/reminderTiming.test.ts`

**Interfaces:**
- Consumes: `addDays`, `parseLocalDateString`, `toLocalDateString` da `src/lib/dates.ts`
- Produces: `FamilyCategory`, `RecurringTemplate`, `CalendarEvent`, `Occurrence`, `expandOccurrences(templates, events, range)`, `nextOccurrenceDate(weekday, from)` da `recurringOccurrences.ts`; `reminderDateTime(dateStr, timeStr)`, `isFutureReminder(date, now?)` da `reminderTiming.ts` — usati dal Task 4 (hooks), Task 5 (schermate), Task 6 (notifiche)

- [ ] **Step 1: Scrivi il test per `recurringOccurrences.ts` (TDD)**

`src/features/family-calendar/recurringOccurrences.test.ts`:

```typescript
import { expandOccurrences, nextOccurrenceDate, RecurringTemplate, CalendarEvent } from './recurringOccurrences';

function template(overrides: Partial<RecurringTemplate>): RecurringTemplate {
  return {
    id: 't1',
    title: 'Piscina',
    category: 'piscina',
    person: 'Francesca',
    weekday: 2, // martedì (2026-09-01 è martedì)
    time: '17:00',
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
    time: null,
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
    // Martedì in questo intervallo: 1, 8, 15 settembre 2026
    expect(occurrences.map((o) => o.date)).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
    expect(occurrences.every((o) => o.isVirtual)).toBe(true);
    expect(occurrences.every((o) => o.recurringTemplateId === 't1')).toBe(true);
  });

  it('a single exception overrides the fields of one occurrence without affecting others', () => {
    const occurrences = expandOccurrences(
      [template({ weekday: 2 })],
      [event({ id: 'override1', recurring_template_id: 't1', date: '2026-09-08', title: 'Piscina (orario speciale)', time: '19:00' })],
      { start: '2026-09-01', end: '2026-09-15' }
    );
    const overridden = occurrences.find((o) => o.date === '2026-09-08')!;
    expect(overridden.title).toBe('Piscina (orario speciale)');
    expect(overridden.time).toBe('19:00');
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
    expect(occurrences).toHaveLength(3); // 2 virtuali (1, 8 sett) + 1 manuale (8 sett)
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

  it('sorts results by date then by time', () => {
    const occurrences = expandOccurrences(
      [],
      [
        event({ id: 'e-late', date: '2026-09-08', time: '18:00' }),
        event({ id: 'e-early', date: '2026-09-08', time: '09:00' }),
        event({ id: 'e-prev-day', date: '2026-09-01', time: '10:00' }),
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
    // 2026-09-01 è martedì (weekday 2)
    expect(nextOccurrenceDate(2, '2026-09-01')).toBe('2026-09-01');
  });

  it('returns the next matching date within the following week', () => {
    // da mercoledì (2026-09-02) al prossimo martedì è il 2026-09-08
    expect(nextOccurrenceDate(2, '2026-09-02')).toBe('2026-09-08');
  });

  it('wraps correctly across a month boundary', () => {
    // 2026-09-29 è martedì; il prossimo martedì da mercoledì 2026-09-30 è il 2026-10-06
    expect(nextOccurrenceDate(2, '2026-09-30')).toBe('2026-10-06');
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/features/family-calendar/recurringOccurrences.test.ts`
Expected: FAIL — `Cannot find module './recurringOccurrences'`

- [ ] **Step 3: Scrivi `src/features/family-calendar/recurringOccurrences.ts`**

```typescript
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
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/features/family-calendar/recurringOccurrences.test.ts`
Expected: PASS, 10/10.

- [ ] **Step 5: Scrivi il test per `reminderTiming.ts` (TDD)**

`src/features/notifications/reminderTiming.test.ts`:

```typescript
import { reminderDateTime, isFutureReminder } from './reminderTiming';

describe('reminderDateTime', () => {
  it('returns 20:00 local time the day before the event date', () => {
    const when = reminderDateTime('2026-09-15', null);
    expect(when.getFullYear()).toBe(2026);
    expect(when.getMonth()).toBe(8); // settembre
    expect(when.getDate()).toBe(14);
    expect(when.getHours()).toBe(20);
    expect(when.getMinutes()).toBe(0);
  });

  it('rolls correctly across a month boundary', () => {
    const when = reminderDateTime('2026-10-01', null);
    expect(when.getMonth()).toBe(8); // settembre
    expect(when.getDate()).toBe(30);
  });

  it('rolls correctly across a year boundary', () => {
    const when = reminderDateTime('2027-01-01', null);
    expect(when.getFullYear()).toBe(2026);
    expect(when.getMonth()).toBe(11); // dicembre
    expect(when.getDate()).toBe(31);
  });

  it('ignores the event own time — the reminder is always fixed at 20:00 the day before', () => {
    const when = reminderDateTime('2026-09-15', '08:30');
    expect(when.getHours()).toBe(20);
  });
});

describe('isFutureReminder', () => {
  it('returns true when the reminder time is after now', () => {
    const now = new Date(2026, 8, 10, 12, 0);
    const reminder = new Date(2026, 8, 14, 20, 0);
    expect(isFutureReminder(reminder, now)).toBe(true);
  });

  it('returns false when the reminder time is in the past relative to now', () => {
    const now = new Date(2026, 8, 20, 12, 0);
    const reminder = new Date(2026, 8, 14, 20, 0);
    expect(isFutureReminder(reminder, now)).toBe(false);
  });

  it('returns false when the reminder time equals now exactly', () => {
    const now = new Date(2026, 8, 14, 20, 0);
    const reminder = new Date(2026, 8, 14, 20, 0);
    expect(isFutureReminder(reminder, now)).toBe(false);
  });
});
```

- [ ] **Step 6: Esegui il test e verifica che fallisca**

Run: `npx jest src/features/notifications/reminderTiming.test.ts`
Expected: FAIL — `Cannot find module './reminderTiming'`

- [ ] **Step 7: Scrivi `src/features/notifications/reminderTiming.ts`**

```typescript
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
```

- [ ] **Step 8: Esegui entrambi i test e verifica che passino**

Run: `npx jest src/features/family-calendar/recurringOccurrences.test.ts src/features/notifications/reminderTiming.test.ts`
Expected: PASS, 17/17 (10 + 7).

- [ ] **Step 9: Commit**

```bash
git add src/features/family-calendar/recurringOccurrences.ts src/features/family-calendar/recurringOccurrences.test.ts src/features/notifications/reminderTiming.ts src/features/notifications/reminderTiming.test.ts
git commit -m "feat: add pure recurring-occurrence expansion and reminder-timing functions"
```

---

### Task 4: Modelli ricorrenti — hook + CRUD in Impostazioni

**Files:**
- Create: `src/features/family-calendar/constants.ts`
- Create: `src/features/family-calendar/useRecurringTemplates.ts`
- Modify: `src/app/(tabs)/impostazioni.tsx`
- Create: `src/app/add-recurring-template.tsx`
- Create: `src/app/edit-recurring-template.tsx`

**Interfaces:**
- Consumes: `useHousehold()`, `RecurringTemplate`/`FamilyCategory` dal Task 3
- Produces: `FAMILY_CATEGORIES`, `WEEKDAY_OPTIONS` da `constants.ts`; `useRecurringTemplates()`, `useCreateRecurringTemplate()`, `useUpdateRecurringTemplate()`, `useDeleteRecurringTemplate()` — usati dal Task 5 (fallback per il dettaglio giorno) e dal Task 7 (calcolo occorrenze nel tab Calendario)

- [ ] **Step 1: Scrivi `src/features/family-calendar/constants.ts`**

```typescript
import type { FamilyCategory } from './recurringOccurrences';

export const FAMILY_CATEGORIES: { value: FamilyCategory; label: string }[] = [
  { value: 'mensa', label: 'Mensa' },
  { value: 'palestra', label: 'Palestra' },
  { value: 'cavallo', label: 'Cavallo' },
  { value: 'piscina', label: 'Piscina' },
  { value: 'teatro', label: 'Teatro' },
  { value: 'altro', label: 'Altro' },
];

// Bottoni mostrati in ordine Lun→Dom (coerente con il resto della UI del
// calendario) ma il valore memorizzato è la convenzione Date.getDay()
// nativa (0=Domenica..6=Sabato) usata da recurringOccurrences.ts — vedi
// il Global Constraint sulla convenzione weekday nel piano.
export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Gio' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Dom' },
];
```

- [ ] **Step 2: Scrivi `src/features/family-calendar/useRecurringTemplates.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import type { FamilyCategory, RecurringTemplate } from './recurringOccurrences';

export function useRecurringTemplates() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['recurring-templates', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<RecurringTemplate[]> => {
      const { data, error } = await supabase
        .from('recurring_templates')
        .select('id, title, category, person, weekday, time, note')
        .eq('household_id', householdId!)
        .order('weekday', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data as RecurringTemplate[];
    },
  });
}

export function useCreateRecurringTemplate() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      category: FamilyCategory;
      person: string;
      weekday: number;
      time?: string;
      note?: string;
    }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('recurring_templates')
        .insert({
          household_id: household.id,
          title: input.title,
          category: input.category,
          person: input.person,
          weekday: input.weekday,
          time: input.time || null,
          note: input.note || null,
        })
        .select('id, title, category, person, weekday, time, note')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-templates'] }),
  });
}

export function useUpdateRecurringTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      category: FamilyCategory;
      person: string;
      weekday: number;
      time?: string;
      note?: string;
    }) => {
      const { data, error } = await supabase
        .from('recurring_templates')
        .update({
          title: input.title,
          category: input.category,
          person: input.person,
          weekday: input.weekday,
          time: input.time || null,
          note: input.note || null,
        })
        .eq('id', input.id)
        .select('id, title, category, person, weekday, time, note')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-templates'] }),
  });
}

export function useDeleteRecurringTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_templates').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-templates'] }),
  });
}
```

- [ ] **Step 3: Estendi `src/app/(tabs)/impostazioni.tsx` con la sezione Impegni ricorrenti**

Aggiungi gli import necessari in cima al file:

```typescript
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { WEEKDAY_OPTIONS } from '../../features/family-calendar/constants';
```

Dentro `ImpostazioniScreen`, dopo `const { data: clients } = useClients();`, aggiungi:

```typescript
  const { data: recurringTemplates } = useRecurringTemplates();
  const weekdayLabel = (weekday: number) => WEEKDAY_OPTIONS.find((w) => w.value === weekday)?.label ?? '?';
```

Subito dopo la chiusura del `</View>` di `styles.listWrapper` per i clienti (prima del bottone "Esci"), aggiungi una sezione identica nella struttura:

```tsx
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Impegni ricorrenti</Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/add-recurring-template')}>
          <Text style={styles.addButtonText}>+ Impegno</Text>
        </Pressable>
      </View>
      <View style={styles.listWrapper}>
        <FlatList
          style={{ flex: 1 }}
          data={recurringTemplates ?? []}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.clientRow}
              onPress={() => router.push({ pathname: '/edit-recurring-template', params: { id: item.id } })}
            >
              <Text style={styles.clientName}>{item.title} — {item.person}</Text>
              <Text>{weekdayLabel(item.weekday)}{item.time ? ` ${item.time}` : ''}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text>Nessun impegno ricorrente ancora.</Text>}
        />
      </View>
```

- [ ] **Step 4: Scrivi `src/app/add-recurring-template.tsx`**

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useCreateRecurringTemplate } from '../features/family-calendar/useRecurringTemplates';
import { FAMILY_CATEGORIES, WEEKDAY_OPTIONS } from '../features/family-calendar/constants';
import type { FamilyCategory } from '../features/family-calendar/recurringOccurrences';

export default function AddRecurringTemplateScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FamilyCategory>('altro');
  const [person, setPerson] = useState('Francesca');
  const [weekday, setWeekday] = useState<number | null>(null);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const createTemplate = useCreateRecurringTemplate();

  const handleSubmit = () => {
    if (!title.trim() || !person.trim() || weekday === null) return;
    createTemplate.mutate(
      { title: title.trim(), category, person: person.trim(), weekday, time: time.trim() || undefined, note: note.trim() || undefined },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nuovo impegno ricorrente</Text>
      <TextInput style={styles.input} placeholder="Titolo (es. Piscina)" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.optionsRow}>
        {FAMILY_CATEGORIES.map((c) => (
          <Pressable
            key={c.value}
            style={[styles.option, category === c.value && styles.optionSelected]}
            onPress={() => setCategory(c.value)}
          >
            <Text>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Persona (es. Francesca)" value={person} onChangeText={setPerson} />

      <Text style={styles.label}>Giorno della settimana</Text>
      <View style={styles.optionsRow}>
        {WEEKDAY_OPTIONS.map((w) => (
          <Pressable
            key={w.value}
            style={[styles.option, weekday === w.value && styles.optionSelected]}
            onPress={() => setWeekday(w.value)}
          >
            <Text>{w.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Orario (HH:MM, opzionale)" value={time} onChangeText={setTime} />
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {createTemplate.isError && <Text style={styles.error}>{(createTemplate.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createTemplate.isPending}>
        <Text style={styles.buttonText}>{createTemplate.isPending ? 'Salvataggio...' : 'Salva'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 5: Scrivi `src/app/edit-recurring-template.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useDeleteRecurringTemplate, useRecurringTemplates, useUpdateRecurringTemplate } from '../features/family-calendar/useRecurringTemplates';
import { FAMILY_CATEGORIES, WEEKDAY_OPTIONS } from '../features/family-calendar/constants';
import type { FamilyCategory } from '../features/family-calendar/recurringOccurrences';

export default function EditRecurringTemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: templates } = useRecurringTemplates();
  const template = templates?.find((t) => t.id === id);
  const updateTemplate = useUpdateRecurringTemplate();
  const deleteTemplate = useDeleteRecurringTemplate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FamilyCategory>('altro');
  const [person, setPerson] = useState('');
  const [weekday, setWeekday] = useState<number | null>(null);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setCategory(template.category);
      setPerson(template.person);
      setWeekday(template.weekday);
      setTime(template.time ?? '');
      setNote(template.note ?? '');
    }
  }, [template?.id]);

  if (!template) return <Text style={styles.padded}>Impegno non trovato.</Text>;

  const handleSave = () => {
    if (!title.trim() || !person.trim() || weekday === null) return;
    updateTemplate.mutate(
      { id: template.id, title: title.trim(), category, person: person.trim(), weekday, time: time.trim() || undefined, note: note.trim() || undefined },
      { onSuccess: () => router.back() }
    );
  };

  const handleDelete = () => {
    deleteTemplate.mutate(template.id, { onSuccess: () => router.back() });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Modifica impegno ricorrente</Text>
      <TextInput style={styles.input} placeholder="Titolo" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.optionsRow}>
        {FAMILY_CATEGORIES.map((c) => (
          <Pressable
            key={c.value}
            style={[styles.option, category === c.value && styles.optionSelected]}
            onPress={() => setCategory(c.value)}
          >
            <Text>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Persona" value={person} onChangeText={setPerson} />

      <Text style={styles.label}>Giorno della settimana</Text>
      <View style={styles.optionsRow}>
        {WEEKDAY_OPTIONS.map((w) => (
          <Pressable
            key={w.value}
            style={[styles.option, weekday === w.value && styles.optionSelected]}
            onPress={() => setWeekday(w.value)}
          >
            <Text>{w.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Orario (HH:MM, opzionale)" value={time} onChangeText={setTime} />
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {updateTemplate.isError && <Text style={styles.error}>{(updateTemplate.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSave} disabled={updateTemplate.isPending}>
        <Text style={styles.buttonText}>Salva</Text>
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleteTemplate.isPending}>
        <Text style={styles.deleteButtonText}>Elimina impegno ricorrente</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  padded: { padding: 24 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteButtonText: { color: '#dc2626', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 6: Verifica**

Run: `npx tsc --noEmit` (sequenza anti-stale-router-types) — pulito.

Manuale (lettura del codice, nessun browser disponibile): conferma che `add-recurring-template.tsx` e `edit-recurring-template.tsx` importino gli stessi `FAMILY_CATEGORIES`/`WEEKDAY_OPTIONS`, che `edit-recurring-template.tsx` trovi il template tramite `useLocalSearchParams<{id}>()` + `.find()` sullo stesso pattern di `edit-client.tsx`, e che il bottone "+ Impegno" in `impostazioni.tsx` navighi alla rotta corretta.

- [ ] **Step 7: Commit**

```bash
git add src/features/family-calendar/constants.ts src/features/family-calendar/useRecurringTemplates.ts src/app/add-recurring-template.tsx src/app/edit-recurring-template.tsx "src/app/(tabs)/impostazioni.tsx"
git commit -m "feat: add recurring template management (list, create, edit, delete)"
```

---

### Task 5: Eventi calendario — hook + dettaglio giorno familiare + form evento

**Files:**
- Create: `src/features/family-calendar/useCalendarEvents.ts`
- Create: `src/app/family-day/[date].tsx`
- Create: `src/app/add-family-event.tsx`
- Create: `src/app/edit-family-event.tsx`

**Interfaces:**
- Consumes: `CalendarEvent`/`expandOccurrences` (Task 3), `useRecurringTemplates()` (Task 4)
- Produces: `useAllCalendarEvents()`, `useCreateCalendarEvent()`, `useUpdateCalendarEvent()`, `useDeleteCalendarEvent()`, `useUpsertOccurrenceOverride()` — usati dal Task 6 (notifiche) e dal Task 7 (tab Calendario)

- [ ] **Step 1: Scrivi `src/features/family-calendar/useCalendarEvents.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import type { CalendarEvent, FamilyCategory } from './recurringOccurrences';

export function useAllCalendarEvents() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['calendar-events', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, recurring_template_id, title, category, person, date, time, note, is_cancelled')
        .eq('household_id', householdId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });
}

export function useCreateCalendarEvent() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      category: FamilyCategory;
      person: string;
      date: string;
      time?: string;
      note?: string;
    }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          household_id: household.id,
          recurring_template_id: null,
          title: input.title,
          category: input.category,
          person: input.person,
          date: input.date,
          time: input.time || null,
          note: input.note || null,
        })
        .select('id, recurring_template_id, title, category, person, date, time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      category: FamilyCategory;
      person: string;
      date: string;
      time?: string;
      note?: string;
    }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update({
          title: input.title,
          category: input.category,
          person: input.person,
          date: input.date,
          time: input.time || null,
          note: input.note || null,
        })
        .eq('id', input.id)
        .select('id, recurring_template_id, title, category, person, date, time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}

/** Crea o aggiorna l'eccezione per una specifica occorrenza (recurring_template_id + date), sfruttando il vincolo unique della migrazione 0006. */
export function useUpsertOccurrenceOverride() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      recurringTemplateId: string;
      date: string;
      title: string;
      category: FamilyCategory;
      person: string;
      time?: string;
      note?: string;
      isCancelled: boolean;
    }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('calendar_events')
        .upsert(
          {
            household_id: household.id,
            recurring_template_id: input.recurringTemplateId,
            date: input.date,
            title: input.title,
            category: input.category,
            person: input.person,
            time: input.time || null,
            note: input.note || null,
            is_cancelled: input.isCancelled,
          },
          { onConflict: 'recurring_template_id,date' }
        )
        .select('id, recurring_template_id, title, category, person, date, time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });
}
```

- [ ] **Step 2: Scrivi `src/app/family-day/[date].tsx`**

```tsx
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { useAllCalendarEvents, useUpsertOccurrenceOverride } from '../../features/family-calendar/useCalendarEvents';
import { expandOccurrences } from '../../features/family-calendar/recurringOccurrences';
import { formatDayLabel } from '../../features/calendar/calendarGrid';
import { FAMILY_CATEGORIES } from '../../features/family-calendar/constants';

export default function FamilyDayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: templates } = useRecurringTemplates();
  const { data: events } = useAllCalendarEvents();
  const skipOccurrence = useUpsertOccurrenceOverride();

  const occurrences = expandOccurrences(templates ?? [], events ?? [], { start: date, end: date });
  const categoryLabel = (value: string) => FAMILY_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  const handleSkip = (occurrence: (typeof occurrences)[number]) => {
    if (!occurrence.recurringTemplateId) return;
    skipOccurrence.mutate({
      recurringTemplateId: occurrence.recurringTemplateId,
      date: occurrence.date,
      title: occurrence.title,
      category: occurrence.category,
      person: occurrence.person,
      time: occurrence.time ?? undefined,
      note: occurrence.note ?? undefined,
      isCancelled: true,
    });
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Indietro</Text>
      </Pressable>
      <Text style={styles.title}>{formatDayLabel(date)}</Text>

      <FlatList
        style={{ flex: 1 }}
        data={occurrences}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.rowMain}
              onPress={() =>
                router.push(
                  item.recurringTemplateId
                    ? { pathname: '/edit-family-event', params: { recurringTemplateId: item.recurringTemplateId, date: item.date } }
                    : { pathname: '/edit-family-event', params: { id: item.id } }
                )
              }
            >
              <Text style={styles.rowTitle}>{item.title} — {item.person}</Text>
              <Text style={styles.rowMeta}>{categoryLabel(item.category)}{item.time ? ` · ${item.time}` : ''}</Text>
            </Pressable>
            {item.recurringTemplateId && (
              <Pressable onPress={() => handleSkip(item)} disabled={skipOccurrence.isPending}>
                <Text style={styles.skipLink}>Salta oggi</Text>
              </Pressable>
            )}
          </View>
        )}
        ListEmptyComponent={<Text>Nessun impegno in questo giorno.</Text>}
      />

      <Pressable
        style={styles.addButton}
        onPress={() => router.push({ pathname: '/add-family-event', params: { date } })}
      >
        <Text style={styles.addButtonText}>+ Evento</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  back: { color: '#2563eb', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowMain: { flex: 1 },
  rowTitle: { fontWeight: '600' },
  rowMeta: { color: '#6b7280' },
  skipLink: { color: '#dc2626', marginLeft: 8 },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  addButtonText: { color: 'white', fontWeight: '600' },
});
```

- [ ] **Step 3: Scrivi `src/app/add-family-event.tsx`**

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateCalendarEvent } from '../features/family-calendar/useCalendarEvents';
import { FAMILY_CATEGORIES } from '../features/family-calendar/constants';
import { toLocalDateString } from '../lib/dates';
import type { FamilyCategory } from '../features/family-calendar/recurringOccurrences';

export default function AddFamilyEventScreen() {
  const { date: preselectedDate } = useLocalSearchParams<{ date?: string }>();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FamilyCategory>('altro');
  const [person, setPerson] = useState('Francesca');
  const [date, setDate] = useState(preselectedDate ?? toLocalDateString(new Date()));
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const createEvent = useCreateCalendarEvent();

  const handleSubmit = () => {
    if (!title.trim() || !person.trim() || !date.trim()) return;
    createEvent.mutate(
      { title: title.trim(), category, person: person.trim(), date: date.trim(), time: time.trim() || undefined, note: note.trim() || undefined },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nuovo evento</Text>
      <TextInput style={styles.input} placeholder="Titolo" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.optionsRow}>
        {FAMILY_CATEGORIES.map((c) => (
          <Pressable
            key={c.value}
            style={[styles.option, category === c.value && styles.optionSelected]}
            onPress={() => setCategory(c.value)}
          >
            <Text>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Persona" value={person} onChangeText={setPerson} />
      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput style={styles.input} placeholder="Orario (HH:MM, opzionale)" value={time} onChangeText={setTime} />
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {createEvent.isError && <Text style={styles.error}>{(createEvent.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createEvent.isPending}>
        <Text style={styles.buttonText}>{createEvent.isPending ? 'Salvataggio...' : 'Salva'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 4: Scrivi `src/app/edit-family-event.tsx`**

Gestisce due casi distinti in base ai parametri ricevuti: `id` presente → modifica di un evento manuale reale (`useUpdateCalendarEvent`/`useDeleteCalendarEvent`); `recurringTemplateId`+`date` presenti senza `id` → modifica puntuale di un'occorrenza ricorrente (`useUpsertOccurrenceOverride`), precompilata dall'eccezione esistente se c'è già, altrimenti dal modello stesso.

```tsx
import { useEffect, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  useAllCalendarEvents,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
  useUpsertOccurrenceOverride,
} from '../features/family-calendar/useCalendarEvents';
import { useRecurringTemplates } from '../features/family-calendar/useRecurringTemplates';
import { FAMILY_CATEGORIES } from '../features/family-calendar/constants';
import type { FamilyCategory } from '../features/family-calendar/recurringOccurrences';

export default function EditFamilyEventScreen() {
  const { id, recurringTemplateId, date } = useLocalSearchParams<{ id?: string; recurringTemplateId?: string; date?: string }>();
  const { data: events } = useAllCalendarEvents();
  const { data: templates } = useRecurringTemplates();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const upsertOverride = useUpsertOccurrenceOverride();

  const isOverrideMode = !id && !!recurringTemplateId && !!date;
  const manualEvent = id ? events?.find((e) => e.id === id) : undefined;
  const existingOverride = isOverrideMode ? events?.find((e) => e.recurring_template_id === recurringTemplateId && e.date === date) : undefined;
  const template = isOverrideMode ? templates?.find((t) => t.id === recurringTemplateId) : undefined;

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FamilyCategory>('altro');
  const [person, setPerson] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    if (manualEvent) {
      setTitle(manualEvent.title);
      setCategory(manualEvent.category);
      setPerson(manualEvent.person);
      setTime(manualEvent.time ?? '');
      setNote(manualEvent.note ?? '');
      setLoaded(true);
    } else if (isOverrideMode && (existingOverride || template)) {
      const source = existingOverride ?? template!;
      setTitle(source.title);
      setCategory(source.category);
      setPerson(source.person);
      setTime(source.time ?? '');
      setNote(source.note ?? '');
      setLoaded(true);
    }
  }, [manualEvent?.id, existingOverride?.id, template?.id, loaded, isOverrideMode]);

  if (!manualEvent && !isOverrideMode) return <Text style={styles.padded}>Evento non trovato.</Text>;
  if (isOverrideMode && !template) return <Text style={styles.padded}>Caricamento...</Text>;

  const handleSave = () => {
    if (!title.trim() || !person.trim()) return;
    if (manualEvent) {
      updateEvent.mutate(
        { id: manualEvent.id, title: title.trim(), category, person: person.trim(), date: manualEvent.date, time: time.trim() || undefined, note: note.trim() || undefined },
        { onSuccess: () => router.back() }
      );
    } else if (recurringTemplateId && date) {
      upsertOverride.mutate(
        { recurringTemplateId, date, title: title.trim(), category, person: person.trim(), time: time.trim() || undefined, note: note.trim() || undefined, isCancelled: false },
        { onSuccess: () => router.back() }
      );
    }
  };

  const handleDelete = () => {
    if (manualEvent) {
      deleteEvent.mutate(manualEvent.id, { onSuccess: () => router.back() });
    }
  };

  const isPending = updateEvent.isPending || upsertOverride.isPending;
  const error = (updateEvent.error ?? upsertOverride.error) as Error | null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{manualEvent ? 'Modifica evento' : 'Modifica solo questo giorno'}</Text>
      <TextInput style={styles.input} placeholder="Titolo" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.optionsRow}>
        {FAMILY_CATEGORIES.map((c) => (
          <Pressable
            key={c.value}
            style={[styles.option, category === c.value && styles.optionSelected]}
            onPress={() => setCategory(c.value)}
          >
            <Text>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Persona" value={person} onChangeText={setPerson} />
      <TextInput style={styles.input} placeholder="Orario (HH:MM, opzionale)" value={time} onChangeText={setTime} />
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {error && <Text style={styles.error}>{error.message}</Text>}
      <Pressable style={styles.button} onPress={handleSave} disabled={isPending}>
        <Text style={styles.buttonText}>Salva</Text>
      </Pressable>
      {manualEvent && (
        <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleteEvent.isPending}>
          <Text style={styles.deleteButtonText}>Elimina evento</Text>
        </Pressable>
      )}
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  padded: { padding: 24 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  label: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteButtonText: { color: '#dc2626', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 5: Verifica**

Run: `npx tsc --noEmit` (sequenza anti-stale-router-types) — pulito.

Manuale (lettura del codice): traccia a mano il percorso "tocca un'occorrenza ricorrente in `family-day/[date].tsx`" → naviga a `/edit-family-event` con `recurringTemplateId`+`date` (mai `id`) → `edit-family-event.tsx` riconosce `isOverrideMode`, precompila da `existingOverride ?? template`, salva con `useUpsertOccurrenceOverride`. Traccia separatamente "tocca un evento manuale" → naviga con `id` → precompila da `manualEvent`, salva con `useUpdateCalendarEvent`. Conferma che "Salta oggi" in `family-day/[date].tsx` passi sempre `recurringTemplateId` (mai per eventi manuali, dove il bottone non compare).

- [ ] **Step 6: Commit**

```bash
git add src/features/family-calendar/useCalendarEvents.ts src/app/family-day src/app/add-family-event.tsx src/app/edit-family-event.tsx
git commit -m "feat: add calendar event management and family day detail screen"
```

---

### Task 6: Notifiche locali — permesso, promemoria, sweep automatico

**Files:**
- Create: `src/features/notifications/permissions.ts`
- Create: `src/features/notifications/notificationStore.ts`
- Create: `src/features/notifications/syncReminders.ts`
- Create: `src/features/family-calendar/useSyncRecurringReminders.ts`
- Modify: `src/features/family-calendar/useCalendarEvents.ts` (wiring del promemoria nelle mutation)
- Modify: `src/app/_layout.tsx` (monta lo sweep)
- Modify: `app.json` (plugin `expo-notifications`)
- Modify: `package.json` (nuova dipendenza)

**Interfaces:**
- Consumes: `reminderDateTime`, `isFutureReminder` (Task 3), `useRecurringTemplates()` (Task 4), `useAllCalendarEvents()` (Task 5), `nextOccurrenceDate` (Task 3)
- Produces: `ensureNotificationPermission()`, `syncReminderFor(key, title, body, date, time)`, `cancelReminderFor(key)`, `useSyncRecurringReminders()` — usati dal Task 7 solo indirettamente (lo sweep è già montato globalmente da questo task)

- [ ] **Step 1: Installa la dipendenza**

```bash
npx expo install expo-notifications
```

Expected: `expo-notifications` aggiunto a `package.json` con la versione compatibile SDK 57 (gestita da `expo install`, non fissare una versione a mano).

- [ ] **Step 2: Aggiungi il plugin in `app.json`**

Nel blocco `"plugins"` esistente, aggiungi `"expo-notifications"` come nuova voce dell'array (accanto a `"expo-router"` e `"expo-splash-screen"`):

```json
    "plugins": [
      "expo-router",
      "expo-notifications",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#208AEF",
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 76
        }
      ]
    ],
```

- [ ] **Step 3: Scrivi `src/features/notifications/permissions.ts`**

API verificata contro la documentazione Expo SDK 57 (`https://docs.expo.dev/versions/v57.0.0/sdk/notifications/`) — non usare la sintassi dei trigger di versioni precedenti.

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let permissionChecked = false;
let permissionGranted = false;

/** Richiede il permesso di notifica una sola volta per sessione app; se negato o non supportato, l'app resta pienamente funzionante senza promemoria. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;
  permissionChecked = true;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Promemoria',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    permissionGranted = status === 'granted';
  } catch {
    permissionGranted = false;
  }
  return permissionGranted;
}
```

- [ ] **Step 4: Scrivi `src/features/notifications/notificationStore.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'reminder:';

export interface StoredReminder {
  notificationId: string;
  forDate: string;
}

export async function getStoredReminder(key: string): Promise<StoredReminder | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
  return raw ? (JSON.parse(raw) as StoredReminder) : null;
}

export async function setStoredReminder(key: string, reminder: StoredReminder): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(reminder));
}

export async function clearStoredReminder(key: string): Promise<void> {
  await AsyncStorage.removeItem(KEY_PREFIX + key);
}
```

- [ ] **Step 5: Scrivi `src/features/notifications/syncReminders.ts`**

```typescript
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
```

- [ ] **Step 6: Aggiungi il wiring del promemoria alle mutation in `src/features/family-calendar/useCalendarEvents.ts`**

Aggiungi l'import in cima al file:

```typescript
import { cancelReminderFor, syncReminderFor } from '../notifications/syncReminders';
```

In `useCreateCalendarEvent`, sostituisci l'`onSuccess` esistente:

```typescript
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      syncReminderFor(`event:${data.id}`, `Promemoria: ${data.title}`, `${data.person} — domani`, data.date, data.time);
    },
```

In `useUpdateCalendarEvent`, sostituisci l'`onSuccess` esistente allo stesso modo:

```typescript
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      syncReminderFor(`event:${data.id}`, `Promemoria: ${data.title}`, `${data.person} — domani`, data.date, data.time);
    },
```

In `useDeleteCalendarEvent`, sostituisci l'`onSuccess` esistente:

```typescript
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      cancelReminderFor(`event:${id}`);
    },
```

In `useUpsertOccurrenceOverride`, sostituisci l'`onSuccess` esistente — se l'eccezione cancella l'occorrenza (`is_cancelled`) non ha senso un promemoria per essa, quindi si cancella invece di schedulare:

```typescript
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      if (data.is_cancelled) {
        cancelReminderFor(`event:${data.id}`);
      } else {
        syncReminderFor(`event:${data.id}`, `Promemoria: ${data.title}`, `${data.person} — domani`, data.date, data.time);
      }
    },
```

- [ ] **Step 7: Scrivi `src/features/family-calendar/useSyncRecurringReminders.ts`**

```typescript
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
```

- [ ] **Step 8: Monta lo sweep in `src/app/_layout.tsx`**

Aggiungi l'import in cima al file:

```typescript
import { useSyncRecurringReminders } from '../features/family-calendar/useSyncRecurringReminders';
```

Dentro `AuthGate`, subito dopo la riga `const { data: household, isLoading: householdLoading } = useHousehold();`, aggiungi:

```typescript
  useSyncRecurringReminders();
```

(L'hook stesso è già una no-op finché `templates` non è caricato — `useRecurringTemplates()` è `enabled: !!householdId` — quindi è sicuro montarlo incondizionatamente qui, anche prima che l'utente abbia effettuato il login o creato un household.)

- [ ] **Step 9: Verifica**

Run: `npx tsc --noEmit` (sequenza anti-stale-router-types, dato che questo task modifica `_layout.tsx`) — pulito.
Run: `npx jest --testPathIgnorePatterns=tests/rls` — nessuna regressione (nessun nuovo test in questo task: la logica pura è già coperta dal Task 3, questo task è integrazione con un SDK nativo non simulabile in Jest).

Manuale (lettura del codice): conferma che `syncReminderFor`/`cancelReminderFor` non lancino mai un'eccezione non gestita che possa rompere il flusso delle mutation (`try/catch` presente sia in `permissions.ts` sia in `syncReminders.ts`); conferma che `useSyncRecurringReminders` non giri in loop infinito (l'effect dipende da `[templates, events]`, che cambiano solo quando le query TanStack li invalidano — non c'è uno stato locale che l'effect stesso modifica).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json app.json src/features/notifications src/features/family-calendar/useSyncRecurringReminders.ts src/features/family-calendar/useCalendarEvents.ts src/app/_layout.tsx
git commit -m "feat: add local notification reminders for family calendar events"
```

---

### Task 7: Tab Calendario — toggle Lavoro | Francesca

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `CalendarView` (blocco precedente), `useRecurringTemplates()`/`useAllCalendarEvents()`/`expandOccurrences` (Task 4/5/3)
- Produces: tab Calendario con toggle Lavoro/Francesca funzionante

- [ ] **Step 1: Riscrivi `src/app/(tabs)/index.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { CalendarView } from '../../components/CalendarView';
import { useAllWorkSessionsStatus } from '../../features/work-sessions/useWorkSessions';
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { useAllCalendarEvents } from '../../features/family-calendar/useCalendarEvents';
import { expandOccurrences } from '../../features/family-calendar/recurringOccurrences';
import { addDays, toLocalDateString } from '../../lib/dates';

type CalendarSection = 'lavoro' | 'francesca';

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

function FamilyDayIndicator({ count }: { count: number }) {
  if (count === 0) return null;
  return <View style={styles.familyDot} />;
}

export default function CalendarioScreen() {
  const [section, setSection] = useState<CalendarSection>('lavoro');

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

  const { data: templates } = useRecurringTemplates();
  const { data: events } = useAllCalendarEvents();
  const occurrenceCountByDate = useMemo(() => {
    const today = toLocalDateString(new Date());
    const range = { start: addDays(today, -90), end: addDays(today, 365) };
    const occurrences = expandOccurrences(templates ?? [], events ?? [], range);
    const map = new Map<string, number>();
    for (const o of occurrences) {
      map.set(o.date, (map.get(o.date) ?? 0) + 1);
    }
    return map;
  }, [templates, events]);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Calendario</Text>

      <View style={styles.sectionToggle}>
        <Pressable
          style={[styles.sectionButton, section === 'lavoro' && styles.sectionButtonActive]}
          onPress={() => setSection('lavoro')}
        >
          <Text style={section === 'lavoro' ? styles.sectionTextActive : styles.sectionText}>Lavoro</Text>
        </Pressable>
        <Pressable
          style={[styles.sectionButton, section === 'francesca' && styles.sectionButtonActive]}
          onPress={() => setSection('francesca')}
        >
          <Text style={section === 'francesca' ? styles.sectionTextActive : styles.sectionText}>Francesca</Text>
        </Pressable>
      </View>

      {section === 'lavoro' ? (
        <CalendarView
          key="lavoro"
          initialView="week"
          renderDay={(date) => {
            const status = statusByDate.get(date);
            return <DayStatusIndicator hasPaid={status?.hasPaid ?? false} hasUnpaid={status?.hasUnpaid ?? false} />;
          }}
          onDayPress={(date) => router.push(`/day/${date}`)}
        />
      ) : (
        <CalendarView
          key="francesca"
          initialView="week"
          renderDay={(date) => <FamilyDayIndicator count={occurrenceCountByDate.get(date) ?? 0} />}
          onDayPress={(date) => router.push(`/family-day/${date}`)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  sectionToggle: { flexDirection: 'row', gap: 8 },
  sectionButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, alignItems: 'center' },
  sectionButtonActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  sectionText: { color: '#374151' },
  sectionTextActive: { color: '#2563eb', fontWeight: '600' },
  statusIndicator: { flex: 1, minHeight: 16, borderRadius: 4, marginTop: 2, overflow: 'hidden' },
  statusHalf: { flex: 1 },
  familyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb', alignSelf: 'center', marginTop: 4 },
});
```

Nota sul `key="lavoro"`/`key="francesca"` sui due `CalendarView`: forza React a smontare/rimontare il componente quando si cambia sezione, cosicché lo stato interno di vista/data-ancora di `CalendarView` non venga condiviso né confuso tra Lavoro e Francesca — altrimenti passare da Lavoro (magari navigato a un mese futuro) a Francesca manterrebbe la stessa vista/anchor invece di ripartire dalla settimana corrente, comportamento sorprendente per l'utente.

- [ ] **Step 2: Verifica manuale end-to-end**

Run: `npx expo start --web` (poi la sequenza anti-stale-router-types per un `tsc` pulito prima di procedere).

Percorso di verifica (lettura attenta del codice + eventuali dati creati/verificati con l'app in esecuzione, nessun click-through in browser disponibile in questo ambiente):
1. Da Impostazioni, crea un impegno ricorrente (es. "Piscina", categoria piscina, persona Francesca, martedì, 17:00).
2. Apri il tab Calendario, verifica che il toggle mostri "Lavoro" selezionato di default e che passando a "Francesca" la vista si resetti alla settimana corrente (per via del `key` diverso).
3. Verifica che nei martedì della vista compaia il pallino blu (occorrenza generata dal modello, mai materializzata in tabella).
4. Tocca un martedì con l'occorrenza, verifica che `/family-day/<data>` mostri "Piscina — Francesca", tocca "Salta oggi", verifica che l'occorrenza scompaia da quel giorno ma resti nei martedì successivi.
5. Su un altro martedì, tocca l'occorrenza e poi "Modifica solo questo giorno"; cambia l'orario, salva; torna al calendario e riapri lo stesso giorno, verifica che il nuovo orario sia salvato solo per quella data (gli altri martedì restano invariati).
6. Da `/family-day/<data>`, tocca "+ Evento", crea un evento manuale (es. "Visita medica"); verifica che compaia nella lista di quel giorno insieme all'eventuale occorrenza ricorrente dello stesso giorno, e che offra "Modifica"/"Elimina" invece di "Salta oggi".

- [ ] **Step 3: Esegui l'intera suite e verifica tipi**

Run: `npx jest --testPathIgnorePatterns=tests/rls`
Expected: tutti PASS.

Run: `npx tsc --noEmit` (sequenza anti-stale-router-types)
Expected: pulito.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "feat: add Lavoro/Francesca toggle to Calendario tab"
```

---

## Al termine di questo piano

Deliverable funzionante e testabile: tab Calendario con toggle Lavoro/Francesca, calendario familiare con impegni ricorrenti gestiti da Impostazioni, eccezioni puntuali (salta/modifica solo un giorno) dal dettaglio giorno, eventi manuali indipendenti, e promemoria locali (giorno prima, 20:00) sia per gli eventi salvati sia per la prossima occorrenza futura di ogni impegno ricorrente attivo, con permesso OS gestito in modo da non bloccare mai l'app se negato. `CalendarView` è stato riusato senza modifiche, confermando la sua natura parametrica. Prossimo blocco: **Spese mensili**.
