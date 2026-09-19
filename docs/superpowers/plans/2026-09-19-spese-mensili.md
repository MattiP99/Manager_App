# Spese Mensili Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab Spese con riepilogo mensile a sottosezioni per categoria (Supermercato / Frutta e verdura / Extra / Francesca), navigazione mese per mese, aggiunta/modifica/eliminazione di ogni spesa, e sub-totali per attività dentro la sottosezione Francesca (mensa/palestra/cavallo/piscina/teatro).

**Architecture:** Una nuova tabella household-scoped (`expenses`) con lo stesso pattern RLS già stabilito. Nessuna nuova vista Postgres: il dataset mensile di un household è piccolo, quindi i totali per categoria e i sub-totali per attività si calcolano lato client con funzioni pure testabili (`summarizeByCategory`, `summarizeFrancescaByActivity`), riusando `filterByDateRange` già esistente in `computeClientSummary.ts` per il filtro sul mese selezionato. La lista delle categorie è un unico array di configurazione (`EXPENSE_CATEGORIES`) su cui la UI itera, non 4 blocchi copiati — aggiungere una quinta categoria in futuro significa una riga di migrazione + una riga nell'array, non una riscrittura.

**Tech Stack:** Stesso stack dei blocchi precedenti — Expo Router, TypeScript, `@supabase/supabase-js` con tipi generati, TanStack Query, Jest. Nessuna nuova dipendenza.

**Spec:** `docs/superpowers/specs/2026-09-17-family-manager-app-design.md` (sezione 4.4 per lo schema, sezione 5 per la posizione del tab `spese/`)

**Precede questo piano (già completato):** `docs/superpowers/plans/2026-09-18-calendario-familiare.md` — questo piano riusa `FAMILY_CATEGORIES` da `src/features/family-calendar/constants.ts`, `ITALIAN_MONTHS` da `src/features/calendar/calendarGrid.ts`, `filterByDateRange` da `src/features/payments/computeClientSummary.ts`, e `is_household_member(household_id)` da `0002_fix_household_members_rls_recursion.sql`.

**Decisioni di scope confermate con l'utente (brainstorming leggero):**
- 4 sottosezioni (Supermercato / Frutta e verdura / Extra / Francesca), ciascuna con il proprio totale mensile e l'elenco delle proprie spese nel mese selezionato — ma la UI itera su un array di configurazione (`EXPENSE_CATEGORIES`), non 4 blocchi scritti a mano, per rendere economica l'aggiunta di una quinta categoria in futuro.
- Sia modifica che eliminazione di una spesa già inserita (non solo eliminazione).
- L'aggiunta di una spesa parte da un bottone "+" per ciascuna sottosezione — la categoria arriva già precompilata nello schermo di aggiunta e non è modificabile lì.
- La sottosezione Francesca mostra un sub-totale per ciascuna delle 5 attività (mensa/palestra/cavallo/piscina/teatro), non solo un tag per riga.

## Global Constraints

