# Blocco B — Piano 2: Calendario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ristilizzare il Calendario (tab `index.tsx`, schermate `day/[date].tsx` e `family-day/[date].tsx`) secondo la card a due zone (Mattina/Pomeriggio) decisa con l'utente, con colori per categoria per Francesca, interazione via finestra modale sulle singole voci, e la possibilità (nuova) di modificare la nota di una giornata lavorata già salvata.

**Architecture:** Nessun nuovo componente di rendering della griglia — la cella-giorno esistente di `CalendarView` (già condivisa da Giorno/Settimana/Mese) resta l'unico contenitore, ristilizzata (bordo azzurro, sfondo bianco); il contenuto (le due zone Mattina/Pomeriggio con le voci) continua a essere iniettato tramite `renderDay`, stesso principio di inversion-of-control già in uso. Una funzione pura testata (`splitByHalfDay`) smista le voci di un giorno in due gruppi. Un componente modale generico (`DetailModal`, solo il guscio: sfondo/bordo/chiusura) è riusato da tre punti diversi (calendario, pagina giornata lavorata, pagina giornata Francesca) con contenuti diversi (`WorkSessionDetail`, `FamilyOccurrenceDetail`) — stessa separazione "guscio generico + contenuto specifico del dominio" già vista in questo progetto (`CalendarView` + `renderDay`).

**Tech Stack:** Stesso stack dei blocchi precedenti — Expo Router, TypeScript, `StyleSheet` nativo, TanStack Query, Jest. Nessuna nuova dipendenza: `Modal` è un componente React Native già disponibile.

**Spec:** `docs/superpowers/specs/2026-09-20-blocco-b-calendario-pagamenti-design.md`, sezione 3 (revisionata 2026-09-21)

**Precede questo piano (già completato):** `docs/superpowers/plans/2026-09-20-blocco-b-piano1-schema-form.md` — questo piano consuma `start_time`/`end_time` su `WorkSessionStatus`/`Occurrence`/`RecurringTemplate`/`CalendarEvent` già aggiunti lì, e `isValidTimeFormat` non serve qui (nessun nuovo form di inserimento orario in questo piano).

## Global Constraints

- **Tutta la logica non banale in funzioni pure testate, mai dentro un file `.tsx`** — principio già rinforzato più volte in questo progetto dopo bug reali (vedi `docs/LEARNING.md`), il preset Jest (`jest-expo/node`) non ha un renderer. In questo piano si applica a `splitByHalfDay` (Task 1).
- **Bottoni sempre bianchi con rilievo, tranne le eccezioni esplicite già fissate nella spec**: le righe di riepilogo Pagamenti su hover (Piano 3, non qui) e i bottoni "+" delle pagine calendario in QUESTO piano (`day/[date].tsx`, `family-day/[date].tsx`), che diventano marroni (`Colors.actionBrown`, `#4D424C`) **a riposo**, non solo su hover. Non estendere il marrone ad altri bottoni (i toggle Giorno/Settimana/Mese e Lavoro/Francesca restano bianchi con rilievo).
- **Riuso dei componenti condivisi del Blocco A**: `Button`, `Card`, `IconButton` da `src/components/` — non reinventarli. `DetailModal` (nuovo, Task 3) è un guscio generico; il contenuto specifico del dominio vive in componenti separati dentro le rispettive cartelle `src/features/<dominio>/`, non dentro `DetailModal` stesso.
- **Palette per categoria Francesca — valori esatti**: `mensa` `#65b5ff`, `palestra` `#0bdf50`, `cavallo` `#ff2067`, `piscina` `#b3e01c`, `teatro` `#03b2cb`, `altro` → `Colors.inkMuted` (`#7A6659`, nessun colore "Report" dedicato).
- **Le voci nel calendario mostrano un pallino colorato accanto al testo, non uno sfondo colorato dietro il testo** — decisione presa scrivendo questo piano (non nella spec, che lasciava il dettaglio implicito): il riferimento visivo di Intercom mostra il colore come un elemento separato dal testo (uno swatch), non testo sopra un colore saturo — evita anche ogni rischio di contrasto testo/sfondo (già una fonte di bug reale nel Blocco A, vedi `docs/LEARNING.md`) senza dover verificare a occhio ogni combinazione colore/testo in un ambiente senza strumenti di verifica visiva.
- **Tint delle due zone (valori esatti dalla spec)**: Mattina `rgba(150, 194, 219, 0.20)`, Pomeriggio `rgba(50, 50, 50, 0.08)` — costanti in `src/lib/theme.ts`, mai calcolate a runtime.
- **`day/[date].tsx`/`family-day/[date].tsx` non sono avvolte da `AppShell`** (sono fuori dal gruppo `(tabs)`) — non ereditano `Colors.canvas`. Il fix è mirato: `backgroundColor: Colors.canvas` esplicito sul container di ciascuna delle due schermate, non un cambiamento di `AppShell` o di altre schermate (quelle restano nel Blocco C).
- **Verifica route (`.expo/types/router.d.ts`)**: per ogni task che modifica un file sotto `src/app/`, usare la sequenza anti-stale-router-types (avvia `npx expo start --web --port <N>` in background → attendi `"Waiting on http://..."` → `curl` per forzare un bundle reale → attendi qualche secondo → `npx tsc --noEmit` → killa il server con `netstat -ano | grep :<N>` poi `taskkill //F //PID <pid>`). Per task che toccano solo `src/lib/`/`src/components/`/`src/features/` senza referenziare ancora una rotta nuova, un `npx tsc --noEmit` semplice basta.
- Questo ambiente di esecuzione non ha strumenti di browser headless/interattivo — la verifica finale dell'aspetto reale (colori, apertura modale, layout) resta a carico dell'utente.

