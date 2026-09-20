# Blocco B — Piano 1: Schema orari e form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere orario di inizio/fine a giornate lavorate (`work_sessions`) e impegni di Francesca (`recurring_templates`/`calendar_events`, sostituendo il singolo campo `time`), con i form di aggiunta/modifica aggiornati per richiederli — la base dati su cui il Piano 2 (griglia oraria del Calendario) e il Piano 3 (Pagamenti) si appoggeranno. Nessuna ristilizzazione visiva in questo piano: i nuovi campi usano lo stesso stile `TextInput` già in uso in ogni form.

**Architecture:** Colonne nullable (i dati storici non hanno alcun orario da cui derivarle) con un vincolo di coerenza incrociata (`start_time`/`end_time` entrambi null o entrambi valorizzati) e un vincolo d'ordine (`end_time > start_time`), stesso pattern già usato per `expenses.francesca_activity`. "Obbligatorio per i nuovi inserimenti" è una regola di validazione nei form, non un `NOT NULL` a livello di database. Validazione formato/ordine orario centralizzata in due funzioni pure testate (`src/lib/dates.ts`), riusate da tutti e 5 i form invece di duplicare una regex.

**Tech Stack:** Stesso stack dei blocchi precedenti — Expo Router, TypeScript, `@supabase/supabase-js` con tipi generati, TanStack Query, Jest. Nessuna nuova dipendenza.

**Spec:** `docs/superpowers/specs/2026-09-20-blocco-b-calendario-pagamenti-design.md` (sezioni 2, 6.1)

## Global Constraints

- **Colonne nullable, mai `NOT NULL`**: le righe storiche di `work_sessions` non hanno alcun orario; le righe storiche di `recurring_templates`/`calendar_events` con `time is null` restano `start_time`/`end_time` entrambi null dopo la migrazione. "Obbligatorio" vale solo lato form per i nuovi inserimenti/modifiche, mai come vincolo DB.
- **Vincoli di coerenza incrociata su ogni tabella toccata**: `check ((start_time is null) = (end_time is null))` e `check (start_time is null or end_time > start_time)` — stesso principio già usato per `expenses.francesca_activity` nel blocco Spese mensili.
- **Backfill Francesca a +30 minuti**: le occorrenze con `time` già valorizzato ottengono `end_time = start_time + interval '30 minutes'` in un `update` dentro la stessa migrazione — deciso con l'utente in brainstorming.
- **Validazione formato/ordine orario centralizzata**: `isValidTimeFormat(value: string): boolean` (HH:MM, 00-23:00-59) e `isEndAfterStart(start: string, end: string): boolean` in `src/lib/dates.ts`, con test — riusate identiche in tutti e 5 i form (`add-work-session.tsx`, `add-family-event.tsx`, `edit-family-event.tsx`, `add-recurring-template.tsx`, `edit-recurring-template.tsx`). Mai una regex duplicata form per form.
- **Validazione "obbligatorio" a livello di form, mai di hook**: gli hook (`useCreateCalendarEvent`, `useUpdateCalendarEvent`, `useUpsertOccurrenceOverride`, `useCreateRecurringTemplate`, `useUpdateRecurringTemplate`) accettano `startTime`/`endTime` **opzionali** (rispecchiano la colonna DB nullable) — è il form a rifiutarsi di chiamare `mutate` se mancanti/non validi, tranne il flusso "Salta oggi" (`family-day/[date].tsx`) che non è un form e passa semplicemente attraverso l'orario esistente dell'occorrenza, invariato. **Eccezione:** `useCreateWorkSession` richiede `startTime`/`endTime` obbligatori nel tipo stesso (non opzionali) perché non esiste alcuno schermo di modifica di una giornata lavorata — l'unico punto di inserimento è `add-work-session.tsx`, quindi la regola "obbligatorio per i nuovi inserimenti" può essere applicata direttamente nel tipo.
- **Nessuna ristilizzazione**: i nuovi campi orario usano esattamente gli stessi stili `input`/`error`/`button` già presenti in ciascun form toccato — la ristilizzazione visiva del Calendario è il Piano 2, di Pagamenti il Piano 3.
- Dopo ogni migrazione, rigenerare `src/lib/database.types.ts` (`npx supabase gen types typescript --project-id qivxrbhbffwqqmaadpnl > src/lib/database.types.ts`).
- **Verifica route:** per ogni task che modifica un file sotto `src/app/`, usare la sequenza anti-stale-router-types (avvia `npx expo start --web --port <N>` in background → attendi `"Waiting on http://..."` → `curl` per forzare un bundle reale → attendi qualche secondo → `npx tsc --noEmit` → killa il server). Per task che toccano solo `src/lib/`/`src/features/`, un `npx tsc --noEmit` semplice basta.
- Questo ambiente di esecuzione non ha strumenti di browser headless/interattivo — verifica manuale tramite lettura del codice, non click-through.