- Nessuna nuova RPC: `expenses` usa RLS via `is_household_member(household_id)` (funzione già esistente), con un'unica policy `for all` per la tabella (using + with check) — stesso pattern di `clients`/`recurring_templates`/`calendar_events`.
- **Vincoli CHECK a livello di database** (stesso principio di `amount_due generated` e degli `unique`/`check` già usati nel progetto — la correttezza va spinta nel DB dove possibile, non lasciata alla sola disciplina applicativa): `category` limitato ai 4 valori correnti; `francesca_activity` limitato ai 5 valori reali quando presente; un vincolo di coerenza incrociata che impone `francesca_activity` valorizzato se e solo se `category = 'francesca'`; `amount > 0`.
- **Estendibilità delle categorie:** un solo array esportato, `EXPENSE_CATEGORIES` (`src/features/expenses/constants.ts`), guida sia la UI (la schermata Spese itera su di esso per generare le 4 card) sia i form di aggiunta/modifica. Aggiungere una categoria futura significa: una migrazione che estende il CHECK su `category` + una riga in questo array — non toccare `spese.tsx` in 4 punti diversi.
- **Riuso, non duplicazione, delle 5 attività di Francesca:** `francesca_activity` usa le stesse 5 categorie di `FAMILY_CATEGORIES` (`src/features/family-calendar/constants.ts`), escludendo `'altro'` (che non è un valore valido per `francesca_activity` nello schema). Il piano deriva `FRANCESCA_ACTIVITIES` filtrando `FAMILY_CATEGORIES`, non riscrive la lista.
- **Tutta la logica di calcolo (totali per categoria, sub-totali per attività, etichetta del mese) vive in funzioni pure testabili in `src/features/expenses/expenseSummary.ts`, mai inline in `spese.tsx`** — stesso principio già applicato a `calendarGrid.ts`/`computeClientSummary.ts`/`recurringOccurrences.ts`, rinforzato due volte in questo progetto dopo che una violazione ha causato un bug reale passato inosservato per sei revisioni di task (vedi `docs/LEARNING.md`).
- **Filtro sul mese: riusa `filterByDateRange` esistente** (`src/features/payments/computeClientSummary.ts`, generico `<T extends {date: string}>`) — non scrivere una nuova funzione di filtro per data.
- **Nuovi helper di data puri in `src/lib/dates.ts`:** `startOfMonth`, `endOfMonth`, `shiftMonth` — stessa firma stringa-in/stringa-out di `addDays` già esistente. `monthLabel` (che richiede i nomi italiani dei mesi) vive invece in `src/features/expenses/expenseSummary.ts` e riusa `ITALIAN_MONTHS` esportato da `src/features/calendar/calendarGrid.ts`, non duplica l'array.
- Le date locali passano sempre da `src/lib/dates.ts`, mai da `.toISOString()` o aritmetica `Date` manuale.
- **`ScrollView` deve avere `style={{flex: 1}}` oltre a `contentContainerStyle`** — bug reale già trovato nella revisione finale del blocco Calendario Lavoro (senza uno `style` con altezza vincolata, `ScrollView` è un no-op silenzioso, si dimensiona sul contenuto invece che sullo schermo). Vedi `docs/LEARNING.md`.
- **Lo schermo di modifica deve avere un guard di caricamento prima di concludere "non trovato"**: se `useAllExpenses()` sta ancora caricando (`data` è `undefined`), mostrare "Caricamento..." invece di valutare `expenses?.find(...)` come non trovato — bug reale già trovato nella revisione del Task 5 del blocco Calendario Familiare (`edit-family-event.tsx`), da non ripetere qui.
- Dopo ogni modifica allo schema, rigenerare `src/lib/database.types.ts` (`npx supabase gen types typescript --project-id qivxrbhbffwqqmaadpnl > src/lib/database.types.ts`).
- Routing: nuove schermate fuori da `(tabs)/` vivono in `src/app/`, con bottone "Annulla"/`router.back()` esplicito — stesso pattern di `add-recurring-template.tsx`/`edit-recurring-template.tsx`. Il tab `spese/` esiste già come placeholder (`src/app/(tabs)/spese.tsx`, già registrato in `src/app/(tabs)/_layout.tsx`) e va sostituito, non creato.
- Verifica `tsc --noEmit`: per ogni task che tocca file sotto `src/app/` (nuove rotte o modifiche a rotte esistenti), usare la sequenza anti-stale-router-types descritta in `docs/superpowers/PROGRESS.md` (avviare `expo start --web` in background, attendere "Waiting on http://...", forzare un bundle reale con `curl`, poi `tsc`, poi killare il server). Per task che toccano solo file puri in `src/features/`/`src/lib/` (nessuna rotta), un `tsc --noEmit` semplice basta.
- Questo ambiente di esecuzione non ha strumenti di browser headless/interattivo: la verifica manuale delle schermate è sempre una lettura attenta del codice (parametri di route corrispondenti end-to-end, logica condizionale non invertita, uso corretto dei campi) invece di un click-through — pratica già stabilita e accettata in questo progetto.

---

### Task 1: Schema Postgres — expenses + RLS

**Files:**
- Create: `supabase/migrations/0007_expenses.sql`
- Modify: `src/lib/database.types.ts` (rigenerato dalla CLI)

**Interfaces:**
- Consumes: `is_household_member(uuid)` da `0002_fix_household_members_rls_recursion.sql`
- Produces: tabella `expenses` (id, household_id, category, label, francesca_activity, amount, date, created_at)

- [ ] **Step 1: Scrivi la migrazione `supabase/migrations/0007_expenses.sql`**

```sql
-- Spese mensili: 4 categorie (supermercato, frutta_verdura, extra,
-- francesca). francesca_activity è valorizzato se e solo se
-- category = 'francesca' (vincolo di coerenza incrociata sotto) e usa le
-- stesse 5 attività reali di recurring_templates/calendar_events
-- (mensa/palestra/cavallo/piscina/teatro, MAI 'altro').

create table expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category text not null check (category in ('supermercato', 'frutta_verdura', 'extra', 'francesca')),
  label text,
  francesca_activity text check (francesca_activity in ('mensa', 'palestra', 'cavallo', 'piscina', 'teatro')),
  amount numeric(10,2) not null check (amount > 0),
  date date not null,
  created_at timestamptz not null default now(),
  check ((category = 'francesca') = (francesca_activity is not null))
);

alter table expenses enable row level security;

create policy "household members manage expenses" on expenses
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));
```

- [ ] **Step 2: Applica la migrazione al progetto Cloud**

```bash
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env | cut -d '=' -f2)
npx supabase db push
```

Expected: conferma applicazione di `0007_expenses.sql` senza errori. Non stampare mai il valore del token.

- [ ] **Step 3: Verifica con `supabase migration list`**