---

### Task 1: Funzione pura — divisione mattina/pomeriggio (TDD)

**Files:**
- Create: `src/features/calendar/dayHalves.ts`
- Create: `src/features/calendar/dayHalves.test.ts`

**Interfaces:**
- Consumes: niente (funzione pura generica)
- Produces: `HalfDaySplit<T>`, `splitByHalfDay<T extends { start_time: string | null }>(items: T[]): HalfDaySplit<T>` — usata dal Task 5 (`index.tsx`)

- [ ] **Step 1: Scrivi il test in `src/features/calendar/dayHalves.test.ts`**

```typescript
import { splitByHalfDay } from './dayHalves';

interface Item {
  id: string;
  start_time: string | null;
}

function item(id: string, start_time: string | null): Item {
  return { id, start_time };
}

describe('splitByHalfDay', () => {
  it('puts a morning time before 13:00 into morning', () => {
    const { morning, afternoon } = splitByHalfDay([item('a', '09:00')]);
    expect(morning.map((i) => i.id)).toEqual(['a']);
    expect(afternoon).toEqual([]);
  });

  it('puts exactly 13:00 into afternoon (boundary is exclusive on morning side)', () => {
    const { morning, afternoon } = splitByHalfDay([item('a', '13:00')]);
    expect(morning).toEqual([]);
    expect(afternoon.map((i) => i.id)).toEqual(['a']);
  });

  it('puts an item with no start_time into morning as a fallback', () => {
    const { morning, afternoon } = splitByHalfDay([item('a', null)]);
    expect(morning.map((i) => i.id)).toEqual(['a']);
    expect(afternoon).toEqual([]);
  });

  it('sorts each group by start_time, items without a time first within morning', () => {
    const { morning } = splitByHalfDay([item('late', '11:00'), item('none', null), item('early', '08:00')]);
    expect(morning.map((i) => i.id)).toEqual(['none', 'early', 'late']);
  });

  it('sorts the afternoon group by start_time', () => {
    const { afternoon } = splitByHalfDay([item('late', '18:00'), item('early', '14:00')]);
    expect(afternoon.map((i) => i.id)).toEqual(['early', 'late']);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/features/calendar/dayHalves.test.ts`
Expected: FAIL — `Cannot find module './dayHalves'`

- [ ] **Step 3: Scrivi `src/features/calendar/dayHalves.ts`**

```typescript
export interface HalfDaySplit<T> {
  morning: T[];
  afternoon: T[];
}

const AFTERNOON_THRESHOLD = '13:00';

function compareByStartTime<T extends { start_time: string | null }>(a: T, b: T): number {
  const at = a.start_time ?? '';
  const bt = b.start_time ?? '';
  return at < bt ? -1 : at > bt ? 1 : 0;
}

/** Smista le voci di un giorno in due gruppi in base a start_time (voci senza orario finiscono in mattina come fallback), ordinando ciascun gruppo cronologicamente. */
export function splitByHalfDay<T extends { start_time: string | null }>(items: T[]): HalfDaySplit<T> {
  const morning: T[] = [];
  const afternoon: T[] = [];

  for (const item of items) {
    if (item.start_time !== null && item.start_time >= AFTERNOON_THRESHOLD) {
      afternoon.push(item);
    } else {
      morning.push(item);
    }
  }

  morning.sort(compareByStartTime);
  afternoon.sort(compareByStartTime);

  return { morning, afternoon };
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/features/calendar/dayHalves.test.ts`
Expected: PASS, 5 test.

- [ ] **Step 5: Verifica**

Run: `npx tsc --noEmit` (nessuna rotta toccata).
Expected: pulito.

- [ ] **Step 6: Commit**

```bash
git add src/features/calendar/dayHalves.ts src/features/calendar/dayHalves.test.ts
git commit -m "feat: add pure morning/afternoon split for calendar day cells"
```