---

### Task 1: Helper puri di validazione orario (TDD)

**Files:**
- Modify: `src/lib/dates.ts`
- Modify: `src/lib/dates.test.ts`

**Interfaces:**
- Consumes: niente (funzioni pure, nessuna dipendenza da schema/hook)
- Produces: `isValidTimeFormat(value: string): boolean`, `isEndAfterStart(start: string, end: string): boolean` da `dates.ts` — usati dal Task 2 (`add-work-session.tsx`) e dal Task 3 (5 form Francesca)

- [ ] **Step 1: Scrivi i test in `src/lib/dates.test.ts` (TDD)**

Aggiungi in fondo al file esistente, e aggiorna l'import in cima:

```typescript
import { addDays, endOfMonth, isEndAfterStart, isValidTimeFormat, parseLocalDateString, shiftMonth, startOfMonth, toLocalDateString } from './dates';
```

```typescript
describe('isValidTimeFormat', () => {
  it('accepts a valid zero-padded time', () => {
    expect(isValidTimeFormat('09:30')).toBe(true);
  });

  it('accepts the last valid hour/minute', () => {
    expect(isValidTimeFormat('23:59')).toBe(true);
  });

  it('accepts midnight', () => {
    expect(isValidTimeFormat('00:00')).toBe(true);
  });

  it('rejects an hour of 24 or more', () => {
    expect(isValidTimeFormat('24:00')).toBe(false);
  });

  it('rejects a minute of 60 or more', () => {
    expect(isValidTimeFormat('09:60')).toBe(false);
  });

  it('rejects a non-zero-padded hour', () => {
    expect(isValidTimeFormat('9:30')).toBe(false);
  });

  it('rejects garbage input', () => {
    expect(isValidTimeFormat('not a time')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidTimeFormat('')).toBe(false);
  });
});

describe('isEndAfterStart', () => {
  it('is true when end is later than start', () => {
    expect(isEndAfterStart('09:00', '10:00')).toBe(true);
  });

  it('is false when end equals start', () => {
    expect(isEndAfterStart('09:00', '09:00')).toBe(false);
  });

  it('is false when end is before start', () => {
    expect(isEndAfterStart('10:00', '09:00')).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/lib/dates.test.ts`
Expected: FAIL — `isValidTimeFormat`/`isEndAfterStart` non esistono ancora.

- [ ] **Step 3: Aggiungi gli helper a `src/lib/dates.ts`**

Aggiungi in fondo al file esistente:

```typescript
export function isValidTimeFormat(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isEndAfterStart(start: string, end: string): boolean {
  return end > start;
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/lib/dates.test.ts`
Expected: PASS, tutti i test compresi quelli preesistenti.

- [ ] **Step 5: Verifica**

Run: `npx tsc --noEmit` (nessuna rotta toccata).
Expected: pulito.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat: add pure time-format and time-order validation helpers"
```

---

### Task 2: Orario giornate lavorate (`work_sessions`)

**Files:**
- Create: `supabase/migrations/0009_work_session_times.sql`
- Modify: `src/lib/database.types.ts` (rigenerato dalla CLI)
- Modify: `src/features/work-sessions/useWorkSessions.ts`
- Modify: `src/app/add-work-session.tsx`

**Interfaces:**
- Consumes: `isValidTimeFormat`, `isEndAfterStart` (Task 1)
- Produces: `WorkSession.start_time`/`WorkSession.end_time` (nullable), `useCreateWorkSession({ clientId, date, hours, rateSnapshot, startTime, endTime, note })` con `startTime`/`endTime` obbligatori — nessuna interfaccia consumata da task successivi di questo piano (il Piano 2 leggerà questi campi da un piano separato)

- [ ] **Step 1: Scrivi la migrazione `supabase/migrations/0009_work_session_times.sql`**

```sql
-- Orario di inizio/fine per le giornate lavorate. Nullable: le righe già
-- esistenti non hanno alcun dato di orario da cui derivarlo — "obbligatorio
-- per i nuovi inserimenti" è applicato lato form (add-work-session.tsx),
-- non con un NOT NULL che romperebbe le righe storiche.

alter table work_sessions
  add column start_time time,
  add column end_time time,
  add constraint work_sessions_time_pair check (
    (start_time is null) = (end_time is null)
  ),
  add constraint work_sessions_time_order check (
    start_time is null or end_time > start_time
  );