```bash
npx supabase migration list
```

Expected: remote mostra `0001`...`0007` tutti applicati.

- [ ] **Step 4: Rigenera i tipi TypeScript**

```bash
npx supabase gen types typescript --project-id qivxrbhbffwqqmaadpnl > src/lib/database.types.ts
```

Expected: il file include ora `expenses`. Verifica con `npx tsc --noEmit` che non ci siano errori.

- [ ] **Step 5: Commit**

```bash
git add supabase src/lib/database.types.ts
git commit -m "feat: add expenses schema with RLS"
```

---

### Task 2: Test di integrazione RLS per expenses

**Files:**
- Create: `tests/rls/expenses.test.ts`

**Interfaces:**
- Consumes: `adminClient`, `createTestUser`, `signInAs` da `tests/rls/helpers.ts` (già esistenti)
- Produces: nessuna nuova interfaccia — solo copertura di test

- [ ] **Step 1: Scrivi `tests/rls/expenses.test.ts`**

```typescript
import { adminClient as admin, createTestUser, signInAs } from './helpers';

describe('expenses RLS isolation and constraints', () => {
  const password = 'Test1234!';
  const userAEmail = `expenses-test-a-${Date.now()}@example.com`;
  const userBEmail = `expenses-test-b-${Date.now()}@example.com`;
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

  it('a user cannot see or write expenses from another household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', { p_name: 'Household A Expenses Test' });
    createdHouseholdIds.push(householdA.id);

    const { error: insertError } = await clientA
      .from('expenses')
      .insert({ household_id: householdA.id, category: 'supermercato', amount: 42.5, date: '2026-09-20' });
    expect(insertError).toBeNull();

    const clientB = await signInAs(userBEmail, password);
    const { data: visibleExpenses } = await clientB
      .from('expenses')
      .select('*')
      .eq('household_id', householdA.id);
    expect(visibleExpenses).toEqual([]);

    const insertAttempt = await clientB
      .from('expenses')
      .insert({ household_id: householdA.id, category: 'extra', amount: 10, date: '2026-09-20' });
    expect(insertAttempt.error).not.toBeNull();
  });

  it('a user can fully manage expenses in their own household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Expenses CRUD Test' });
    createdHouseholdIds.push(household.id);

    const { data: expense, error: createError } = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'extra', label: 'Idraulico', amount: 80, date: '2026-09-15' })
      .select()
      .single();
    expect(createError).toBeNull();

    const { data: updated, error: updateError } = await clientA
      .from('expenses')
      .update({ amount: 95 })
      .eq('id', expense.id)
      .select()
      .single();
    expect(updateError).toBeNull();
    expect(updated.amount).toBe(95);

    const { error: deleteError } = await clientA.from('expenses').delete().eq('id', expense.id);
    expect(deleteError).toBeNull();
  });

  it('rejects a category outside the allowed list', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Category Check Test' });
    createdHouseholdIds.push(household.id);

    const { error } = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'benzina', amount: 10, date: '2026-09-15' });
    expect(error).not.toBeNull();
  });

  it('rejects category=francesca without francesca_activity, and francesca_activity set on a non-francesca category', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Cross-Check Test' });
    createdHouseholdIds.push(household.id);

    const missingActivity = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'francesca', amount: 10, date: '2026-09-15' });
    expect(missingActivity.error).not.toBeNull();

    const misplacedActivity = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'supermercato', francesca_activity: 'piscina', amount: 10, date: '2026-09-15' });
    expect(misplacedActivity.error).not.toBeNull();

    const valid = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'francesca', francesca_activity: 'piscina', amount: 10, date: '2026-09-15' });
    expect(valid.error).toBeNull();
  });

  it('rejects a non-positive amount', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', { p_name: 'Household A Amount Check Test' });
    createdHouseholdIds.push(household.id);

    const { error } = await clientA
      .from('expenses')
      .insert({ household_id: household.id, category: 'supermercato', amount: 0, date: '2026-09-15' });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Esegui tutti i test RLS**

Run: `npm run test:rls`
Expected: tutti PASS (quelli esistenti + i 5 nuovi di `expenses.test.ts`).

- [ ] **Step 3: Commit**

```bash
git add tests/rls/expenses.test.ts
git commit -m "test: add RLS and constraint coverage for expenses"
```

---

### Task 3: Logica pura — helper mese e riepilogo spese

**Files:**
- Modify: `src/lib/dates.ts`
- Modify: `src/lib/dates.test.ts`
- Create: `src/features/expenses/expenseSummary.ts`
- Create: `src/features/expenses/expenseSummary.test.ts`

**Interfaces:**
- Consumes: `parseLocalDateString`, `toLocalDateString` da `src/lib/dates.ts`; `ITALIAN_MONTHS` da `src/features/calendar/calendarGrid.ts`; `FamilyCategory` da `src/features/family-calendar/recurringOccurrences.ts`
- Produces: `startOfMonth`, `endOfMonth`, `shiftMonth` da `dates.ts`; `ExpenseCategory`, `FrancescaActivity`, `Expense`, `CategorySummary`, `ActivitySummary`, `summarizeByCategory(expenses, categories)`, `summarizeFrancescaByActivity(expenses, activities)`, `monthLabel(dateStr)` da `expenseSummary.ts` — usati dal Task 4 (hook) e dal Task 5 (schermate)

- [ ] **Step 1: Scrivi i test per i nuovi helper in `src/lib/dates.test.ts` (TDD)**

Aggiungi in fondo al file esistente (dopo il blocco `describe('addDays', ...)`):

```typescript
describe('startOfMonth', () => {
  it('returns the first day of the month', () => {
    expect(startOfMonth('2026-09-18')).toBe('2026-09-01');
  });
});