---

### Task 2: Token di tema e colori per categoria Francesca

**Files:**
- Modify: `src/lib/theme.ts`
- Modify: `src/features/family-calendar/constants.ts`

**Interfaces:**
- Consumes: `FamilyCategory` da `src/features/family-calendar/recurringOccurrences.ts` (già esistente); `Colors.inkMuted` (già esistente in `theme.ts`)
- Produces: `Colors.morningTint`, `Colors.afternoonTint`, `Colors.actionBrown` da `theme.ts`; `FAMILY_CATEGORY_COLORS: Record<FamilyCategory, string>` da `constants.ts` — usati dai Task 4, 5, 6, 7

- [ ] **Step 1: Aggiungi i nuovi token a `src/lib/theme.ts`**

Aggiungi dentro l'oggetto `Colors` esistente (dopo `errorBg`):

```typescript
  morningTint: 'rgba(150, 194, 219, 0.20)',
  afternoonTint: 'rgba(50, 50, 50, 0.08)',
  actionBrown: '#4D424C',
```

- [ ] **Step 2: Aggiungi `FAMILY_CATEGORY_COLORS` a `src/features/family-calendar/constants.ts`**

Aggiungi l'import in cima al file e la nuova mappa in fondo:

```typescript
import { Colors } from '../../lib/theme';
```

```typescript
export const FAMILY_CATEGORY_COLORS: Record<FamilyCategory, string> = {
  mensa: '#65b5ff',
  palestra: '#0bdf50',
  cavallo: '#ff2067',
  piscina: '#b3e01c',
  teatro: '#03b2cb',
  altro: Colors.inkMuted,
};
```

- [ ] **Step 3: Verifica**

Run: `npx tsc --noEmit` (nessuna rotta toccata).
Expected: pulito.

- [ ] **Step 4: Commit**

```bash
git add src/lib/theme.ts src/features/family-calendar/constants.ts
git commit -m "feat: add day-half tints, action-brown token, and per-category colors for Francesca"
```

---

### Task 3: Blocchi condivisi — DetailModal, useUpdateWorkSession, contenuti del modale

**Files:**
- Create: `src/components/DetailModal.tsx`
- Modify: `src/features/work-sessions/useWorkSessions.ts`
- Create: `src/features/work-sessions/WorkSessionDetail.tsx`
- Create: `src/features/family-calendar/FamilyOccurrenceDetail.tsx`

**Interfaces:**
- Consumes: `IconButton` (`src/components/IconButton.tsx`), `Button` (`src/components/Button.tsx`), `Colors`/`Radii`/`Spacing`/`Typography` (Task 2 per i nuovi token, resto già esistente), `WorkSessionStatus` (già esistente), `Occurrence`/`FamilyCategory` (già esistenti), `FAMILY_CATEGORIES`/`FAMILY_CATEGORY_COLORS` (Task 2)
- Produces: `DetailModal({visible, onClose, children})`, `useUpdateWorkSession()`, `WorkSessionDetail({session, clientName})`, `FamilyOccurrenceDetail({occurrence})` — usati dai Task 5, 6, 7

- [ ] **Step 1: Scrivi `src/components/DetailModal.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { IconButton } from './IconButton';
import { Colors, Radii, Spacing } from '../lib/theme';

interface DetailModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function DetailModal({ visible, onClose, children }: DetailModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.closeRow}>
            <IconButton name="x" onPress={onClose} accessibilityLabel="Chiudi" />
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 420,
  },
  closeRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.xs,
  },
});
```

- [ ] **Step 2: Aggiungi `useUpdateWorkSession` a `src/features/work-sessions/useWorkSessions.ts`**

Aggiungi in fondo al file esistente:

```typescript
export function useUpdateWorkSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string | null }) => {
      const { data, error } = await supabase
        .from('work_sessions')
        .update({ note })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-session-status', data.client_id] });
      queryClient.invalidateQueries({ queryKey: ['work-session-status-all'] });
      queryClient.invalidateQueries({ queryKey: ['work-sessions'] });
    },
  });
}
```

- [ ] **Step 3: Scrivi `src/features/work-sessions/WorkSessionDetail.tsx`**

