# Blocco B — Piano 3: Pagamenti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ristilizzare il tab Pagamenti (`pagamenti.tsx`) secondo il layout a card decise con l'utente (righe di riepilogo e righe cliente come card a piena larghezza, non una tabella), con drill-down per cliente su ciascuna delle 4 metriche di riepilogo tramite una nuova schermata (`payment-detail.tsx`).

**Architecture:** Nessuna nuova tabella/migrazione — riuso completo di `computeClientSummary`/`dateRangeForPeriod`/`filterByDateRange` (già esistenti e testati). La logica di accoppiamento cliente↔riepilogo, oggi inline e duplicata implicitamente ogni volta che serve, viene estratta in una funzione pura testata (`buildClientPaymentRows`) usata da entrambe le schermate (Pagamenti e il nuovo drill-down). Un componente condiviso (`PressableCard`) è il guscio generico per ogni card interattiva (bordo hairline a riposo → colore accento su hover/pressione) — stessa separazione "guscio generico + contenuto specifico" già vista nel progetto (`CalendarView`+`renderDay`, `DetailModal`+contenuti di dominio).

**Tech Stack:** Stesso stack dei blocchi precedenti — Expo Router, TypeScript, `StyleSheet` nativo, TanStack Query, Jest. Nessuna nuova dipendenza.

**Spec:** `docs/superpowers/specs/2026-09-20-blocco-b-calendario-pagamenti-design.md`, sezione 4 — **con un'eccezione esplicita decisa con l'utente in questa sessione, che sovrascrive interamente il §4.3 della spec scritta**: niente eccezione "bottoni marroni su hover" per le righe di riepilogo. Tutte le card di questa schermata (righe di riepilogo E righe cliente, non solo le 4 di §4.1) riusano invece il pattern di interazione già stabilito nel Calendario (Piano 2): bordo hairline a riposo, bordo color accento (`Colors.accent`) su hover (web) o pressione (mobile). Nessun nuovo token colore (§4.3 avrebbe introdotto `Colors.rowHighlight` — non serve più).

**Precede questo piano (già completato):** Piano 1 (schema orari, non consumato qui) e Piano 2 (Calendario ristilizzato — questo piano riusa lo stesso pattern di interazione hover/pressione a bordo-accento, generalizzandolo dai soli toggle Giorno/Settimana/Mese a un componente riusabile).

## Global Constraints

- **Interazione card — pattern unico per tutta questa schermata**: bordo `Colors.hairline` a riposo, `Colors.accent` (`#96C2DB`) su hover (web, via `onHoverIn`/`onHoverOut` di `Pressable` — verificato che questi prop esistono nei typing di React Native in questo progetto) o pressione (mobile, stato `pressed` di `Pressable`). Nessuna eccezione marrone: il §4.3 della spec scritta è superato da questa decisione, presa con l'utente in questa sessione.
- **Le card occupano tutta la larghezza disponibile CON margine laterale** — a differenza del Calendario (Piano 2), questa schermata NON esce dal `maxWidth` di `AppShell` (nessuna chiamata a `useFullWidthContent`). "Piena larghezza" qui significa: la card riempie lo spazio orizzontale dentro il padding della pagina, non il viewport intero.
- **Bordi arrotondati**: `Radii.md` (12), coerente con `Card.tsx`/le celle del Calendario — non `Radii.sm` (che nel progetto è riservato a bottoni compatti tipo i toggle periodo).
- **Ordine dei task non è quello "naturale"**: `payment-detail.tsx` (Task 3) va creato PRIMA del restyle di `pagamenti.tsx` (Task 4), perché `pagamenti.tsx` referenzia la rotta `/payment-detail` — se create nell'ordine opposto, la sequenza di verifica anti-stale-router-types del Task 3-vecchio-ordine fallirebbe con un falso errore di rotta inesistente. Segui l'ordine dei task come numerato in questo piano.
- **Riuso di `computeClientSummary`/`dateRangeForPeriod`/`filterByDateRange` invariati** (`src/features/payments/computeClientSummary.ts`) — questo piano non tocca quel file, la nuova funzione pura del Task 1 li compone soltanto.
- **Verifica route (`.expo/types/router.d.ts`)**: per ogni task che modifica un file sotto `src/app/`, usare la sequenza anti-stale-router-types (avvia `npx expo start --web --port <N>` in background → attendi `"Waiting on http://..."` → `curl` per forzare un bundle reale → attendi qualche secondo → `npx tsc --noEmit` → killa il server con `netstat -ano | grep :<N>` poi `taskkill //F //PID <pid>` su Windows, e VERIFICA con un secondo `netstat` che il processo sia davvero terminato, non solo che il comando sia tornato con successo). Per task che toccano solo `src/features/`/`src/components/` un `npx tsc --noEmit` semplice basta.
- Questo ambiente di esecuzione non ha strumenti di browser headless/interattivo — la verifica finale dell'aspetto reale (colori, hover, layout) resta a carico dell'utente.