describe('endOfMonth', () => {
  it('returns the last day of a 30-day month', () => {
    expect(endOfMonth('2026-09-05')).toBe('2026-09-30');
  });

  it('returns the last day of a 31-day month', () => {
    expect(endOfMonth('2026-10-05')).toBe('2026-10-31');
  });

  it('returns Feb 29 in a leap year', () => {
    expect(endOfMonth('2028-02-01')).toBe('2028-02-29');
  });

  it('returns Feb 28 in a non-leap year', () => {
    expect(endOfMonth('2027-02-01')).toBe('2027-02-28');
  });
});

describe('shiftMonth', () => {
  it('moves forward one month within the same year', () => {
    expect(shiftMonth('2026-09-15', 1)).toBe('2026-10-01');
  });

  it('moves backward one month within the same year', () => {
    expect(shiftMonth('2026-09-15', -1)).toBe('2026-08-01');
  });

  it('rolls forward across a year boundary', () => {
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-01');
  });

  it('rolls backward across a year boundary', () => {
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-01');
  });
});
```

Aggiorna l'import in cima al file:

```typescript
import { addDays, endOfMonth, parseLocalDateString, shiftMonth, startOfMonth, toLocalDateString } from './dates';
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/lib/dates.test.ts`
Expected: FAIL — `startOfMonth`/`endOfMonth`/`shiftMonth` non esistono ancora.

- [ ] **Step 3: Aggiungi gli helper a `src/lib/dates.ts`**

Aggiungi in fondo al file esistente:

```typescript
export function startOfMonth(dateStr: string): string {
  const d = parseLocalDateString(dateStr);
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(dateStr: string): string {
  const d = parseLocalDateString(dateStr);
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Sposta l'ancora di un mese, sempre al giorno 1 del mese di destinazione — a differenza di shiftAnchorDate (calendarGrid.ts) non serve preservare il giorno del mese: chi chiama questa funzione ne legge solo mese/anno tramite startOfMonth/endOfMonth/monthLabel. */
export function shiftMonth(dateStr: string, direction: 1 | -1): string {
  const d = parseLocalDateString(dateStr);
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth() + direction, 1));
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/lib/dates.test.ts`
Expected: PASS, tutti i test compreso quelli preesistenti.

- [ ] **Step 5: Scrivi il test per `expenseSummary.ts` (TDD)**

`src/features/expenses/expenseSummary.test.ts`:

```typescript
import { Expense, monthLabel, summarizeByCategory, summarizeFrancescaByActivity } from './expenseSummary';

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 'e1',
    category: 'supermercato',
    label: null,
    francesca_activity: null,
    amount: 10,
    date: '2026-09-01',
    ...overrides,
  };
}

describe('summarizeByCategory', () => {
  it('sums amounts per category and buckets each expense into its own category', () => {
    const expenses = [
      expense({ id: 'a', category: 'supermercato', amount: 20 }),
      expense({ id: 'b', category: 'supermercato', amount: 15 }),
      expense({ id: 'c', category: 'extra', amount: 5 }),
    ];
    const summary = summarizeByCategory(expenses, ['supermercato', 'frutta_verdura', 'extra', 'francesca']);
    expect(summary.find((s) => s.category === 'supermercato')!.total).toBe(35);
    expect(summary.find((s) => s.category === 'supermercato')!.expenses).toHaveLength(2);
    expect(summary.find((s) => s.category === 'extra')!.total).toBe(5);
    expect(summary.find((s) => s.category === 'frutta_verdura')!.total).toBe(0);
    expect(summary.find((s) => s.category === 'frutta_verdura')!.expenses).toEqual([]);
  });

  it('returns a zero-total entry for a category with no expenses, in the order given', () => {
    const summary = summarizeByCategory([], ['supermercato', 'frutta_verdura', 'extra', 'francesca']);
    expect(summary.map((s) => s.category)).toEqual(['supermercato', 'frutta_verdura', 'extra', 'francesca']);
    expect(summary.every((s) => s.total === 0)).toBe(true);
  });
});