```tsx
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { useUpdateWorkSession } from './useWorkSessions';
import type { WorkSessionStatus } from './useWorkSessions';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface WorkSessionDetailProps {
  session: WorkSessionStatus;
  clientName: string;
}

export function WorkSessionDetail({ session, clientName }: WorkSessionDetailProps) {
  const [note, setNote] = useState(session.note ?? '');
  const updateSession = useUpdateWorkSession();

  const handleSave = () => {
    updateSession.mutate({ id: session.id, note: note.trim() || null });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.clientName}>{clientName}</Text>
      <Text style={styles.meta}>
        {session.hours}h — €{session.amount_due.toFixed(2)}
        {session.start_time && session.end_time ? ` — ${session.start_time}–${session.end_time}` : ''}
      </Text>
      <Text style={styles.label}>Nota</Text>
      <TextInput
        style={styles.noteInput}
        placeholder="Aggiungi una nota..."
        value={note}
        onChangeText={setNote}
        multiline
      />
      {updateSession.isError && <Text style={styles.error}>{(updateSession.error as Error).message}</Text>}
      <Button
        label={updateSession.isPending ? 'Salvataggio...' : 'Salva nota'}
        onPress={handleSave}
        disabled={updateSession.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  clientName: { ...Typography.title, color: Colors.ink },
  meta: { ...Typography.body, color: Colors.inkMuted },
  label: { ...Typography.bodyBold, color: Colors.ink, marginTop: Spacing.sm },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
    ...Typography.body,
    color: Colors.ink,
  },
  error: { color: Colors.error },
});
```

- [ ] **Step 4: Scrivi `src/features/family-calendar/FamilyOccurrenceDetail.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { FAMILY_CATEGORIES, FAMILY_CATEGORY_COLORS } from './constants';
import type { Occurrence } from './recurringOccurrences';
import { Colors, Spacing, Typography } from '../../lib/theme';

interface FamilyOccurrenceDetailProps {
  occurrence: Occurrence;
}

export function FamilyOccurrenceDetail({ occurrence }: FamilyOccurrenceDetailProps) {
  const categoryLabel = FAMILY_CATEGORIES.find((c) => c.value === occurrence.category)?.label ?? occurrence.category;
  const categoryColor = FAMILY_CATEGORY_COLORS[occurrence.category];

  const handleEdit = () => {
    router.push(
      occurrence.recurringTemplateId
        ? { pathname: '/edit-family-event', params: { recurringTemplateId: occurrence.recurringTemplateId, date: occurrence.date } }
        : { pathname: '/edit-family-event', params: { id: occurrence.id } }
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.categoryRow}>
        <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
        <Text style={styles.categoryLabel}>{categoryLabel}</Text>
      </View>
      <Text style={styles.title}>{occurrence.title}</Text>
      <Text style={styles.meta}>{occurrence.person}</Text>
      {occurrence.start_time && occurrence.end_time && (
        <Text style={styles.meta}>{occurrence.start_time}–{occurrence.end_time}</Text>
      )}
      {occurrence.note && <Text style={styles.note}>{occurrence.note}</Text>}
      <Button label="Modifica" onPress={handleEdit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryLabel: { ...Typography.caption, color: Colors.inkMuted },
  title: { ...Typography.title, color: Colors.ink },
  meta: { ...Typography.body, color: Colors.inkMuted },
  note: { ...Typography.body, color: Colors.ink },
});
```

- [ ] **Step 5: Verifica**

Run: `npx tsc --noEmit` (nessuna rotta toccata — questi componenti non sono ancora referenziati da alcuna route).
Expected: pulito.

- [ ] **Step 6: Commit**

```bash
git add src/components/DetailModal.tsx src/features/work-sessions/useWorkSessions.ts src/features/work-sessions/WorkSessionDetail.tsx src/features/family-calendar/FamilyOccurrenceDetail.tsx
git commit -m "feat: add shared detail modal, work session note editing, and detail content components"
```

---

### Task 4: `CalendarView` — card a due zone, bottoni toggle ristilizzati

**Files:**
- Modify: `src/components/CalendarView.tsx`

**Interfaces:**
- Consumes: `Colors`/`Radii`/`Typography` (già esistenti + Task 2)
- Produces: nessuna nuova interfaccia — solo stile. `renderDay` continua a ricevere `(date, meta)` esattamente come prima; il Task 5 userà questa firma invariata.

- [ ] **Step 1: Sostituisci gli stili di `src/components/CalendarView.tsx`**

Sostituisci l'intero blocco `const styles = StyleSheet.create({...})` in fondo al file con:

```typescript
const styles = StyleSheet.create({
  container: { gap: 8 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: 8,
    alignItems: 'center',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  modeButtonActive: { borderColor: Colors.accent },
  modeText: { ...Typography.body, color: Colors.inkMuted },
  modeTextActive: { ...Typography.bodyBold, color: Colors.ink },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { padding: 8, minWidth: 36, alignItems: 'center' },
  navButtonText: { fontSize: 20, fontWeight: '600', color: Colors.ink },
  periodLabel: { ...Typography.bodyBold, color: Colors.ink },
  weekdayHeaderRow: { flexDirection: 'row', gap: 4 },
  weekdayHeaderText: { flex: 1, textAlign: 'center', ...Typography.caption, color: Colors.inkMuted },
  weekRow: { flexDirection: 'row', gap: 4 },
  dayCell: {
    flex: 1,
    minHeight: 72,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.surface,
    padding: 4,
  },
  dayCellDimmed: { opacity: 0.4 },
  weekdayLabel: { fontSize: 10, color: Colors.inkMuted, textAlign: 'center' },
  dayNumber: { fontSize: 13, fontWeight: '600', textAlign: 'center', color: Colors.ink },
});
```