---

### Task 1: Funzione pura — righe cliente↔riepilogo (TDD)

**Files:**
- Create: `src/features/payments/clientPaymentRows.ts`
- Create: `src/features/payments/clientPaymentRows.test.ts`

**Interfaces:**
- Consumes: `computeClientSummary`, `dateRangeForPeriod`, `filterByDateRange`, `Period`, `ClientSummary` (già esistenti in `src/features/payments/computeClientSummary.ts`), `Client` (`src/features/clients/useClients.ts`), `WorkSession` (`src/features/work-sessions/useWorkSessions.ts`), `Payment` (`src/features/payments/usePayments.ts`)
- Produces: `ClientPaymentRow` (`{client: Client; summary: ClientSummary}`), `buildClientPaymentRows(clients: Client[], sessions: WorkSession[], payments: Payment[], period: Period, now?: Date): ClientPaymentRow[]` — usata dai Task 3 e 4

- [ ] **Step 1: Scrivi il test in `src/features/payments/clientPaymentRows.test.ts`**

```typescript
import { buildClientPaymentRows } from './clientPaymentRows';
import type { Client } from '../clients/useClients';
import type { WorkSession } from '../work-sessions/useWorkSessions';
import type { Payment } from './usePayments';

function client(id: string, name: string): Client {
  return { id, name, hourly_rate: 20, active: true };
}

function session(id: string, clientId: string, date: string, hours: number, amountDue: number): WorkSession {
  return { id, client_id: clientId, date, hours, rate_snapshot: 20, amount_due: amountDue, start_time: null, end_time: null, note: null };
}

function payment(id: string, clientId: string, date: string, amount: number): Payment {
  return { id, client_id: clientId, date, amount, note: null };
}

describe('buildClientPaymentRows', () => {
  it('pairs each client with a summary of only their own sessions and payments', () => {
    const clients = [client('a', 'Alice'), client('b', 'Bob')];
    const sessions = [session('s1', 'a', '2026-06-01', 3, 60), session('s2', 'b', '2026-06-01', 2, 40)];
    const payments = [payment('p1', 'a', '2026-06-01', 30)];

    const rows = buildClientPaymentRows(clients, sessions, payments, 'all');

    expect(rows).toEqual([
      { client: clients[0], summary: { totalHours: 3, totalDue: 60, totalPaid: 30, balance: 30 } },
      { client: clients[1], summary: { totalHours: 2, totalDue: 40, totalPaid: 0, balance: 40 } },
    ]);
  });

  it('gives a client with no sessions or payments a zeroed summary instead of omitting them', () => {
    const clients = [client('a', 'Alice')];
    const rows = buildClientPaymentRows(clients, [], [], 'all');
    expect(rows).toEqual([{ client: clients[0], summary: { totalHours: 0, totalDue: 0, totalPaid: 0, balance: 0 } }]);
  });

  it('applies the period filter before aggregating, excluding sessions outside the range', () => {
    const clients = [client('a', 'Alice')];
    const now = new Date('2026-06-15');
    const sessions = [session('old', 'a', '2026-01-01', 5, 100), session('recent', 'a', '2026-06-10', 2, 40)];

    const rows = buildClientPaymentRows(clients, sessions, [], 'week', now);

    expect(rows[0].summary).toEqual({ totalHours: 2, totalDue: 40, totalPaid: 0, balance: 40 });
  });

  it('returns rows in the same order as the input clients array', () => {
    const clients = [client('b', 'Bob'), client('a', 'Alice')];
    const rows = buildClientPaymentRows(clients, [], [], 'all');
    expect(rows.map((r) => r.client.id)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/features/payments/clientPaymentRows.test.ts`