describe('summarizeFrancescaByActivity', () => {
  it('sums amounts per activity, ignoring expenses from other categories', () => {
    const expenses = [
      expense({ id: 'a', category: 'francesca', francesca_activity: 'piscina', amount: 40 }),
      expense({ id: 'b', category: 'francesca', francesca_activity: 'piscina', amount: 10 }),
      expense({ id: 'c', category: 'francesca', francesca_activity: 'mensa', amount: 25 }),
      expense({ id: 'd', category: 'supermercato', amount: 100 }), // non-francesca, deve essere ignorata
    ];
    const summary = summarizeFrancescaByActivity(expenses, ['mensa', 'palestra', 'cavallo', 'piscina', 'teatro']);
    expect(summary.find((s) => s.activity === 'piscina')!.total).toBe(50);
    expect(summary.find((s) => s.activity === 'mensa')!.total).toBe(25);
    expect(summary.find((s) => s.activity === 'palestra')!.total).toBe(0);
    const grandTotal = summary.reduce((sum, s) => sum + s.total, 0);
    expect(grandTotal).toBe(75); // i 100 della spesa supermercato NON devono entrare
  });
});

describe('monthLabel', () => {
  it('formats a date as "Mese Anno" in Italian', () => {
    expect(monthLabel('2026-09-18')).toBe('Settembre 2026');
  });

  it('uses the year of the given date, not the current year', () => {
    expect(monthLabel('2027-01-05')).toBe('Gennaio 2027');
  });
});
```

- [ ] **Step 6: Esegui il test e verifica che fallisca**

Run: `npx jest src/features/expenses/expenseSummary.test.ts`
Expected: FAIL — `Cannot find module './expenseSummary'`

- [ ] **Step 7: Scrivi `src/features/expenses/expenseSummary.ts`**

```typescript
import { ITALIAN_MONTHS } from '../calendar/calendarGrid';
import { parseLocalDateString } from '../../lib/dates';
import type { FamilyCategory } from '../family-calendar/recurringOccurrences';

export type ExpenseCategory = 'supermercato' | 'frutta_verdura' | 'extra' | 'francesca';
export type FrancescaActivity = Exclude<FamilyCategory, 'altro'>;

export interface Expense {
  id: string;
  category: ExpenseCategory;
  label: string | null;
  francesca_activity: FrancescaActivity | null;
  amount: number;
  date: string;
}

export interface CategorySummary {
  category: ExpenseCategory;
  total: number;
  expenses: Expense[];
}

export interface ActivitySummary {
  activity: FrancescaActivity;
  total: number;
  expenses: Expense[];
}

export function summarizeByCategory(expenses: Expense[], categories: ExpenseCategory[]): CategorySummary[] {
  return categories.map((category) => {
    const categoryExpenses = expenses.filter((e) => e.category === category);
    const total = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
    return { category, total, expenses: categoryExpenses };
  });
}

export function summarizeFrancescaByActivity(expenses: Expense[], activities: FrancescaActivity[]): ActivitySummary[] {
  const francescaExpenses = expenses.filter((e) => e.category === 'francesca');
  return activities.map((activity) => {
    const activityExpenses = francescaExpenses.filter((e) => e.francesca_activity === activity);
    const total = activityExpenses.reduce((sum, e) => sum + e.amount, 0);
    return { activity, total, expenses: activityExpenses };
  });
}

export function monthLabel(dateStr: string): string {
  const d = parseLocalDateString(dateStr);
  return `${ITALIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
```

- [ ] **Step 8: Esegui entrambi i file di test e verifica che passino**

Run: `npx jest src/lib/dates.test.ts src/features/expenses/expenseSummary.test.ts`
Expected: PASS, tutti i test.

- [ ] **Step 9: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts src/features/expenses/expenseSummary.ts src/features/expenses/expenseSummary.test.ts
git commit -m "feat: add month helpers and pure expense summarization functions"
```

---

### Task 4: Hook CRUD + costanti categorie

**Files:**
- Create: `src/features/expenses/constants.ts`
- Create: `src/features/expenses/useExpenses.ts`

**Interfaces:**
- Consumes: `useHousehold()` da `src/features/household/useHousehold.ts`; `Expense`, `ExpenseCategory`, `FrancescaActivity` dal Task 3; `FAMILY_CATEGORIES` da `src/features/family-calendar/constants.ts`
- Produces: `EXPENSE_CATEGORIES`, `FRANCESCA_ACTIVITIES` da `constants.ts`; `useAllExpenses()`, `useCreateExpense()`, `useUpdateExpense()`, `useDeleteExpense()` da `useExpenses.ts` — usati dal Task 5 (schermate)

- [ ] **Step 1: Scrivi `src/features/expenses/constants.ts`**

```typescript
import { FAMILY_CATEGORIES } from '../family-calendar/constants';
import type { ExpenseCategory, FrancescaActivity } from './expenseSummary';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'supermercato', label: 'Supermercato' },
  { value: 'frutta_verdura', label: 'Frutta e verdura' },
  { value: 'extra', label: 'Extra' },
  { value: 'francesca', label: 'Francesca' },
];