```

- [ ] **Step 2: Applica la migrazione**

```bash
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env | cut -d '=' -f2)
npx supabase db push
npx supabase migration list
```

Expected: `0009_work_session_times.sql` applicata, `migration list` mostra `remote` allineato fino a `0009`. Non stampare mai il valore del token.

- [ ] **Step 3: Rigenera i tipi TypeScript**

```bash
npx supabase gen types typescript --project-id qivxrbhbffwqqmaadpnl > src/lib/database.types.ts
```

- [ ] **Step 4: Modifica `src/features/work-sessions/useWorkSessions.ts`**

Contenuto completo del file dopo la modifica:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';

export interface WorkSession {
  id: string;
  client_id: string;
  date: string;
  hours: number;
  rate_snapshot: number;
  amount_due: number;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
}

export interface WorkSessionStatus extends WorkSession {
  status: 'paid' | 'unpaid';
}

export function useWorkSessionsByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['work-session-status', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<WorkSessionStatus[]> => {
      const { data, error } = await supabase
        .from('work_session_status')
        .select('id, client_id, date, hours, rate_snapshot, amount_due, start_time, end_time, note, status')
        .eq('client_id', clientId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WorkSessionStatus[];
    },
  });
}

export function useAllWorkSessions() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['work-sessions', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<WorkSession[]> => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('id, client_id, date, hours, rate_snapshot, amount_due, start_time, end_time, note')
        .eq('household_id', householdId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WorkSession[];
    },
  });
}

export function useAllWorkSessionsStatus() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['work-session-status-all', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<WorkSessionStatus[]> => {
      const { data, error } = await supabase
        .from('work_session_status')
        .select('id, client_id, date, hours, rate_snapshot, amount_due, start_time, end_time, note, status')
        .eq('household_id', householdId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WorkSessionStatus[];
    },
  });
}

export function useCreateWorkSession() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      date,
      hours,
      rateSnapshot,
      startTime,
      endTime,
      note,
    }: {
      clientId: string;
      date: string;
      hours: number;
      rateSnapshot: number;
      startTime: string;
      endTime: string;
      note?: string;
    }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('work_sessions')
        .insert({
          household_id: household.id,
          client_id: clientId,
          date,
          hours,
          rate_snapshot: rateSnapshot,
          start_time: startTime,
          end_time: endTime,
          note: note || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-session-status', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['work-session-status-all'] });
      queryClient.invalidateQueries({ queryKey: ['work-sessions'] });
    },
  });
}
```

- [ ] **Step 5: Modifica `src/app/add-work-session.tsx`**

Contenuto completo del file dopo la modifica:

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../features/clients/useClients';
import { useCreateWorkSession } from '../features/work-sessions/useWorkSessions';
import { isEndAfterStart, isValidTimeFormat, toLocalDateString } from '../lib/dates';