Expected: FAIL — `Cannot find module './clientPaymentRows'`

- [ ] **Step 3: Scrivi `src/features/payments/clientPaymentRows.ts`**

```typescript
import { computeClientSummary, dateRangeForPeriod, filterByDateRange } from './computeClientSummary';
import type { ClientSummary, Period } from './computeClientSummary';
import type { Client } from '../clients/useClients';
import type { WorkSession } from '../work-sessions/useWorkSessions';
import type { Payment } from './usePayments';

export interface ClientPaymentRow {
  client: Client;
  summary: ClientSummary;
}

/** Accoppia ogni cliente al proprio riepilogo (ore/dovuto/ricevuto/saldo), filtrato per periodo — stessa logica prima duplicata inline in pagamenti.tsx, ora condivisa anche dal drill-down per metrica. */
export function buildClientPaymentRows(
  clients: Client[],
  sessions: WorkSession[],
  payments: Payment[],
  period: Period,
  now = new Date()
): ClientPaymentRow[] {
  const range = dateRangeForPeriod(period, now);
  const filteredSessions = filterByDateRange(sessions, range);
  const filteredPayments = filterByDateRange(payments, range);

  return clients.map((client) => {
    const clientSessions = filteredSessions.filter((s) => s.client_id === client.id);
    const clientPayments = filteredPayments.filter((p) => p.client_id === client.id);
    return { client, summary: computeClientSummary(clientSessions, clientPayments) };
  });
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/features/payments/clientPaymentRows.test.ts`
Expected: PASS, 4 test.

- [ ] **Step 5: Verifica**

Run: `npx tsc --noEmit` (nessuna rotta toccata).
Expected: pulito.

- [ ] **Step 6: Commit**

```bash
git add src/features/payments/clientPaymentRows.ts src/features/payments/clientPaymentRows.test.ts
git commit -m "feat: add pure client-payment-row builder shared by Pagamenti and its drill-down"
```

---

### Task 2: Componente condiviso `PressableCard` + config metriche di pagamento

**Files:**
- Create: `src/components/PressableCard.tsx`
- Create: `src/features/payments/constants.ts`

**Interfaces:**
- Consumes: `Colors`/`Radii`/`Spacing` (già esistenti in `src/lib/theme.ts`), `ClientSummary` (già esistente in `src/features/payments/computeClientSummary.ts`, non prodotta da questo piano — solo il suo tipo `keyof` viene riusato qui)
- Produces: `PressableCard({onPress, children, style?})` (`src/components/PressableCard.tsx`), `PaymentMetric` (`= keyof ClientSummary`), `PAYMENT_METRICS: {key: PaymentMetric; label: string; format: (value: number) => string}[]` (`src/features/payments/constants.ts`) — usati dai Task 3 e 4

- [ ] **Step 1: Scrivi `src/components/PressableCard.tsx`**

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Colors, Radii, Spacing } from '../lib/theme';