// Le 5 attività reali di Francesca, derivate da FAMILY_CATEGORIES escludendo
// 'altro' (non è un valore valido per francesca_activity — vedi il CHECK
// nella migrazione 0007). Il cast è isolato a questa singola riga: senza,
// TypeScript non restringe il tipo di .value dopo un filter().
export const FRANCESCA_ACTIVITIES = FAMILY_CATEGORIES.filter((c) => c.value !== 'altro') as {
  value: FrancescaActivity;
  label: string;
}[];
```

- [ ] **Step 2: Scrivi `src/features/expenses/useExpenses.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';
import type { Expense, ExpenseCategory, FrancescaActivity } from './expenseSummary';

export function useAllExpenses() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['expenses', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, category, label, francesca_activity, amount, date')
        .eq('household_id', householdId!)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });
}

interface ExpenseInput {
  category: ExpenseCategory;
  label?: string;
  francescaActivity?: FrancescaActivity;
  amount: number;
  date: string;
}

export function useCreateExpense() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          household_id: household.id,
          category: input.category,
          label: input.label || null,
          francesca_activity: input.francescaActivity || null,
          amount: input.amount,
          date: input.date,
        })
        .select('id, category, label, francesca_activity, amount, date')
        .single();
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExpenseInput & { id: string }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          category: input.category,
          label: input.label || null,
          francesca_activity: input.francescaActivity || null,
          amount: input.amount,
          date: input.date,
        })
        .eq('id', input.id)
        .select('id, category, label, francesca_activity, amount, date')
        .single();
      if (error) throw error;
      return data as Expense;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });
}
```

- [ ] **Step 3: Verifica**

Run: `npx tsc --noEmit` (nessuna rotta toccata in questo task, non serve la sequenza anti-stale-router-types — basta il comando semplice).
Expected: pulito.

- [ ] **Step 4: Commit**

```bash
git add src/features/expenses/constants.ts src/features/expenses/useExpenses.ts
git commit -m "feat: add expenses CRUD hook and category constants"
```

---

### Task 5: Tab Spese + form aggiungi/modifica spesa

**Files:**
- Modify: `src/app/(tabs)/spese.tsx` (sostituisce il placeholder)
- Create: `src/app/add-expense.tsx`
- Create: `src/app/edit-expense.tsx`

**Interfaces:**
- Consumes: `useAllExpenses`, `useCreateExpense`, `useUpdateExpense`, `useDeleteExpense` (Task 4); `EXPENSE_CATEGORIES`, `FRANCESCA_ACTIVITIES` (Task 4); `summarizeByCategory`, `summarizeFrancescaByActivity`, `monthLabel` (Task 3); `startOfMonth`, `endOfMonth`, `shiftMonth`, `toLocalDateString` (Task 3/`dates.ts`); `filterByDateRange` da `src/features/payments/computeClientSummary.ts` (già esistente)
- Produces: nessuna nuova interfaccia consumata da altri task — questo è l'ultimo task del piano

- [ ] **Step 1: Scrivi `src/app/(tabs)/spese.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAllExpenses } from '../../features/expenses/useExpenses';
import { EXPENSE_CATEGORIES, FRANCESCA_ACTIVITIES } from '../../features/expenses/constants';
import { monthLabel, summarizeByCategory, summarizeFrancescaByActivity } from '../../features/expenses/expenseSummary';
import { filterByDateRange } from '../../features/payments/computeClientSummary';
import { endOfMonth, shiftMonth, startOfMonth, toLocalDateString } from '../../lib/dates';