Aggiungi l'import di `Colors`, `Radii`, `Typography` in cima al file (accanto agli import già presenti):

```typescript
import { Colors, Radii, Typography } from '../lib/theme';
```

Nota: `dayCell` perde `overflow: 'hidden'` rispetto a prima — il contenuto (due zone con elenco voci, iniettato dal Task 5) deve restare visibile per intero, non essere ritagliato come lo era il piccolo indicatore di stato precedente.

- [ ] **Step 2: Verifica**

Run: `npx tsc --noEmit` (nessuna rotta toccata — `CalendarView.tsx` è un componente condiviso, non una rotta).
Expected: pulito.

- [ ] **Step 3: Commit**

```bash
git add src/components/CalendarView.tsx
git commit -m "style: restyle CalendarView day cells and mode toggle to the redesign tokens"
```

---

### Task 5: Tab Calendario (`index.tsx`) — card a due zone, colori per categoria, apertura modale

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `splitByHalfDay` (Task 1), `Colors.morningTint`/`Colors.afternoonTint`/`Colors.actionBrown` (Task 2), `FAMILY_CATEGORY_COLORS` (Task 2), `DetailModal` (Task 3), `WorkSessionDetail` (Task 3), `FamilyOccurrenceDetail` (Task 3), `useClients` (già esistente)
- Produces: nessuna nuova interfaccia — ultimo consumatore di questa catena per la vista Calendario