export default function AddWorkSessionScreen() {
  const { clientId: preselectedClientId, date: preselectedDate } = useLocalSearchParams<{ clientId?: string; date?: string }>();
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState(preselectedClientId ?? '');
  const [date, setDate] = useState(preselectedDate ?? toLocalDateString(new Date()));
  const [hours, setHours] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const createSession = useCreateWorkSession();

  const selectedClient = clients?.find((c) => c.id === clientId);

  const handleSubmit = () => {
    const hoursNum = parseFloat(hours.replace(',', '.'));
    if (!selectedClient || isNaN(hoursNum) || hoursNum <= 0) return;
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime) || !isEndAfterStart(startTime, endTime)) return;
    createSession.mutate(
      { clientId, date, hours: hoursNum, rateSnapshot: selectedClient.hourly_rate, startTime, endTime, note: note.trim() || undefined },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nuova giornata lavorata</Text>

      {!preselectedClientId && (
        <View style={styles.clientPicker}>
          {(clients ?? []).filter((c) => c.active).map((c) => (
            <Pressable
              key={c.id}
              style={[styles.clientOption, clientId === c.id && styles.clientOptionSelected]}
              onPress={() => setClientId(c.id)}
            >
              <Text>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {selectedClient && <Text>Tariffa: €{selectedClient.hourly_rate}/h</Text>}

      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput style={styles.input} placeholder="Ore lavorate" keyboardType="decimal-pad" value={hours} onChangeText={setHours} />
      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora inizio (HH:MM)" value={startTime} onChangeText={setStartTime} />
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora fine (HH:MM)" value={endTime} onChangeText={setEndTime} />
      </View>
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {createSession.isError && <Text style={styles.error}>{(createSession.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createSession.isPending || !selectedClient}>
        <Text style={styles.buttonText}>{createSession.isPending ? 'Salvataggio...' : 'Salva'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  clientPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clientOption: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  clientOptionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  timeRow: { flexDirection: 'row', gap: 8 },
  timeInput: { flex: 1 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 6: Verifica (sequenza anti-stale-router-types — questo task tocca `src/app/`)**

Avvia `npx expo start --web --port <N>` in background, attendi `"Waiting on http://..."`, forza un bundle con `curl`, attendi, poi `npx tsc --noEmit`, poi killa il server.
Expected: pulito.

- [ ] **Step 7: Verifica manuale**

Conferma che `add-work-session.tsx` rifiuti il submit se `startTime`/`endTime` non sono in formato HH:MM validi o se `endTime` non è dopo `startTime` (bottone "Salva" non fa nulla, nessun errore silenzioso che scriva comunque sul database).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0009_work_session_times.sql src/lib/database.types.ts src/features/work-sessions/useWorkSessions.ts src/app/add-work-session.tsx
git commit -m "feat: add start/end time to work sessions, required on new entries"
```

---

### Task 3: Orari impegni di Francesca (`recurring_templates`/`calendar_events`)

**Files:**
- Create: `supabase/migrations/0010_family_time_ranges.sql`
- Modify: `src/lib/database.types.ts` (rigenerato dalla CLI)
- Modify: `src/features/family-calendar/recurringOccurrences.ts`
- Modify: `src/features/family-calendar/recurringOccurrences.test.ts`
- Modify: `src/features/family-calendar/useCalendarEvents.ts`
- Modify: `src/features/family-calendar/useRecurringTemplates.ts`
- Modify: `src/features/family-calendar/useSyncRecurringReminders.ts`
- Modify: `src/app/add-family-event.tsx`
- Modify: `src/app/edit-family-event.tsx`
- Modify: `src/app/add-recurring-template.tsx`
- Modify: `src/app/edit-recurring-template.tsx`
- Modify: `src/app/family-day/[date].tsx`
- Modify: `src/app/(tabs)/impostazioni.tsx`

**Interfaces:**
- Consumes: `isValidTimeFormat`, `isEndAfterStart` (Task 1)
- Produces: `RecurringTemplate`/`CalendarEvent`/`Occurrence` con `start_time`/`end_time` invece di `time` (da `recurringOccurrences.ts`) — nessuna interfaccia consumata da task successivi di questo piano (ultimo task)

Questo task è un unico rename (`time` → `start_time`+`end_time`) che attraversa tipi, hook, e 5 schermate/form contemporaneamente — non è divisibile in task più piccoli senza lasciare `tsc` rotto a metà, perché ogni file che referenzia `.time` su queste interfacce smette di compilare nello stesso istante in cui il tipo cambia. Va eseguito e verificato come un blocco unico.

- [ ] **Step 1: Scrivi la migrazione `supabase/migrations/0010_family_time_ranges.sql`**

```sql
-- Sostituisce il singolo campo `time` con un intervallo start_time/end_time
-- per recurring_templates e calendar_events. Le occorrenze già esistenti
-- hanno solo l'orario di inizio: durata di default 30 minuti per calcolare
-- l'orario di fine mancante (deciso con l'utente — modificabile poi a mano
-- riaprendo l'impegno). Righe che avevano già time null restano con
-- start_time/end_time entrambi null (nessun orario da mostrare).

alter table recurring_templates
  rename column time to start_time;
alter table recurring_templates
  add column end_time time,
  add constraint recurring_templates_time_pair check (
    (start_time is null) = (end_time is null)
  ),
  add constraint recurring_templates_time_order check (
    start_time is null or end_time > start_time
  );

update recurring_templates
  set end_time = start_time + interval '30 minutes'
  where start_time is not null;

alter table calendar_events
  rename column time to start_time;
alter table calendar_events
  add column end_time time,
  add constraint calendar_events_time_pair check (
    (start_time is null) = (end_time is null)
  ),
  add constraint calendar_events_time_order check (
    start_time is null or end_time > start_time
  );

update calendar_events
  set end_time = start_time + interval '30 minutes'
  where start_time is not null;
```

- [ ] **Step 2: Applica la migrazione**

```bash
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env | cut -d '=' -f2)
npx supabase db push
npx supabase migration list
```

Expected: `0010_family_time_ranges.sql` applicata, `migration list` allineato fino a `0010`.

- [ ] **Step 3: Rigenera i tipi TypeScript**

```bash
npx supabase gen types typescript --project-id qivxrbhbffwqqmaadpnl > src/lib/database.types.ts
```

A questo punto `npx tsc --noEmit` mostrerà errori in `useCalendarEvents.ts`/`useRecurringTemplates.ts` (riferimenti alla colonna `time` ormai rinominata) — atteso, i prossimi step li risolvono.

- [ ] **Step 4: Aggiorna i test in `src/features/family-calendar/recurringOccurrences.test.ts` (TDD)**

Sostituisci l'intero contenuto del file:

```typescript
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
```

- [ ] **Step 5: Esegui il test e verifica che fallisca**

Run: `npx jest src/features/family-calendar/recurringOccurrences.test.ts`
Expected: FAIL — `recurringOccurrences.ts` non espone ancora `start_time`/`end_time`.

- [ ] **Step 6: Sostituisci `src/features/family-calendar/recurringOccurrences.ts`**

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
  start_time: string | null;
  end_time: string | null;
  note: string | null;
}

export interface CalendarEvent {
  id: string;
  recurring_template_id: string | null;
  title: string;
  category: FamilyCategory;
  person: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
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
  start_time: string | null;
  end_time: string | null;
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
            start_time: override.start_time,
            end_time: override.end_time,
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
        start_time: template.start_time,
        end_time: template.end_time,
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
      start_time: e.start_time,
      end_time: e.end_time,
      note: e.note,
      isVirtual: false,
    });
  }

  occurrences.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const at = a.start_time ?? '';
    const bt = b.start_time ?? '';
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

- [ ] **Step 7: Esegui il test e verifica che passi**

Run: `npx jest src/features/family-calendar/recurringOccurrences.test.ts`
Expected: PASS, tutti i test.

- [ ] **Step 8: Sostituisci `src/features/family-calendar/useCalendarEvents.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import { cancelReminderFor, syncReminderFor } from '../notifications/syncReminders';
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
        .select('id, recurring_template_id, title, category, person, date, start_time, end_time, note, is_cancelled')
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
      startTime?: string;
      endTime?: string;
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
          start_time: input.startTime || null,
          end_time: input.endTime || null,
          note: input.note || null,
        })
        .select('id, recurring_template_id, title, category, person, date, start_time, end_time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      syncReminderFor(`event:${data.id}`, `Promemoria: ${data.title}`, `${data.person} — domani`, data.date, data.start_time);
    },
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
      startTime?: string;
      endTime?: string;
      note?: string;
    }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update({
          title: input.title,
          category: input.category,
          person: input.person,
          date: input.date,
          start_time: input.startTime || null,
          end_time: input.endTime || null,
          note: input.note || null,
        })
        .eq('id', input.id)
        .select('id, recurring_template_id, title, category, person, date, start_time, end_time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      syncReminderFor(`event:${data.id}`, `Promemoria: ${data.title}`, `${data.person} — domani`, data.date, data.start_time);
    },
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
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      cancelReminderFor(`event:${id}`);
    },
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
      startTime?: string;
      endTime?: string;
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
            start_time: input.startTime || null,
            end_time: input.endTime || null,
            note: input.note || null,
            is_cancelled: input.isCancelled,
          },
          { onConflict: 'recurring_template_id,date' }
        )
        .select('id, recurring_template_id, title, category, person, date, start_time, end_time, note, is_cancelled')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      if (data.is_cancelled) {
        cancelReminderFor(`event:${data.id}`);
      } else {
        syncReminderFor(`event:${data.id}`, `Promemoria: ${data.title}`, `${data.person} — domani`, data.date, data.start_time);
      }
    },
  });
}
```

- [ ] **Step 9: Sostituisci `src/features/family-calendar/useRecurringTemplates.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import { toLocalDateString } from '../../lib/dates';
import { cancelReminderFor } from '../notifications/syncReminders';
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
        .select('id, title, category, person, weekday, start_time, end_time, note')
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
      startTime?: string;
      endTime?: string;
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
          start_time: input.startTime || null,
          end_time: input.endTime || null,
          note: input.note || null,
        })
        .select('id, title, category, person, weekday, start_time, end_time, note')
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
      startTime?: string;
      endTime?: string;
      note?: string;
    }) => {
      const { data: current } = await supabase
        .from('recurring_templates')
        .select('weekday')
        .eq('id', input.id)
        .single();

      const { data, error } = await supabase
        .from('recurring_templates')
        .update({
          title: input.title,
          category: input.category,
          person: input.person,
          weekday: input.weekday,
          start_time: input.startTime || null,
          end_time: input.endTime || null,
          note: input.note || null,
        })
        .eq('id', input.id)
        .select('id, title, category, person, weekday, start_time, end_time, note')
        .single();
      if (error) throw error;

      let orphanedOverrideIds: string[] = [];
      if (current && current.weekday !== input.weekday) {
        const today = toLocalDateString(new Date());
        const { data: futureOverrides } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('recurring_template_id', input.id)
          .gte('date', today);
        orphanedOverrideIds = (futureOverrides ?? []).map((o) => o.id);
        if (orphanedOverrideIds.length > 0) {
          await supabase.from('calendar_events').delete().in('id', orphanedOverrideIds);
        }
      }

      return { template: data, orphanedOverrideIds };
    },
    onSuccess: ({ orphanedOverrideIds }) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-templates'] });
      if (orphanedOverrideIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
        for (const id of orphanedOverrideIds) {
          cancelReminderFor(`event:${id}`);
        }
      }
    },
  });
}