export default function SpeseScreen() {
  const [anchorDate, setAnchorDate] = useState(() => toLocalDateString(new Date()));
  const { data: expenses } = useAllExpenses();

  const range = { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
  const monthExpenses = filterByDateRange(expenses ?? [], range);
  const categorySummaries = summarizeByCategory(monthExpenses, EXPENSE_CATEGORIES.map((c) => c.value));
  const francescaActivitySummaries = summarizeFrancescaByActivity(monthExpenses, FRANCESCA_ACTIVITIES.map((a) => a.value));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spese</Text>

      <View style={styles.monthRow}>
        <Pressable style={styles.monthArrowButton} onPress={() => setAnchorDate(shiftMonth(anchorDate, -1))}>
          <Text style={styles.monthArrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel(anchorDate)}</Text>
        <Pressable style={styles.monthArrowButton} onPress={() => setAnchorDate(shiftMonth(anchorDate, 1))}>
          <Text style={styles.monthArrow}>›</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.sections}>
        {categorySummaries.map((summary) => {
          const meta = EXPENSE_CATEGORIES.find((c) => c.value === summary.category)!;
          return (
            <View key={summary.category} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{meta.label}</Text>
                <Text style={styles.cardTotal}>€{summary.total.toFixed(2)}</Text>
                <Pressable
                  style={styles.addButton}
                  onPress={() => router.push({ pathname: '/add-expense', params: { category: summary.category } })}
                >
                  <Text style={styles.addButtonText}>+</Text>
                </Pressable>
              </View>

              {summary.category === 'francesca' ? (
                francescaActivitySummaries.map((activitySummary) => {
                  const activityMeta = FRANCESCA_ACTIVITIES.find((a) => a.value === activitySummary.activity)!;
                  return (
                    <View key={activitySummary.activity} style={styles.activityGroup}>
                      <View style={styles.activityHeader}>
                        <Text style={styles.activityLabel}>{activityMeta.label}</Text>
                        <Text style={styles.activityTotal}>€{activitySummary.total.toFixed(2)}</Text>
                      </View>
                      {activitySummary.expenses.map((e) => (
                        <Pressable
                          key={e.id}
                          style={styles.row}
                          onPress={() => router.push({ pathname: '/edit-expense', params: { id: e.id } })}
                        >
                          <Text>{e.date}{e.label ? ` — ${e.label}` : ''}</Text>
                          <Text>€{e.amount.toFixed(2)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })
              ) : summary.expenses.length === 0 ? (
                <Text style={styles.empty}>Nessuna spesa questo mese.</Text>
              ) : (
                summary.expenses.map((e) => (
                  <Pressable
                    key={e.id}
                    style={styles.row}
                    onPress={() => router.push({ pathname: '/edit-expense', params: { id: e.id } })}
                  >
                    <Text>{e.date}{e.label ? ` — ${e.label}` : ''}</Text>
                    <Text>€{e.amount.toFixed(2)}</Text>
                  </Pressable>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginVertical: 4 },
  monthArrowButton: { padding: 8 },
  monthArrow: { fontSize: 20, fontWeight: '600' },
  monthLabel: { fontSize: 16, fontWeight: '600', minWidth: 140, textAlign: 'center' },
  sections: { gap: 12, paddingBottom: 24 },
  card: { backgroundColor: '#f3f4f6', borderRadius: 8, padding: 12, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  cardTotal: { fontWeight: '700' },
  addButton: { backgroundColor: '#2563eb', borderRadius: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: 'white', fontWeight: '700' },
  activityGroup: { gap: 2, marginTop: 4 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  activityLabel: { fontWeight: '600' },
  activityTotal: { fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  empty: { color: '#6b7280' },
});
```

- [ ] **Step 2: Scrivi `src/app/add-expense.tsx`**

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateExpense } from '../features/expenses/useExpenses';
import { EXPENSE_CATEGORIES, FRANCESCA_ACTIVITIES } from '../features/expenses/constants';
import type { ExpenseCategory, FrancescaActivity } from '../features/expenses/expenseSummary';
import { toLocalDateString } from '../lib/dates';

export default function AddExpenseScreen() {
  const { category: preselectedCategory } = useLocalSearchParams<{ category?: string }>();
  const [category] = useState<ExpenseCategory>((preselectedCategory as ExpenseCategory) ?? 'supermercato');
  const [label, setLabel] = useState('');
  const [francescaActivity, setFrancescaActivity] = useState<FrancescaActivity | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toLocalDateString(new Date()));
  const createExpense = useCreateExpense();

  const categoryLabel = EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category;

  const handleSubmit = () => {
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (category === 'francesca' && !francescaActivity) return;
    createExpense.mutate(
      {
        category,
        label: label.trim() || undefined,
        francescaActivity: category === 'francesca' ? francescaActivity! : undefined,
        amount: amountNum,
        date,
      },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nuova spesa — {categoryLabel}</Text>

      {category === 'francesca' && (
        <>
          <Text style={styles.label}>Attività</Text>
          <View style={styles.optionsRow}>
            {FRANCESCA_ACTIVITIES.map((a) => (
              <Pressable
                key={a.value}
                style={[styles.option, francescaActivity === a.value && styles.optionSelected]}
                onPress={() => setFrancescaActivity(a.value)}
              >
                <Text>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <TextInput style={styles.input} placeholder="Importo (€)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput
        style={styles.input}
        placeholder={category === 'extra' ? 'Tipologia (es. riparazione)' : 'Descrizione (opzionale)'}
        value={label}
        onChangeText={setLabel}
      />

      {createExpense.isError && <Text style={styles.error}>{(createExpense.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createExpense.isPending}>
        <Text style={styles.buttonText}>{createExpense.isPending ? 'Salvataggio...' : 'Salva'}</Text>
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
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 3: Scrivi `src/app/edit-expense.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAllExpenses, useDeleteExpense, useUpdateExpense } from '../features/expenses/useExpenses';
import { EXPENSE_CATEGORIES, FRANCESCA_ACTIVITIES } from '../features/expenses/constants';
import type { ExpenseCategory, FrancescaActivity } from '../features/expenses/expenseSummary';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: expenses } = useAllExpenses();
  const expense = expenses?.find((e) => e.id === id);
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const [category, setCategory] = useState<ExpenseCategory>('supermercato');
  const [label, setLabel] = useState('');
  const [francescaActivity, setFrancescaActivity] = useState<FrancescaActivity | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (expense) {
      setCategory(expense.category);
      setLabel(expense.label ?? '');
      setFrancescaActivity(expense.francesca_activity);
      setAmount(String(expense.amount));
      setDate(expense.date);
    }
  }, [expense?.id]);

  // Guard di caricamento: senza, "spesa non trovata" lampeggia mentre
  // useAllExpenses() sta ancora caricando (expenses è undefined) — stesso
  // bug già trovato e corretto in edit-family-event.tsx nel blocco
  // precedente, evitato qui fin dall'inizio.
  if (!expenses) return <Text style={styles.padded}>Caricamento...</Text>;
  if (!expense) return <Text style={styles.padded}>Spesa non trovata.</Text>;

  const categoryLabel = EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category;

  const handleSave = () => {
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (category === 'francesca' && !francescaActivity) return;
    updateExpense.mutate(
      {
        id: expense.id,
        category,
        label: label.trim() || undefined,
        francescaActivity: category === 'francesca' ? francescaActivity! : undefined,
        amount: amountNum,
        date,
      },
      { onSuccess: () => router.back() }
    );
  };

  const handleDelete = () => {
    deleteExpense.mutate(expense.id, { onSuccess: () => router.back() });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Modifica spesa — {categoryLabel}</Text>

      {category === 'francesca' && (
        <>
          <Text style={styles.label}>Attività</Text>
          <View style={styles.optionsRow}>
            {FRANCESCA_ACTIVITIES.map((a) => (
              <Pressable
                key={a.value}
                style={[styles.option, francescaActivity === a.value && styles.optionSelected]}
                onPress={() => setFrancescaActivity(a.value)}
              >
                <Text>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <TextInput style={styles.input} placeholder="Importo (€)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput
        style={styles.input}
        placeholder={category === 'extra' ? 'Tipologia (es. riparazione)' : 'Descrizione (opzionale)'}
        value={label}
        onChangeText={setLabel}
      />

      {updateExpense.isError && <Text style={styles.error}>{(updateExpense.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSave} disabled={updateExpense.isPending}>
        <Text style={styles.buttonText}>Salva</Text>
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleteExpense.isPending}>
        <Text style={styles.deleteButtonText}>Elimina spesa</Text>
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
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  deleteButtonText: { color: '#dc2626', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 4: Verifica**

Sequenza anti-stale-router-types (questo task tocca `src/app/`): avvia `npx expo start --web --port <N>` in background, attendi "Waiting on http://...", forza un bundle reale con `curl -s -o /dev/null http://localhost:<N>/`, attendi qualche secondo, poi `npx tsc --noEmit`, poi killa il server. Expected: pulito.

Manuale (lettura del codice, nessun browser disponibile): conferma che `add-expense.tsx` legga `category` dal param di route e non esponga alcun modo di cambiarla; che `edit-expense.tsx` trovi la spesa tramite `useLocalSearchParams<{id}>()` + `.find()` con il guard di caricamento prima del controllo "non trovata"; che il bottone "+" di ogni card in `spese.tsx` passi la `category` corretta della card cliccata; che `ScrollView` in `spese.tsx` abbia sia `style={{flex:1}}` sia `contentContainerStyle`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(tabs)/spese.tsx" src/app/add-expense.tsx src/app/edit-expense.tsx
git commit -m "feat: add Spese tab with monthly category breakdown and expense CRUD"
```

---

## Self-Review (fatto durante la scrittura del piano)

- **Copertura spec:** §4.4 (schema `expenses`) → Task 1. §5 (tab `spese/` con riepilogo a sottosezioni) → Task 5. Nessun requisito del §4.4/§5 rimasto scoperto.
- **Niente placeholder:** ogni step ha codice completo, nessun TODO/TBD.
- **Coerenza dei tipi tra task:** `Expense`/`ExpenseCategory`/`FrancescaActivity` (Task 3) → usati identici in `useExpenses.ts` (Task 4) e nelle schermate (Task 5); `EXPENSE_CATEGORIES`/`FRANCESCA_ACTIVITIES` (Task 4) → stessi nomi in `spese.tsx`/`add-expense.tsx`/`edit-expense.tsx` (Task 5); `startOfMonth`/`endOfMonth`/`shiftMonth` (Task 3, in `dates.ts`) → stessi nomi importati in `spese.tsx` (Task 5). Verificato manualmente, nessuna discrepanza.