interface PressableCardProps {
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Card a piena larghezza con bordo che diventa color accento su hover (web) o pressione (mobile) — generalizza il pattern dei toggle Giorno/Settimana/Mese del Calendario (Piano 2) in un guscio riusabile per qualunque riga interattiva. */
export function PressableCard({ onPress, children, style }: PressableCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [styles.card, (hovered || pressed) && styles.cardHighlighted, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHighlighted: { borderColor: Colors.accent },
});
```

- [ ] **Step 2: Scrivi `src/features/payments/constants.ts`**

```typescript
import type { ClientSummary } from './computeClientSummary';

export type PaymentMetric = keyof ClientSummary;

export const PAYMENT_METRICS: { key: PaymentMetric; label: string; format: (value: number) => string }[] = [
  { key: 'totalHours', label: 'Ore totali', format: (v) => `${v.toFixed(2)}h` },
  { key: 'totalDue', label: 'Dovuto', format: (v) => `€${v.toFixed(2)}` },
  { key: 'totalPaid', label: 'Ricevuto', format: (v) => `€${v.toFixed(2)}` },
  { key: 'balance', label: 'Saldo', format: (v) => `€${v.toFixed(2)}` },
];
```

- [ ] **Step 3: Verifica**

Run: `npx tsc --noEmit` (nessuna rotta toccata — questi file non sono ancora referenziati da alcuna route).
Expected: pulito.

- [ ] **Step 4: Commit**

```bash
git add src/components/PressableCard.tsx src/features/payments/constants.ts
git commit -m "feat: add shared hover-accent card shell and payment metric config"
```

---

### Task 3: Nuova schermata `payment-detail.tsx` (drill-down per metrica)

**Files:**
- Create: `src/app/payment-detail.tsx`

**Interfaces:**
- Consumes: `buildClientPaymentRows`/`ClientPaymentRow` (Task 1), `PressableCard` (Task 2), `PAYMENT_METRICS`/`PaymentMetric` (Task 2), `Period` (già esistente), `useClients`/`useAllWorkSessions`/`useAllPayments` (già esistenti)
- Produces: nessuna nuova interfaccia — consumato dal Task 4 solo come rotta (`router.push({pathname: '/payment-detail', params: {metric, period}})`), non importato direttamente

- [ ] **Step 1: Scrivi `src/app/payment-detail.tsx`**

```tsx
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../features/clients/useClients';
import { useAllWorkSessions } from '../features/work-sessions/useWorkSessions';
import { useAllPayments } from '../features/payments/usePayments';
import { buildClientPaymentRows } from '../features/payments/clientPaymentRows';
import type { ClientPaymentRow } from '../features/payments/clientPaymentRows';
import { PAYMENT_METRICS } from '../features/payments/constants';
import type { PaymentMetric } from '../features/payments/constants';
import type { Period } from '../features/payments/computeClientSummary';
import { PressableCard } from '../components/PressableCard';
import { Colors, Spacing, Typography } from '../lib/theme';

export default function PaymentDetailScreen() {
  const { metric, period } = useLocalSearchParams<{ metric: PaymentMetric; period: Period }>();
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessions();
  const { data: payments } = useAllPayments();

  const metricConfig = PAYMENT_METRICS.find((m) => m.key === metric);
  if (!metricConfig) return <Text style={styles.padded}>Metrica non valida.</Text>;

  const rows = buildClientPaymentRows(clients ?? [], sessions ?? [], payments ?? [], period);

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Indietro</Text>
      </Pressable>
      <Text style={styles.title}>{metricConfig.label}</Text>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(r) => r.client.id}
        renderItem={({ item }: { item: ClientPaymentRow }) => (
          <PressableCard onPress={() => router.push(`/client/${item.client.id}`)}>
            <Text style={styles.clientName}>{item.client.name}</Text>
            <Text style={styles.clientValue}>{metricConfig.format(item.summary[metricConfig.key])}</Text>
          </PressableCard>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nessun cliente ancora.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.md, backgroundColor: Colors.canvas },
  padded: { padding: Spacing.lg },
  back: { color: Colors.ink, marginBottom: Spacing.xs },
  title: { ...Typography.title, color: Colors.ink },
  list: { flex: 1 },
  listContent: { gap: Spacing.sm, paddingTop: Spacing.xs },
  clientName: { ...Typography.bodyBold, color: Colors.ink },
  clientValue: { ...Typography.title, color: Colors.ink },
  empty: { ...Typography.body, color: Colors.inkMuted },
});
```

Nota: `backgroundColor: Colors.canvas` esplicito sul container — questa schermata è fuori dal gruppo `(tabs)` (come `day/[date].tsx`/`family-day/[date].tsx` nel Piano 2), non eredita lo sfondo di `AppShell`.

- [ ] **Step 2: Verifica (sequenza anti-stale-router-types — questo task crea una NUOVA rotta sotto `src/app/`)**

Avvia `npx expo start --web --port <N>` in background, attendi `"Waiting on http://..."`, forza un bundle con `curl`, attendi qualche secondo, poi `npx tsc --noEmit`, poi killa il server e verifica con un secondo `netstat` che il processo sia davvero terminato.
Expected: pulito.

- [ ] **Step 3: Commit**

```bash
git add src/app/payment-detail.tsx
git commit -m "feat: add per-client drill-down screen for a payment summary metric"
```

---

### Task 4: Restyle `pagamenti.tsx` — card di riepilogo e card cliente

**Files:**
- Modify: `src/app/(tabs)/pagamenti.tsx`

**Interfaces:**
- Consumes: `buildClientPaymentRows`/`ClientPaymentRow` (Task 1), `PressableCard` (Task 2), `PAYMENT_METRICS` (Task 2), `Period` (già esistente), la rotta `/payment-detail` (Task 3, già esistente a questo punto — vedi Global Constraints sull'ordine dei task)
- Produces: nessuna nuova interfaccia — ultimo task del piano

- [ ] **Step 1: Sostituisci `src/app/(tabs)/pagamenti.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useClients } from '../../features/clients/useClients';
import { useAllWorkSessions } from '../../features/work-sessions/useWorkSessions';
import { useAllPayments } from '../../features/payments/usePayments';
import type { Period } from '../../features/payments/computeClientSummary';
import { buildClientPaymentRows } from '../../features/payments/clientPaymentRows';
import type { ClientPaymentRow } from '../../features/payments/clientPaymentRows';
import { PAYMENT_METRICS } from '../../features/payments/constants';
import { PressableCard } from '../../components/PressableCard';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