export function useDeleteRecurringTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: overrides } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('recurring_template_id', id);
      const { error } = await supabase.from('recurring_templates').delete().eq('id', id);
      if (error) throw error;
      return { id, overrideIds: (overrides ?? []).map((o) => o.id) };
    },
    onSuccess: ({ id, overrideIds }) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-templates'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      cancelReminderFor(`template:${id}`);
      for (const overrideId of overrideIds) {
        cancelReminderFor(`event:${overrideId}`);
      }
    },
  });
}
```

- [ ] **Step 10: Modifica `src/features/family-calendar/useSyncRecurringReminders.ts`**

Contenuto completo del file dopo la modifica (unica riga cambiata: l'ultimo argomento passato a `syncReminderFor`):

```typescript
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
          cancelReminderFor(`template:${template.id}`);
          continue;
        }

        syncReminderFor(`template:${template.id}`, `Promemoria: ${template.title}`, `${template.person} — domani`, nextDate, template.start_time);
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

- [ ] **Step 11: Sostituisci `src/app/add-family-event.tsx`**

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateCalendarEvent } from '../features/family-calendar/useCalendarEvents';
import { FAMILY_CATEGORIES } from '../features/family-calendar/constants';
import { isEndAfterStart, isValidTimeFormat, toLocalDateString } from '../lib/dates';
import type { FamilyCategory } from '../features/family-calendar/recurringOccurrences';