- [ ] **Step 1: Sostituisci `src/app/(tabs)/index.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { CalendarView } from '../../components/CalendarView';
import { DetailModal } from '../../components/DetailModal';
import { useAllWorkSessionsStatus } from '../../features/work-sessions/useWorkSessions';
import type { WorkSessionStatus } from '../../features/work-sessions/useWorkSessions';
import { WorkSessionDetail } from '../../features/work-sessions/WorkSessionDetail';
import { useClients } from '../../features/clients/useClients';
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { useAllCalendarEvents } from '../../features/family-calendar/useCalendarEvents';
import { expandOccurrences } from '../../features/family-calendar/recurringOccurrences';
import type { Occurrence } from '../../features/family-calendar/recurringOccurrences';
import { FamilyOccurrenceDetail } from '../../features/family-calendar/FamilyOccurrenceDetail';
import { FAMILY_CATEGORY_COLORS } from '../../features/family-calendar/constants';
import { splitByHalfDay } from '../../features/calendar/dayHalves';
import { addDays, toLocalDateString } from '../../lib/dates';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

type CalendarSection = 'lavoro' | 'francesca';

function WorkChip({ session, clientName, onPress }: { session: WorkSessionStatus; clientName: string; onPress: () => void }) {
  return (
    <Pressable
      style={styles.chip}
      onPress={(e) => {
        // Il chip vive dentro la cella-giorno, che ha il proprio Pressable
        // (onDayPress). Su web (react-native-web) i click del DOM
        // continuano a propagare fino al genitore anche tra due Pressable
        // RN annidati — senza stopPropagation, toccare un chip aprirebbe
        // il modale E navigherebbe alla pagina del giorno.
        e.stopPropagation();
        onPress();
      }}
    >
      <View style={[styles.chipDot, { backgroundColor: Colors.accent }]} />
      <Text style={styles.chipText} numberOfLines={1}>
        {session.start_time && session.end_time ? `${session.start_time}–${session.end_time} ` : ''}
        {clientName}
      </Text>
    </Pressable>
  );
}

function FamilyChip({ occurrence, onPress }: { occurrence: Occurrence; onPress: () => void }) {
  return (
    <Pressable
      style={styles.chip}
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      <View style={[styles.chipDot, { backgroundColor: FAMILY_CATEGORY_COLORS[occurrence.category] }]} />
      <Text style={styles.chipText} numberOfLines={1}>
        {occurrence.start_time && occurrence.end_time ? `${occurrence.start_time}–${occurrence.end_time} ` : ''}
        {occurrence.title}
      </Text>
    </Pressable>
  );
}

function DayHalves<T extends { start_time: string | null }>({ items, renderChip }: { items: T[]; renderChip: (item: T) => ReactNode }) {
  const { morning, afternoon } = splitByHalfDay(items);
  return (
    <View style={styles.halves}>
      <View style={[styles.half, { backgroundColor: Colors.morningTint }]}>{morning.map(renderChip)}</View>
      <View style={styles.halfDivider} />
      <View style={[styles.half, { backgroundColor: Colors.afternoonTint }]}>{afternoon.map(renderChip)}</View>
    </View>
  );
}

export default function CalendarioScreen() {
  const [section, setSection] = useState<CalendarSection>('lavoro');
  const [selectedSession, setSelectedSession] = useState<WorkSessionStatus | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<Occurrence | null>(null);

  const { data: sessions } = useAllWorkSessionsStatus();
  const { data: clients } = useClients();
  const clientName = (clientId: string) => clients?.find((c) => c.id === clientId)?.name ?? 'Cliente';

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkSessionStatus[]>();
    for (const s of sessions ?? []) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [sessions]);

  const { data: templates } = useRecurringTemplates();
  const { data: events } = useAllCalendarEvents();
  const occurrencesByDate = useMemo(() => {
    const today = toLocalDateString(new Date());
    const range = { start: addDays(today, -90), end: addDays(today, 365) };
    const occurrences = expandOccurrences(templates ?? [], events ?? [], range);
    const map = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      const list = map.get(o.date) ?? [];
      list.push(o);
      map.set(o.date, list);
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
          renderDay={(date) => (
            <DayHalves
              items={sessionsByDate.get(date) ?? []}
              renderChip={(s) => (
                <WorkChip key={s.id} session={s} clientName={clientName(s.client_id)} onPress={() => setSelectedSession(s)} />
              )}
            />
          )}
          onDayPress={(date) => router.push(`/day/${date}`)}
        />
      ) : (
        <CalendarView
          key="francesca"
          initialView="week"
          renderDay={(date) => (
            <DayHalves
              items={occurrencesByDate.get(date) ?? []}
              renderChip={(o) => <FamilyChip key={o.id} occurrence={o} onPress={() => setSelectedOccurrence(o)} />}
            />
          )}
          onDayPress={(date) => router.push(`/family-day/${date}`)}
        />
      )}

      <DetailModal visible={!!selectedSession} onClose={() => setSelectedSession(null)}>
        {selectedSession && <WorkSessionDetail session={selectedSession} clientName={clientName(selectedSession.client_id)} />}
      </DetailModal>

      <DetailModal visible={!!selectedOccurrence} onClose={() => setSelectedOccurrence(null)}>
        {selectedOccurrence && <FamilyOccurrenceDetail occurrence={selectedOccurrence} />}
      </DetailModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.md },
  title: { ...Typography.title, color: Colors.ink },
  sectionToggle: { flexDirection: 'row', gap: Spacing.sm },
  sectionButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: 10,
    alignItems: 'center',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionButtonActive: { borderColor: Colors.accent },
  sectionText: { ...Typography.body, color: Colors.inkMuted },
  sectionTextActive: { ...Typography.bodyBold, color: Colors.ink },
  halves: { flex: 1, gap: 2 },
  half: { flex: 1, borderRadius: Radii.sm, padding: 2, gap: 2 },
  halfDivider: { height: 1, backgroundColor: Colors.hairline },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 10, color: Colors.ink, flexShrink: 1 },
});
```

- [ ] **Step 2: Verifica (sequenza anti-stale-router-types — questo task tocca `src/app/`)**

Avvia `npx expo start --web --port <N>` in background, attendi `"Waiting on http://..."`, forza un bundle con `curl`, attendi, poi `npx tsc --noEmit`, poi killa il server.
Expected: pulito.

- [ ] **Step 3: Verifica manuale**