const PERIOD_LABELS: Record<Period, string> = { week: 'Settimana', month: 'Mese', all: 'Tutto' };

export default function PagamentiScreen() {
  const [period, setPeriod] = useState<Period>('all');
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessions();
  const { data: payments } = useAllPayments();

  const rows = buildClientPaymentRows(clients ?? [], sessions ?? [], payments ?? [], period);
  const grandTotal = rows.reduce(
    (acc, r) => ({
      totalHours: acc.totalHours + r.summary.totalHours,
      totalDue: acc.totalDue + r.summary.totalDue,
      totalPaid: acc.totalPaid + r.summary.totalPaid,
      balance: acc.balance + r.summary.balance,
    }),
    { totalHours: 0, totalDue: 0, totalPaid: 0, balance: 0 }
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pagamenti</Text>

      <View style={styles.periodRow}>
        {(['week', 'month', 'all'] as Period[]).map((p) => (
          <Pressable
            key={p}
            style={[styles.periodButton, period === p && styles.periodButtonActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={period === p ? styles.periodTextActive : styles.periodText}>{PERIOD_LABELS[p]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.summaryGrid}>
        {PAYMENT_METRICS.map((metric) => (
          <PressableCard
            key={metric.key}
            onPress={() => router.push({ pathname: '/payment-detail', params: { metric: metric.key, period } })}
          >
            <Text style={styles.summaryLabel}>{metric.label}</Text>
            <Text style={styles.summaryValue}>{metric.format(grandTotal[metric.key])}</Text>
          </PressableCard>
        ))}
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(r) => r.client.id}
        renderItem={({ item }: { item: ClientPaymentRow }) => (
          <PressableCard onPress={() => router.push(`/client/${item.client.id}`)}>
            <Text style={styles.clientName}>{item.client.name}</Text>
            <Text style={styles.clientMeta}>
              {item.summary.totalHours.toFixed(2)}h — dovuto €{item.summary.totalDue.toFixed(2)} — ricevuto €{item.summary.totalPaid.toFixed(2)}
            </Text>
            <Text style={item.summary.balance > 0 ? styles.due : styles.settled}>Saldo: €{item.summary.balance.toFixed(2)}</Text>
          </PressableCard>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nessun cliente ancora.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.md, gap: Spacing.md },
  title: { ...Typography.title, color: Colors.ink },
  periodRow: { flexDirection: 'row', gap: Spacing.sm },
  periodButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    alignItems: 'center',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  periodButtonActive: { borderColor: Colors.accent },
  periodText: { ...Typography.body, color: Colors.inkMuted },
  periodTextActive: { ...Typography.bodyBold, color: Colors.ink },
  summaryGrid: { gap: Spacing.sm },
  summaryLabel: { ...Typography.caption, color: Colors.inkMuted },
  summaryValue: { ...Typography.title, color: Colors.ink },
  list: { flex: 1 },
  listContent: { gap: Spacing.sm, paddingTop: Spacing.xs },
  clientName: { ...Typography.bodyBold, color: Colors.ink },
  clientMeta: { ...Typography.body, color: Colors.inkMuted },
  due: { ...Typography.bodyBold, color: Colors.error },
  settled: { ...Typography.bodyBold, color: Colors.success },
  empty: { ...Typography.body, color: Colors.inkMuted },
});
```

Nota: `periodButton` resta un `Pressable` semplice con bordo attivo persistente (`periodButtonActive`, stesso pattern dei toggle Calendario per uno stato di *selezione*, non di hover) — a differenza delle card di riepilogo/cliente (`PressableCard`, stato *hover/pressione* momentaneo). Sono due semantiche diverse, non vanno confuse nello stesso componente.

- [ ] **Step 2: Verifica (sequenza anti-stale-router-types — questo task tocca `src/app/`, referenzia la rotta `/payment-detail` già creata nel Task 3)**

Stessa sequenza del Task 3, porta diversa.
Expected: pulito — se compare un errore di tipo sulla rotta `/payment-detail`, verifica che il Task 3 sia stato eseguito e committato prima di questo task (vedi Global Constraints).

- [ ] **Step 3: Verifica manuale**

Conferma che: il `FlatList` non sia annidato dentro una `ScrollView` (causerebbe il warning RN "VirtualizedLists should never be nested inside plain ScrollViews") — il container è un `View{flex:1}` con solo il `FlatList` come figlio `flex:1`, non una `ScrollView`; le 4 card di riepilogo e le card cliente usino entrambe `PressableCard` (stesso guscio, stesso bordo hover/pressione); il toggle periodo mantenga il proprio pattern di bordo-attivo persistente invece del pattern hover di `PressableCard`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/pagamenti.tsx"
git commit -m "style: restyle Pagamenti as full-width hover-accent cards with per-metric drill-down"
```

---

## Al termine di questo piano

Deliverable funzionante e verificabile: il tab Pagamenti mostra 4 card di riepilogo (ore totali/dovuto/ricevuto/saldo) e N card cliente, tutte a piena larghezza con margine laterale, bordi arrotondati, bordo che passa da hairline ad accento su hover/pressione (nessuna eccezione marrone); toccare una card di riepilogo apre `payment-detail.tsx` con l'elenco clienti che compone quella metrica; toccare una card cliente (in entrambe le schermate) naviga al dettaglio cliente esistente (`/client/[id]`, invariato). Nessuna migrazione di schema in questo piano.

## Self-Review (fatto durante la scrittura del piano)

- **Copertura spec + override utente:** §4.1 (righe di riepilogo a piena larghezza) → Task 4, ma come card (non "Button-come-riga" testuale) per la richiesta esplicita dell'utente di un look non tabellare. §4.2 (drill-down per cliente, schermata dedicata non modale) → Task 3. §4.3 (eccezione colore hover) → **sovrascritto interamente** dalla decisione utente in questa sessione (bordo accento invece di sfondo marrone) — documentato nei Global Constraints, non nella spec scritta (che resta il record storico della decisione originale, non aggiornata retroattivamente). §4.4 (padding laterale ridotto) → Task 4 (`Spacing.md`, non full-bleed).
- **Niente placeholder:** ogni step ha codice completo, nessun TODO/TBD.
- **Coerenza dei tipi tra task:** `ClientPaymentRow`/`buildClientPaymentRows` (Task 1) → stesso nome/firma in Task 3 e Task 4. `PressableCard` (Task 2) → stesse props (`onPress`/`children`/`style`) in Task 3 e Task 4. `PAYMENT_METRICS`/`PaymentMetric` (Task 2) → stesso nome in Task 3 e Task 4, `metricConfig.key`/`metricConfig.format`/`metricConfig.label` usati identicamente. Verificato manualmente, nessuna discrepanza.
- **Ordine dei task deliberatamente non "1-2-3-4 naturale":** Task 3 (nuova rotta `payment-detail.tsx`) precede il Task 4 (restyle di `pagamenti.tsx` che referenzia quella rotta) proprio per evitare un falso positivo nella sequenza anti-stale-router-types — annotato esplicitamente nei Global Constraints perché è l'unico punto di questo piano dove l'ordine dei task non è quello che ci si aspetterebbe leggendo la spec in ordine (§4.1 prima di §4.2).