export default function AddFamilyEventScreen() {
  const { date: preselectedDate } = useLocalSearchParams<{ date?: string }>();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FamilyCategory>('altro');
  const [person, setPerson] = useState('Francesca');
  const [date, setDate] = useState(preselectedDate ?? toLocalDateString(new Date()));
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const createEvent = useCreateCalendarEvent();

  const handleSubmit = () => {
    if (!title.trim() || !person.trim() || !date.trim()) return;
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime) || !isEndAfterStart(startTime, endTime)) return;
    createEvent.mutate(
      { title: title.trim(), category, person: person.trim(), date: date.trim(), startTime, endTime, note: note.trim() || undefined },
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
      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora inizio (HH:MM)" value={startTime} onChangeText={setStartTime} />
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora fine (HH:MM)" value={endTime} onChangeText={setEndTime} />
      </View>
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
  timeRow: { flexDirection: 'row', gap: 8 },
  timeInput: { flex: 1 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 12: Sostituisci `src/app/edit-family-event.tsx`**

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
import { isEndAfterStart, isValidTimeFormat } from '../lib/dates';
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
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    if (manualEvent) {
      setTitle(manualEvent.title);
      setCategory(manualEvent.category);
      setPerson(manualEvent.person);
      setStartTime(manualEvent.start_time ?? '');
      setEndTime(manualEvent.end_time ?? '');
      setNote(manualEvent.note ?? '');
      setLoaded(true);
    } else if (isOverrideMode && (existingOverride || template)) {
      const source = existingOverride ?? template!;
      setTitle(source.title);
      setCategory(source.category);
      setPerson(source.person);
      setStartTime(source.start_time ?? '');
      setEndTime(source.end_time ?? '');
      setNote(source.note ?? '');
      setLoaded(true);
    }
  }, [manualEvent?.id, existingOverride?.id, template?.id, loaded, isOverrideMode]);

  if (id && !events) return <Text style={styles.padded}>Caricamento...</Text>;
  if (!manualEvent && !isOverrideMode) return <Text style={styles.padded}>Evento non trovato.</Text>;
  if (isOverrideMode && !template) return <Text style={styles.padded}>Caricamento...</Text>;

  const handleSave = () => {
    if (!title.trim() || !person.trim()) return;
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime) || !isEndAfterStart(startTime, endTime)) return;
    if (manualEvent) {
      updateEvent.mutate(
        { id: manualEvent.id, title: title.trim(), category, person: person.trim(), date: manualEvent.date, startTime, endTime, note: note.trim() || undefined },
        { onSuccess: () => router.back() }
      );
    } else if (recurringTemplateId && date) {
      upsertOverride.mutate(
        { recurringTemplateId, date, title: title.trim(), category, person: person.trim(), startTime, endTime, note: note.trim() || undefined, isCancelled: false },
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
      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora inizio (HH:MM)" value={startTime} onChangeText={setStartTime} />
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora fine (HH:MM)" value={endTime} onChangeText={setEndTime} />
      </View>
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
  timeRow: { flexDirection: 'row', gap: 8 },
  timeInput: { flex: 1 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteButtonText: { color: '#dc2626', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 13: Sostituisci `src/app/add-recurring-template.tsx`**

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useCreateRecurringTemplate } from '../features/family-calendar/useRecurringTemplates';
import { FAMILY_CATEGORIES, WEEKDAY_OPTIONS } from '../features/family-calendar/constants';
import { isEndAfterStart, isValidTimeFormat } from '../lib/dates';
import type { FamilyCategory } from '../features/family-calendar/recurringOccurrences';

export default function AddRecurringTemplateScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FamilyCategory>('altro');
  const [person, setPerson] = useState('Francesca');
  const [weekday, setWeekday] = useState<number | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const createTemplate = useCreateRecurringTemplate();

  const handleSubmit = () => {
    if (!title.trim() || !person.trim() || weekday === null) return;
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime) || !isEndAfterStart(startTime, endTime)) return;
    createTemplate.mutate(
      { title: title.trim(), category, person: person.trim(), weekday, startTime, endTime, note: note.trim() || undefined },
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

      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora inizio (HH:MM)" value={startTime} onChangeText={setStartTime} />
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora fine (HH:MM)" value={endTime} onChangeText={setEndTime} />
      </View>
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
  timeRow: { flexDirection: 'row', gap: 8 },
  timeInput: { flex: 1 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 14: Sostituisci `src/app/edit-recurring-template.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useDeleteRecurringTemplate, useRecurringTemplates, useUpdateRecurringTemplate } from '../features/family-calendar/useRecurringTemplates';
import { FAMILY_CATEGORIES, WEEKDAY_OPTIONS } from '../features/family-calendar/constants';
import { isEndAfterStart, isValidTimeFormat } from '../lib/dates';
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
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setCategory(template.category);
      setPerson(template.person);
      setWeekday(template.weekday);
      setStartTime(template.start_time ?? '');
      setEndTime(template.end_time ?? '');
      setNote(template.note ?? '');
    }
  }, [template?.id]);

  if (!template) return <Text style={styles.padded}>Impegno non trovato.</Text>;

  const handleSave = () => {
    if (!title.trim() || !person.trim() || weekday === null) return;
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime) || !isEndAfterStart(startTime, endTime)) return;
    updateTemplate.mutate(
      { id: template.id, title: title.trim(), category, person: person.trim(), weekday, startTime, endTime, note: note.trim() || undefined },
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

      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora inizio (HH:MM)" value={startTime} onChangeText={setStartTime} />
        <TextInput style={[styles.input, styles.timeInput]} placeholder="Ora fine (HH:MM)" value={endTime} onChangeText={setEndTime} />
      </View>
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
  timeRow: { flexDirection: 'row', gap: 8 },
  timeInput: { flex: 1 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteButtonText: { color: '#dc2626', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 15: Sostituisci `src/app/family-day/[date].tsx`**

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
      startTime: occurrence.start_time ?? undefined,
      endTime: occurrence.end_time ?? undefined,
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
              <Text style={styles.rowMeta}>
                {categoryLabel(item.category)}
                {item.start_time && item.end_time ? ` · ${item.start_time}–${item.end_time}` : ''}
              </Text>
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

- [ ] **Step 16: Modifica `src/app/(tabs)/impostazioni.tsx`**

Unica riga cambiata (nella `FlatList` degli impegni ricorrenti):

```tsx
              <Text>{weekdayLabel(item.weekday)}{item.start_time && item.end_time ? ` ${item.start_time}–${item.end_time}` : ''}</Text>
```

Contenuto completo del file dopo la modifica:

```tsx
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../../features/household/useHousehold';
import { useClients } from '../../features/clients/useClients';
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { WEEKDAY_OPTIONS } from '../../features/family-calendar/constants';
import { clearStoredKey } from '../../features/notes/crypto/secureKeyStore';

export default function ImpostazioniScreen() {
  const { data: household, isLoading } = useHousehold();
  const { data: clients } = useClients();
  const { data: recurringTemplates } = useRecurringTemplates();
  const weekdayLabel = (weekday: number) => WEEKDAY_OPTIONS.find((w) => w.value === weekday)?.label ?? '?';

  if (isLoading) return <Text style={styles.padded}>Caricamento...</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{household?.name}</Text>
      <Text>Codice invito per far entrare un altro membro:</Text>
      <Text style={styles.code}>{household?.invite_code}</Text>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Clienti</Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/add-client')}>
          <Text style={styles.addButtonText}>+ Cliente</Text>
        </Pressable>
      </View>
      <View style={styles.listWrapper}>
        <FlatList
          style={{ flex: 1 }}
          data={clients ?? []}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.clientRow}
              onPress={() => router.push({ pathname: '/edit-client', params: { id: item.id } })}
            >
              <Text style={styles.clientName}>{item.name}{!item.active ? ' (disattivo)' : ''}</Text>
              <Text>€{item.hourly_rate}/h</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text>Nessun cliente ancora.</Text>}
        />
      </View>

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
              <Text>{weekdayLabel(item.weekday)}{item.start_time && item.end_time ? ` ${item.start_time}–${item.end_time}` : ''}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text>Nessun impegno ricorrente ancora.</Text>}
        />
      </View>

      <Pressable
        style={styles.button}
        onPress={async () => {
          await clearStoredKey();
          await supabase.auth.signOut();
        }}
      >
        <Text style={styles.buttonText}>Esci</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  padded: { padding: 24 },
  title: { fontSize: 22, fontWeight: '600' },
  code: { fontSize: 28, fontWeight: '700', letterSpacing: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  listWrapper: { flex: 1 },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  addButtonText: { color: 'white', fontWeight: '600' },
  clientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  clientName: { fontWeight: '500' },
  button: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: 'white', fontWeight: '600' },
});
```

- [ ] **Step 17: Verifica (sequenza anti-stale-router-types — questo task tocca `src/app/`)**

Avvia `npx expo start --web --port <N>` in background, attendi `"Waiting on http://..."`, forza un bundle con `curl`, attendi, poi `npx jest src/features/family-calendar` per i test puri, poi `npx tsc --noEmit`, poi killa il server.
Expected: test PASS, `tsc` pulito, nessun riferimento residuo a `.time` su `RecurringTemplate`/`CalendarEvent`/`Occurrence`/`WorkSession` in nessun file (verifica anche con una ricerca testuale `grep -rn "\.time\b" src/` — deve restituire zero risultati, a differenza di prima di questo task).

- [ ] **Step 18: Verifica manuale**

Conferma che: ogni form (`add-family-event.tsx`, `edit-family-event.tsx`, `add-recurring-template.tsx`, `edit-recurring-template.tsx`) rifiuti il submit senza orario di inizio/fine validi; `family-day/[date].tsx`'s `handleSkip` passi correttamente `startTime`/`endTime` esistenti dell'occorrenza (non li richieda nuovi, dato che è un'azione one-tap non un form); `impostazioni.tsx` mostri l'intervallo orario solo quando entrambi i campi sono presenti (mai un singolo orario orfano).

- [ ] **Step 19: Commit**

```bash
git add supabase/migrations/0010_family_time_ranges.sql src/lib/database.types.ts src/features/family-calendar src/app/add-family-event.tsx src/app/edit-family-event.tsx src/app/add-recurring-template.tsx src/app/edit-recurring-template.tsx "src/app/family-day/[date].tsx" "src/app/(tabs)/impostazioni.tsx"
git commit -m "feat: replace single time field with start/end time range for family calendar"
```

---

## Al termine di questo piano

Deliverable funzionante e testabile: `work_sessions` ha orario di inizio/fine opzionale (obbligatorio per i nuovi inserimenti tramite `add-work-session.tsx`); `recurring_templates`/`calendar_events` hanno lo stesso intervallo al posto del singolo `time`, con backfill a +30 minuti per le occorrenze Francesca già esistenti. Tutti i 5 form coinvolti richiedono e validano l'orario per i nuovi inserimenti/modifiche. Nessuna schermata di calendario mostra ancora la griglia oraria — quello è il Piano 2, che ora ha i dati reali su cui costruirla invece di doverli approssimare.

## Self-Review (fatto durante la scrittura del piano)

- **Copertura spec:** §2 (schema) → Task 2 (work_sessions) + Task 3 (recurring_templates/calendar_events). §6.1 (form obbligatori) → Task 2 Step 5, Task 3 Step 11-14. Nessun requisito delle sezioni 2/6.1 rimasto scoperto.
- **Niente placeholder:** ogni step ha codice completo, nessun TODO/TBD.
- **Coerenza dei tipi tra task:** `isValidTimeFormat`/`isEndAfterStart` (Task 1) → stessi nomi importati identici in Task 2 e Task 3. `WorkSession.start_time`/`end_time` (Task 2) → non consumati da Task 3 (tabelle indipendenti, nessuna condivisione). `RecurringTemplate`/`CalendarEvent`/`Occurrence` con `start_time`/`end_time` (Task 3, `recurringOccurrences.ts`) → stessi nomi usati identici in `useCalendarEvents.ts`, `useRecurringTemplates.ts`, `useSyncRecurringReminders.ts`, e nei 5 file `src/app/` dello stesso task. Verificato manualmente file per file, nessuna discrepanza residua (confermato anche dal comando di verifica `grep -rn "\.time\b" src/` al Step 17 di Task 3, che deve restituire zero risultati).
- **Perché Task 3 è un task solo invece di più piccoli:** un rename di colonna attraversato da tipi condivisi rompe `tsc` in ogni file consumatore nello stesso istante — non esiste un punto di taglio intermedio che lasci `tsc` pulito, quindi la scomposizione per tabella (Task 2 = work_sessions, isolato) è il taglio più fine possibile senza introdurre uno stato rotto tra due task.