Conferma che: `DayHalves` sia generico su entrambi i tipi (`WorkSessionStatus` e `Occurrence`, entrambi hanno `start_time: string | null`); `WorkChip`/`FamilyChip` chiamino `e.stopPropagation()` prima di `onPress()` (il codice sopra già lo fa — verifica solo che non sia stato rimosso/alterato), così il tap su un chip apra il modale senza propagare anche `onDayPress` della cella-giorno sottostante su cui è innestato.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "feat: two-zone day cards with per-category colors and detail modal on the Calendario tab"
```

---

### Task 6: `day/[date].tsx` — sfondo coerente, card grandi, nota modificabile

**Files:**
- Modify: `src/app/day/[date].tsx`

**Interfaces:**
- Consumes: `DetailModal`, `WorkSessionDetail` (Task 3), `Colors.actionBrown` (Task 2)
- Produces: nessuna nuova interfaccia

- [ ] **Step 1: Sostituisci `src/app/day/[date].tsx`**

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../../features/clients/useClients';
import { useAllWorkSessionsStatus } from '../../features/work-sessions/useWorkSessions';
import type { WorkSessionStatus } from '../../features/work-sessions/useWorkSessions';
import { WorkSessionDetail } from '../../features/work-sessions/WorkSessionDetail';
import { DetailModal } from '../../components/DetailModal';
import { formatDayLabel } from '../../features/calendar/calendarGrid';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessionsStatus();
  const [selectedSession, setSelectedSession] = useState<WorkSessionStatus | null>(null);

  const daySessions = (sessions ?? []).filter((s) => s.date === date);
  const clientName = (clientId: string) => clients?.find((c) => c.id === clientId)?.name ?? 'Cliente';

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Indietro</Text>
      </Pressable>
      <Text style={styles.title}>{formatDayLabel(date)}</Text>

      <FlatList
        style={{ flex: 1 }}
        data={daySessions}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelectedSession(item)}>
            <Text style={styles.clientName}>{clientName(item.client_id)}</Text>
            <Text style={styles.meta}>
              {item.hours}h — €{item.amount_due.toFixed(2)}
              {item.start_time && item.end_time ? ` — ${item.start_time}–${item.end_time}` : ''}
            </Text>
            {item.note && <Text style={styles.note}>{item.note}</Text>}
          </Pressable>
        )}
        ListEmptyComponent={<Text>Nessuna giornata lavorata in questo giorno.</Text>}
      />

      <Pressable style={styles.addButton} onPress={() => router.push({ pathname: '/add-work-session', params: { date } })}>
        <Text style={styles.addButtonText}>+ Giornata</Text>
      </Pressable>

      <DetailModal visible={!!selectedSession} onClose={() => setSelectedSession(null)}>
        {selectedSession && <WorkSessionDetail session={selectedSession} clientName={clientName(selectedSession.client_id)} />}
      </DetailModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.md, backgroundColor: Colors.canvas },
  back: { color: Colors.ink, marginBottom: Spacing.xs },
  title: { ...Typography.title, color: Colors.ink },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  clientName: { ...Typography.title, color: Colors.ink },
  meta: { ...Typography.body, color: Colors.inkMuted },
  note: { ...Typography.body, color: Colors.ink },
  addButton: {
    backgroundColor: Colors.actionBrown,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: Spacing.md,
  },
  addButtonText: { ...Typography.bodyBold, color: Colors.surface },
});
```

- [ ] **Step 2: Verifica (sequenza anti-stale-router-types — questo task tocca `src/app/`)**

Stessa sequenza del Task 5, porta diversa.
Expected: pulito.

- [ ] **Step 3: Verifica manuale**

Conferma che il container abbia `backgroundColor: Colors.canvas` esplicito (questa schermata è fuori da `AppShell`, non lo eredita); che il bottone "+ Giornata" abbia `alignSelf: 'center'` (non più a piena larghezza) e `backgroundColor: Colors.actionBrown`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/day/[date].tsx"
git commit -m "style: restyle day detail screen with canvas background, big cards, and editable note modal"
```

---

### Task 7: `family-day/[date].tsx` — colori per categoria, apertura modale

**Files:**
- Modify: `src/app/family-day/[date].tsx`

**Interfaces:**
- Consumes: `DetailModal`, `FamilyOccurrenceDetail` (Task 3), `FAMILY_CATEGORY_COLORS` (Task 2), `Colors.actionBrown` (Task 2)
- Produces: nessuna nuova interfaccia — ultimo task del piano

- [ ] **Step 1: Sostituisci `src/app/family-day/[date].tsx`**

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { useAllCalendarEvents, useUpsertOccurrenceOverride } from '../../features/family-calendar/useCalendarEvents';
import { expandOccurrences } from '../../features/family-calendar/recurringOccurrences';
import type { Occurrence } from '../../features/family-calendar/recurringOccurrences';
import { FamilyOccurrenceDetail } from '../../features/family-calendar/FamilyOccurrenceDetail';
import { DetailModal } from '../../components/DetailModal';
import { formatDayLabel } from '../../features/calendar/calendarGrid';
import { FAMILY_CATEGORIES, FAMILY_CATEGORY_COLORS } from '../../features/family-calendar/constants';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

export default function FamilyDayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: templates } = useRecurringTemplates();
  const { data: events } = useAllCalendarEvents();
  const skipOccurrence = useUpsertOccurrenceOverride();
  const [selectedOccurrence, setSelectedOccurrence] = useState<Occurrence | null>(null);

  const occurrences = expandOccurrences(templates ?? [], events ?? [], { start: date, end: date });
  const categoryLabel = (value: string) => FAMILY_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  const handleSkip = (occurrence: Occurrence) => {
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
            <Pressable style={styles.rowMain} onPress={() => setSelectedOccurrence(item)}>
              <View style={styles.rowTitleRow}>
                <View style={[styles.categoryDot, { backgroundColor: FAMILY_CATEGORY_COLORS[item.category] }]} />
                <Text style={styles.rowTitle}>{item.title} — {item.person}</Text>
              </View>
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

      <Pressable style={styles.addButton} onPress={() => router.push({ pathname: '/add-family-event', params: { date } })}>
        <Text style={styles.addButtonText}>+ Evento</Text>
      </Pressable>

      <DetailModal visible={!!selectedOccurrence} onClose={() => setSelectedOccurrence(null)}>
        {selectedOccurrence && <FamilyOccurrenceDetail occurrence={selectedOccurrence} />}
      </DetailModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.sm, backgroundColor: Colors.canvas },
  back: { color: Colors.ink, marginBottom: Spacing.xs },
  title: { ...Typography.title, color: Colors.ink },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  rowMain: { flex: 1 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { ...Typography.bodyBold, color: Colors.ink },
  rowMeta: { ...Typography.small, color: Colors.inkMuted },
  skipLink: { color: Colors.error, marginLeft: Spacing.sm },
  addButton: {
    backgroundColor: Colors.actionBrown,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: Spacing.md,
  },
  addButtonText: { ...Typography.bodyBold, color: Colors.surface },
});
```

- [ ] **Step 2: Verifica (sequenza anti-stale-router-types — questo task tocca `src/app/`)**

Stessa sequenza dei Task 5/6, porta diversa.
Expected: pulito.

- [ ] **Step 3: Verifica manuale**

Conferma che: il tap sulla riga apra il modale (non navighi più direttamente a `edit-family-event.tsx` — quella navigazione ora vive dentro `FamilyOccurrenceDetail`, raggiungibile dal bottone "Modifica" nel modale); "Salta oggi" resti un `Pressable` separato e sia ancora funzionante (non innestato dentro `rowMain`, che ora apre il modale); il bottone "+ Evento" abbia lo stesso trattamento (marrone, stretto, alto) del bottone "+ Giornata" del Task 6.

- [ ] **Step 4: Commit**

```bash
git add "src/app/family-day/[date].tsx"
git commit -m "style: restyle family day detail screen with category colors and detail modal"
```

---

## Al termine di questo piano

Deliverable funzionante e verificabile: il tab Calendario mostra, in tutte e tre le viste (Giorno/Settimana/Mese), una card bianca con bordo azzurro per ogni giorno, divisa in due zone Mattina/Pomeriggio con le voci elencate e l'orario visibile; le voci di Francesca hanno un pallino colorato per categoria; toccare una voce apre una finestra modale invece di navigare altrove; `day/[date].tsx` ha lo sfondo coerente col resto dell'app, card grandi per cliente, e permette di modificare la nota di una giornata già salvata (prima non possibile); entrambi i bottoni "+" sono marroni, stretti e alti. Nessuna migrazione di schema in questo piano (i dati necessari esistevano già dal Piano 1).

## Self-Review (fatto durante la scrittura del piano)

- **Copertura spec:** §3.1 (card a due zone, funzione pura) → Task 1, 4, 5. §3.2 (colori categoria) → Task 2, usati in Task 5/7. §3.3 (modale) → Task 3, usato in Task 5/6/7. §3.4 (`family-day` colori + modale) → Task 7. §3.5 (`day/[date]` sfondo/card/nota/bottone) → Task 6. §3.6 (padding/dimensioni/bottoni toggle tab Calendario) → Task 4 (toggle Giorno/Settimana/Mese dentro `CalendarView`) e Task 5 (toggle Lavoro/Francesca + padding dentro `index.tsx`). Nessun requisito della sezione 3 rimasto scoperto.
- **Niente placeholder:** ogni step ha codice completo, nessun TODO/TBD.
- **Coerenza dei tipi tra task:** `splitByHalfDay`/`HalfDaySplit` (Task 1) → stesso nome/firma usato in `DayHalves` (Task 5). `Colors.morningTint`/`afternoonTint`/`actionBrown` (Task 2) → stessi nomi in Task 4/5/6/7. `FAMILY_CATEGORY_COLORS` (Task 2) → stesso nome in Task 3 (`FamilyOccurrenceDetail`), Task 5, Task 7. `DetailModal`/`WorkSessionDetail`/`FamilyOccurrenceDetail` (Task 3) → stessi nomi/props (`visible`/`onClose`/`children`, `session`/`clientName`, `occurrence`) in Task 5/6/7. Verificato manualmente, nessuna discrepanza.
- **Nota di design non esplicitata dalla spec, decisa scrivendo il piano:** la spec descrive il colore per categoria come "tinge il chip" senza specificare se il colore sta dietro il testo o accanto. Ho scelto un pallino colorato accanto al testo (non uno sfondo colorato pieno) per evitare di dover verificare a occhio, in un ambiente senza strumenti di verifica visiva, il contrasto testo/sfondo per 6 colori diversi (già una fonte di bug reale in questo progetto, vedi Blocco A) — annotato esplicitamente nei Global Constraints.
