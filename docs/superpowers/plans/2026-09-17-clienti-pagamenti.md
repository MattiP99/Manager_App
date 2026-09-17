# Clienti + Pagamenti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gestione clienti (nome + tariffa oraria), registrazione delle giornate lavorate, registrazione dei pagamenti ricevuti (a saldo, non giorno-per-giorno), e una tab Pagamenti che mostra per ogni cliente ore/dovuto/pagato/saldo con filtro settimana/mese/tutto e un totale complessivo.

**Architecture:** Tre tabelle household-scoped (`clients`, `work_sessions`, `payments`) con RLS via l'helper `is_household_member()` già esistente (nessuna nuova funzione RPC necessaria: qui l'accesso è già filtrato per household, non serve un gate aggiuntivo come l'invite code). Il saldo per-giornata (pagato/non pagato) è calcolato da una view Postgres con logica FIFO; le aggregazioni per periodo (settimana/mese) sono calcolate lato client con una funzione pura testabile, non con altre view SQL — evita di moltiplicare gli oggetti DB per ogni combinazione di filtro.

**Tech Stack:** Stesso stack di Fondamenta — Expo Router, TypeScript, `@supabase/supabase-js` con tipi generati, TanStack Query, Jest.

**Spec:** `docs/superpowers/specs/2026-09-17-family-manager-app-design.md` (sezioni 4.2 e parte di 5)

**Precede questo piano (già completato):** `docs/superpowers/plans/2026-09-17-fondamenta.md` — questo piano assume che household/auth/RLS/tab-shell esistano già e funzionino.

## Global Constraints

- Tutte le nuove tabelle usano RLS via `is_household_member(household_id)` (funzione già esistente da `supabase/migrations/0002_fix_household_members_rls_recursion.sql`), con un'unica policy `for all` per tabella (using + with check) — niente RPC per queste tabelle, l'household stesso è già il gate.
- Qualunque nuova view Postgres deve dichiarare esplicitamente `with (security_invoker = true)` — senza, una view gira con i privilegi del proprietario (il ruolo di migrazione) invece che dell'utente che interroga, bypassando silenziosamente l'isolamento RLS. Stesso genere di errore già corretto in `0002`, va evitato dall'inizio qui.
- La tariffa di una giornata lavorata è sempre congelata al momento dell'inserimento (`rate_snapshot`), mai ricalcolata in seguito dalla tariffa corrente del cliente.
- I calcoli monetari (saldo FIFO, aggregazioni per periodo) sono funzioni pure TypeScript testabili in isolamento, non logica inline nei componenti.
- Dopo ogni modifica allo schema, rigenerare `src/lib/database.types.ts` (`npx supabase gen types typescript --project-id qivxrbhbffwqqmaadpnl > src/lib/database.types.ts`) e usare il client Supabase tipizzato — niente cast non verificati (`as unknown as X`).
- Routing: nuove schermate fuori da `(tabs)/` vivono in `src/app/` (es. `src/app/add-client.tsx`), con un bottone "Indietro" esplicito che chiama `router.back()` — il layout root usa `<Slot />` senza uno Stack navigator, quindi non c'è back automatico nella UI nativa.

---

### Task 1: Schema Postgres — clients, work_sessions, payments + RLS + view saldo FIFO

**Files:**
- Create: `supabase/migrations/0004_clients_work_sessions_payments.sql`
- Modify: `src/lib/database.types.ts` (rigenerato dalla CLI, non scritto a mano)

**Interfaces:**
- Consumes: `is_household_member(uuid)` da `0002_fix_household_members_rls_recursion.sql`
- Produces: tabelle `clients`, `work_sessions`, `payments`; view `work_session_status` (colonne: tutte quelle di `work_sessions` + `cumulative_due`, `total_paid`, `status` — `'paid' | 'unpaid'`)

- [ ] **Step 1: Scrivi la migrazione `supabase/migrations/0004_clients_work_sessions_payments.sql`**

```sql
-- Clienti, giornate lavorate, pagamenti — household-scoped via is_household_member.

create table clients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  hourly_rate numeric(10,2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table work_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  date date not null,
  hours numeric(5,2) not null check (hours > 0),
  rate_snapshot numeric(10,2) not null,
  amount_due numeric(10,2) generated always as (hours * rate_snapshot) stored,
  note text,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  date date not null,
  amount numeric(10,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

alter table clients enable row level security;
alter table work_sessions enable row level security;
alter table payments enable row level security;

create policy "household members manage clients" on clients
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "household members manage work_sessions" on work_sessions
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "household members manage payments" on payments
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Stato pagato/non pagato per singola giornata — FIFO: un pagamento copre
-- le giornate più vecchie non ancora saldate, perché un cliente spesso
-- salda più giornate insieme.
-- security_invoker=true è OBBLIGATORIO: senza, la view gira con i
-- privilegi del proprietario (il ruolo di migrazione) ai fini RLS, non
-- dell'utente che interroga — bypasserebbe silenziosamente l'isolamento
-- per household. Stessa classe di errore già vista e corretta in 0002.
create view work_session_status
  with (security_invoker = true)
as
select
  ws.*,
  sum(ws.amount_due) over (partition by ws.client_id order by ws.date, ws.created_at) as cumulative_due,
  coalesce(p.total_paid, 0) as total_paid,
  case
    when sum(ws.amount_due) over (partition by ws.client_id order by ws.date, ws.created_at)
         <= coalesce(p.total_paid, 0)
    then 'paid' else 'unpaid'
  end as status
from work_sessions ws
left join (
  select client_id, sum(amount) as total_paid from payments group by client_id
) p on p.client_id = ws.client_id;
```

- [ ] **Step 2: Applica la migrazione al progetto Cloud**

```bash
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env | cut -d '=' -f2)
npx supabase db push
```

Expected: conferma applicazione di `0004_clients_work_sessions_payments.sql` senza errori. Non stampare mai il valore del token.

- [ ] **Step 3: Verifica con `supabase migration list`**

```bash
npx supabase migration list
```

Expected: remote mostra `0001`, `0002`, `0003`, `0004` tutti applicati.

- [ ] **Step 4: Rigenera i tipi TypeScript**

```bash
npx supabase gen types typescript --project-id qivxrbhbffwqqmaadpnl > src/lib/database.types.ts
```

Expected: il file viene sovrascritto e ora include `clients`, `work_sessions`, `payments`, `work_session_status` nei tipi generati. Verifica con `npx tsc --noEmit` che non ci siano errori.

- [ ] **Step 5: Commit**

```bash
git add supabase src/lib/database.types.ts
git commit -m "feat: add clients, work_sessions, payments schema with FIFO status view"
```

---

### Task 2: Test di integrazione RLS per clienti/giornate/pagamenti

**Files:**
- Create: `tests/rls/helpers.ts`
- Modify: `tests/rls/households.test.ts` (usa gli helper condivisi invece di definirli localmente)
- Create: `tests/rls/clients.test.ts`

**Interfaces:**
- Consumes: schema del Task 1
- Produces: `createTestUser(email, password)`, `signInAs(email, password)`, `adminClient` esportati da `tests/rls/helpers.ts`, riusabili da qualunque futuro file di test RLS

- [ ] **Step 1: Estrai gli helper condivisi in `tests/rls/helpers.ts`**

```typescript
import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function createTestUser(email: string, password: string) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!;
}

export async function signInAs(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}
```

(Nota: il file usa `dotenv.config({ path: '.env.test' })` implicitamente? No — verifica come `tests/rls/households.test.ts` carica `.env.test` oggi, prima di scrivere questo helper: il Task 4 di Fondamenta lo caricava esplicitamente con `dotenv.config({ path: '.env.test' })`, non con `import 'dotenv/config'`. Usa la stessa forma esplicita qui, non quella del brief originale di Fondamenta che era sbagliata.)

- [ ] **Step 2: Aggiorna `tests/rls/households.test.ts` per usare gli helper condivisi**

Sostituisci le definizioni locali di `createTestUser`/`signInAs`/`admin` con un import da `./helpers`:

```typescript
import { adminClient as admin, createTestUser, signInAs } from './helpers';
```

Rimuovi le funzioni duplicate e l'inizializzazione locale di `admin`. Il resto del file (i test stessi) resta invariato.

- [ ] **Step 3: Esegui i test esistenti per verificare che il refactor non abbia rotto nulla**

Run: `npm run test:rls`
Expected: tutti i test di `households.test.ts` passano ancora (stesso numero di prima).

- [ ] **Step 4: Scrivi `tests/rls/clients.test.ts`**

```typescript
import { adminClient as admin, createTestUser, signInAs } from './helpers';

describe('clients/work_sessions/payments RLS isolation', () => {
  const password = 'Test1234!';
  const userAEmail = `clients-test-a-${Date.now()}@example.com`;
  const userBEmail = `clients-test-b-${Date.now()}@example.com`;
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

  it('a user cannot see clients, work sessions, or payments from another household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', {
      p_name: 'Household A Clients Test',
    });
    createdHouseholdIds.push(householdA.id);

    const { data: newClient, error: clientError } = await clientA
      .from('clients')
      .insert({ household_id: householdA.id, name: 'Mario Rossi', hourly_rate: 12 })
      .select()
      .single();
    expect(clientError).toBeNull();

    await clientA.from('work_sessions').insert({
      household_id: householdA.id,
      client_id: newClient.id,
      date: '2026-09-01',
      hours: 3,
      rate_snapshot: 12,
    });
    await clientA.from('payments').insert({
      household_id: householdA.id,
      client_id: newClient.id,
      date: '2026-09-05',
      amount: 20,
    });

    const clientB = await signInAs(userBEmail, password);
    const { data: visibleClients } = await clientB.from('clients').select('*').eq('household_id', householdA.id);
    const { data: visibleSessions } = await clientB
      .from('work_sessions')
      .select('*')
      .eq('household_id', householdA.id);
    const { data: visiblePayments } = await clientB
      .from('payments')
      .select('*')
      .eq('household_id', householdA.id);

    expect(visibleClients).toEqual([]);
    expect(visibleSessions).toEqual([]);
    expect(visiblePayments).toEqual([]);
  });

  it('a user cannot insert into another household\'s clients, work sessions, or payments', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', {
      p_name: 'Household A Write Test',
    });
    createdHouseholdIds.push(householdA.id);

    const clientB = await signInAs(userBEmail, password);

    const insertClient = await clientB
      .from('clients')
      .insert({ household_id: householdA.id, name: 'Sneaky', hourly_rate: 10 });
    expect(insertClient.error).not.toBeNull();

    const insertSession = await clientB.from('work_sessions').insert({
      household_id: householdA.id,
      client_id: '00000000-0000-0000-0000-000000000000',
      date: '2026-09-01',
      hours: 1,
      rate_snapshot: 10,
    });
    expect(insertSession.error).not.toBeNull();

    const insertPayment = await clientB
      .from('payments')
      .insert({ household_id: householdA.id, client_id: '00000000-0000-0000-0000-000000000000', date: '2026-09-01', amount: 10 });
    expect(insertPayment.error).not.toBeNull();
  });

  it('a user can fully manage clients in their own household', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', {
      p_name: 'Household A CRUD Test',
    });
    createdHouseholdIds.push(household.id);

    const { data: created, error: createError } = await clientA
      .from('clients')
      .insert({ household_id: household.id, name: 'Anna Bianchi', hourly_rate: 15 })
      .select()
      .single();
    expect(createError).toBeNull();

    const { data: updated, error: updateError } = await clientA
      .from('clients')
      .update({ hourly_rate: 16 })
      .eq('id', created.id)
      .select()
      .single();
    expect(updateError).toBeNull();
    expect(updated.hourly_rate).toBe(16);

    const { error: deleteError } = await clientA.from('clients').delete().eq('id', created.id);
    expect(deleteError).toBeNull();
  });

  it('work_session_status computes FIFO paid/unpaid status correctly', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: household } = await clientA.rpc('create_household', {
      p_name: 'Household A FIFO Test',
    });
    createdHouseholdIds.push(household.id);

    const { data: client } = await clientA
      .from('clients')
      .insert({ household_id: household.id, name: 'FIFO Client', hourly_rate: 10 })
      .select()
      .single();

    const { data: day1 } = await clientA
      .from('work_sessions')
      .insert({ household_id: household.id, client_id: client.id, date: '2026-09-01', hours: 2, rate_snapshot: 10 })
      .select()
      .single();
    const { data: day2 } = await clientA
      .from('work_sessions')
      .insert({ household_id: household.id, client_id: client.id, date: '2026-09-08', hours: 2, rate_snapshot: 10 })
      .select()
      .single();

    // amount_due per giornata = 20. Un pagamento di 20 deve coprire solo day1 (il più vecchio).
    await clientA.from('payments').insert({ household_id: household.id, client_id: client.id, date: '2026-09-02', amount: 20 });

    const { data: statusAfterPartial } = await clientA
      .from('work_session_status')
      .select('id, status')
      .eq('client_id', client.id)
      .order('date', { ascending: true });

    expect(statusAfterPartial!.find((s) => s.id === day1.id)!.status).toBe('paid');
    expect(statusAfterPartial!.find((s) => s.id === day2.id)!.status).toBe('unpaid');

    // Un secondo pagamento di 20 copre anche day2.
    await clientA.from('payments').insert({ household_id: household.id, client_id: client.id, date: '2026-09-09', amount: 20 });

    const { data: statusAfterFull } = await clientA
      .from('work_session_status')
      .select('id, status')
      .eq('client_id', client.id)
      .order('date', { ascending: true });

    expect(statusAfterFull!.find((s) => s.id === day1.id)!.status).toBe('paid');
    expect(statusAfterFull!.find((s) => s.id === day2.id)!.status).toBe('paid');
  });
});
```

- [ ] **Step 5: Esegui tutti i test RLS**

Run: `npm run test:rls`
Expected: tutti i test PASS (quelli esistenti di `households.test.ts` + i 4 nuovi di `clients.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add tests
git commit -m "test: add RLS coverage for clients, work_sessions, payments"
```

---

### Task 3: Gestione clienti — hook + UI (lista, crea, modifica)

**Files:**
- Create: `src/features/clients/useClients.ts`
- Modify: `src/app/(tabs)/impostazioni.tsx`
- Create: `src/app/add-client.tsx`
- Create: `src/app/edit-client.tsx`

**Interfaces:**
- Consumes: `useHousehold()` da `src/features/household/useHousehold.ts`
- Produces: `Client` interface, `useClients()`, `useCreateClient()`, `useUpdateClient()` — usati dal Task 4/5/6 per popolare i selettori cliente

- [ ] **Step 1: Scrivi `src/features/clients/useClients.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';

export interface Client {
  id: string;
  name: string;
  hourly_rate: number;
  active: boolean;
}

export function useClients() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['clients', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, hourly_rate, active')
        .eq('household_id', householdId!)
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateClient() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, hourlyRate }: { name: string; hourlyRate: number }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('clients')
        .insert({ household_id: household.id, name, hourly_rate: hourlyRate })
        .select('id, name, hourly_rate, active')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      hourlyRate,
      active,
    }: {
      id: string;
      name?: string;
      hourlyRate?: number;
      active?: boolean;
    }) => {
      const updates: { name?: string; hourly_rate?: number; active?: boolean } = {};
      if (name !== undefined) updates.name = name;
      if (hourlyRate !== undefined) updates.hourly_rate = hourlyRate;
      if (active !== undefined) updates.active = active;
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select('id, name, hourly_rate, active')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}
```

- [ ] **Step 2: Estendi `src/app/(tabs)/impostazioni.tsx` con la lista clienti**

```tsx
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../../features/household/useHousehold';
import { useClients } from '../../features/clients/useClients';

export default function ImpostazioniScreen() {
  const { data: household, isLoading } = useHousehold();
  const { data: clients } = useClients();

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
      <FlatList
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

      <Pressable style={styles.button} onPress={() => supabase.auth.signOut()}>
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

- [ ] **Step 3: Scrivi `src/app/add-client.tsx`**

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useCreateClient } from '../features/clients/useClients';

export default function AddClientScreen() {
  const [name, setName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const createClient = useCreateClient();

  const handleSubmit = () => {
    const rate = parseFloat(hourlyRate.replace(',', '.'));
    if (!name.trim() || isNaN(rate) || rate <= 0) return;
    createClient.mutate({ name: name.trim(), hourlyRate: rate }, { onSuccess: () => router.back() });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuovo cliente</Text>
      <TextInput style={styles.input} placeholder="Nome" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Tariffa oraria (€)"
        keyboardType="decimal-pad"
        value={hourlyRate}
        onChangeText={setHourlyRate}
      />
      {createClient.isError && <Text style={styles.error}>{(createClient.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createClient.isPending}>
        <Text style={styles.buttonText}>{createClient.isPending ? 'Salvataggio...' : 'Salva'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 4: Scrivi `src/app/edit-client.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients, useUpdateClient } from '../features/clients/useClients';

export default function EditClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: clients } = useClients();
  const client = clients?.find((c) => c.id === id);
  const updateClient = useUpdateClient();

  const [name, setName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');

  useEffect(() => {
    if (client) {
      setName(client.name);
      setHourlyRate(String(client.hourly_rate));
    }
  }, [client?.id]);

  if (!client) return <Text style={styles.padded}>Cliente non trovato.</Text>;

  const handleSave = () => {
    const rate = parseFloat(hourlyRate.replace(',', '.'));
    if (!name.trim() || isNaN(rate) || rate <= 0) return;
    updateClient.mutate({ id: client.id, name: name.trim(), hourlyRate: rate }, { onSuccess: () => router.back() });
  };

  const handleToggleActive = () => {
    updateClient.mutate({ id: client.id, active: !client.active }, { onSuccess: () => router.back() });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modifica cliente</Text>
      <TextInput style={styles.input} placeholder="Nome" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Tariffa oraria (€)"
        keyboardType="decimal-pad"
        value={hourlyRate}
        onChangeText={setHourlyRate}
      />
      {updateClient.isError && <Text style={styles.error}>{(updateClient.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSave} disabled={updateClient.isPending}>
        <Text style={styles.buttonText}>Salva</Text>
      </Pressable>
      <Pressable style={styles.toggleButton} onPress={handleToggleActive} disabled={updateClient.isPending}>
        <Text style={styles.toggleButtonText}>{client.active ? 'Disattiva cliente' : 'Riattiva cliente'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  padded: { padding: 24 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  toggleButton: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center' },
  toggleButtonText: { color: '#dc2626', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 5: Verifica**

Run: `npx tsc --noEmit` (deve essere pulito) e `npx expo start --web` (avvio senza crash, naviga manualmente su Impostazioni → + Cliente → salva → verifica che appaia in lista → tocca il cliente → modifica tariffa → salva).

- [ ] **Step 6: Commit**

```bash
git add src/features/clients src/app/add-client.tsx src/app/edit-client.tsx "src/app/(tabs)/impostazioni.tsx"
git commit -m "feat: add client management (list, create, edit)"
```

---

### Task 4: Registrazione giornate lavorate

**Files:**
- Create: `src/features/work-sessions/useWorkSessions.ts`
- Create: `src/app/add-work-session.tsx`

**Interfaces:**
- Consumes: `Client` e `useClients()` dal Task 3
- Produces: `useWorkSessionsByClient(clientId)`, `useCreateWorkSession()` — usati dal Task 5 (dettaglio cliente) e dal Task 6 (aggregazioni)

- [ ] **Step 1: Scrivi `src/features/work-sessions/useWorkSessions.ts`**

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
        .select('id, client_id, date, hours, rate_snapshot, amount_due, note, status')
        .eq('client_id', clientId!)
        .order('date', { ascending: false });
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
        .select('id, client_id, date, hours, rate_snapshot, amount_due, note')
        .eq('household_id', householdId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
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
      note,
    }: {
      clientId: string;
      date: string;
      hours: number;
      rateSnapshot: number;
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
          note: note || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-session-status', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['work-sessions'] });
    },
  });
}
```

- [ ] **Step 2: Scrivi `src/app/add-work-session.tsx`**

Riceve `clientId` opzionale via query param (per pre-selezionare il cliente quando si arriva dal dettaglio cliente); se assente, mostra un selettore.

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../features/clients/useClients';
import { useCreateWorkSession } from '../features/work-sessions/useWorkSessions';

export default function AddWorkSessionScreen() {
  const { clientId: preselectedClientId } = useLocalSearchParams<{ clientId?: string }>();
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState(preselectedClientId ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const createSession = useCreateWorkSession();

  const selectedClient = clients?.find((c) => c.id === clientId);

  const handleSubmit = () => {
    const hoursNum = parseFloat(hours.replace(',', '.'));
    if (!selectedClient || isNaN(hoursNum) || hoursNum <= 0) return;
    createSession.mutate(
      { clientId, date, hours: hoursNum, rateSnapshot: selectedClient.hourly_rate, note: note.trim() || undefined },
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
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 3: Verifica**

Run: `npx tsc --noEmit` pulito. Manuale: da Impostazioni crea un cliente attivo, poi naviga a `/add-work-session` (per ora raggiungibile solo digitando l'URL in web dev, o temporaneamente aggiungi un bottone di test — verrà collegato dalla UI del Task 5), seleziona il cliente, inserisci ore, salva, verifica nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/features/work-sessions src/app/add-work-session.tsx
git commit -m "feat: add work session logging"
```

---

### Task 5: Registrazione pagamenti + dettaglio cliente

**Files:**
- Create: `src/features/payments/usePayments.ts`
- Create: `src/app/client/[id].tsx`
- Create: `src/app/add-payment.tsx`

**Interfaces:**
- Consumes: `useClients()` (Task 3), `useWorkSessionsByClient()` (Task 4)
- Produces: `usePaymentsByClient(clientId)`, `useCreatePayment()`; schermata `/client/[id]` che diventa l'hub da cui si aggiungono giornate e pagamenti per un cliente specifico

- [ ] **Step 1: Scrivi `src/features/payments/usePayments.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../household/useHousehold';

export interface Payment {
  id: string;
  client_id: string;
  date: string;
  amount: number;
  note: string | null;
}

export function usePaymentsByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['payments', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, client_id, date, amount, note')
        .eq('client_id', clientId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAllPayments() {
  const { data: household } = useHousehold();
  const householdId = household?.id;

  return useQuery({
    queryKey: ['payments-all', householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, client_id, date, amount, note')
        .eq('household_id', householdId!)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePayment() {
  const { data: household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      date,
      amount,
      note,
    }: {
      clientId: string;
      date: string;
      amount: number;
      note?: string;
    }) => {
      if (!household) throw new Error('No household');
      const { data, error } = await supabase
        .from('payments')
        .insert({ household_id: household.id, client_id: clientId, date, amount, note: note || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['payments-all'] });
      queryClient.invalidateQueries({ queryKey: ['work-session-status', variables.clientId] });
    },
  });
}
```

- [ ] **Step 2: Scrivi `src/app/client/[id].tsx`**

```tsx
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients } from '../../features/clients/useClients';
import { useWorkSessionsByClient } from '../../features/work-sessions/useWorkSessions';
import { usePaymentsByClient } from '../../features/payments/usePayments';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: clients } = useClients();
  const client = clients?.find((c) => c.id === id);
  const { data: sessions } = useWorkSessionsByClient(id);
  const { data: payments } = usePaymentsByClient(id);

  if (!client) return <Text style={styles.padded}>Caricamento...</Text>;

  const totalDue = (sessions ?? []).reduce((sum, s) => sum + s.amount_due, 0);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const balance = totalDue - totalPaid;

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Indietro</Text>
      </Pressable>
      <Text style={styles.title}>{client.name}</Text>
      <Text>Tariffa: €{client.hourly_rate}/h</Text>
      <Text style={styles.balance}>Saldo da ricevere: €{balance.toFixed(2)}</Text>

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.actionButton}
          onPress={() => router.push({ pathname: '/add-work-session', params: { clientId: client.id } })}
        >
          <Text style={styles.actionButtonText}>+ Giornata</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => router.push({ pathname: '/add-payment', params: { clientId: client.id } })}
        >
          <Text style={styles.actionButtonText}>+ Pagamento</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Giornate lavorate</Text>
      <FlatList
        data={sessions ?? []}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: item.status === 'paid' ? '#dcfce7' : '#fee2e2' }]}>
            <Text>{item.date} — {item.hours}h</Text>
            <Text>€{item.amount_due.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>Nessuna giornata registrata.</Text>}
      />

      <Text style={styles.sectionTitle}>Pagamenti ricevuti</Text>
      <FlatList
        data={payments ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>{item.date}</Text>
            <Text>€{item.amount.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>Nessun pagamento registrato.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  padded: { padding: 24 },
  back: { color: '#2563eb', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  balance: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  actionsRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  actionButton: { flex: 1, backgroundColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center' },
  actionButtonText: { color: 'white', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6, marginTop: 4 },
});
```

- [ ] **Step 3: Scrivi `src/app/add-payment.tsx`**

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreatePayment } from '../features/payments/usePayments';

export default function AddPaymentScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const createPayment = useCreatePayment();

  const handleSubmit = () => {
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) return;
    createPayment.mutate(
      { clientId, date, amount: amountNum, note: note.trim() || undefined },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registra pagamento</Text>
      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput style={styles.input} placeholder="Importo (€)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {createPayment.isError && <Text style={styles.error}>{(createPayment.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createPayment.isPending}>
        <Text style={styles.buttonText}>{createPayment.isPending ? 'Salvataggio...' : 'Salva'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 4: Verifica manuale end-to-end**

Run: `npx expo start --web`. Impostazioni → + Cliente → crea → Impostazioni → tocca il cliente (va su `/edit-client`, per ora — il dettaglio con storico si raggiunge navigando manualmente a `/client/<id>` in dev, verrà collegato dalla tab Pagamenti nel Task 6) → `/client/<id>` → + Giornata → salva → verifica compaia nella lista rossa (non pagato) → + Pagamento → importo pari alla giornata → verifica che la riga diventi verde (pagato).

- [ ] **Step 5: Commit**

```bash
git add src/features/payments src/app/client src/app/add-payment.tsx
git commit -m "feat: add payment logging and client detail screen"
```

---

### Task 6: Aggregazione per periodo + tab Pagamenti

**Files:**
- Create: `src/features/payments/computeClientSummary.ts`
- Create: `src/features/payments/computeClientSummary.test.ts`
- Modify: `src/app/(tabs)/pagamenti.tsx`

**Interfaces:**
- Consumes: `WorkSession` (Task 4), `Payment` (Task 5), `useAllWorkSessions()`, `useAllPayments()`, `useClients()`
- Produces: `computeClientSummary(sessions, payments)` → `{ totalHours, totalDue, totalPaid, balance }` — funzione pura, riusata per qualunque intervallo di date passato dal chiamante

- [ ] **Step 1: Scrivi il test per la funzione pura (TDD)**

`src/features/payments/computeClientSummary.test.ts`:

```typescript
import { computeClientSummary } from './computeClientSummary';
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
```

- [ ] **Step 2: Esegui il test e verifica che fallisca (la funzione non esiste ancora)**

Run: `npx jest src/features/payments/computeClientSummary.test.ts`
Expected: FAIL — `Cannot find module './computeClientSummary'`

- [ ] **Step 3: Scrivi `src/features/payments/computeClientSummary.ts`**

```typescript
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
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/features/payments/computeClientSummary.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Scrivi una funzione di filtro per periodo**

Aggiungi in fondo a `src/features/payments/computeClientSummary.ts`:

```typescript
export type Period = 'week' | 'month' | 'all';

export function dateRangeForPeriod(period: Period, now = new Date()): { start: string; end: string } | null {
  if (period === 'all') return null;

  const end = now.toISOString().slice(0, 10);
  const start = new Date(now);
  if (period === 'week') {
    start.setDate(start.getDate() - 7);
  } else {
    start.setMonth(start.getMonth() - 1);
  }
  return { start: start.toISOString().slice(0, 10), end };
}

export function filterByDateRange<T extends { date: string }>(items: T[], range: { start: string; end: string } | null): T[] {
  if (!range) return items;
  return items.filter((item) => item.date >= range.start && item.date <= range.end);
}
```

- [ ] **Step 6: Riscrivi `src/app/(tabs)/pagamenti.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useClients } from '../../features/clients/useClients';
import { useAllWorkSessions } from '../../features/work-sessions/useWorkSessions';
import { useAllPayments } from '../../features/payments/usePayments';
import { computeClientSummary, dateRangeForPeriod, filterByDateRange, Period } from '../../features/payments/computeClientSummary';

export default function PagamentiScreen() {
  const [period, setPeriod] = useState<Period>('all');
  const { data: clients } = useClients();
  const { data: sessions } = useAllWorkSessions();
  const { data: payments } = useAllPayments();

  const range = dateRangeForPeriod(period);
  const filteredSessions = filterByDateRange(sessions ?? [], range);
  const filteredPayments = filterByDateRange(payments ?? [], range);

  const rows = (clients ?? []).map((client) => {
    const clientSessions = filteredSessions.filter((s) => s.client_id === client.id);
    const clientPayments = filteredPayments.filter((p) => p.client_id === client.id);
    return { client, summary: computeClientSummary(clientSessions, clientPayments) };
  });

  const grandTotal = computeClientSummary(filteredSessions, filteredPayments);

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
            <Text>{p === 'week' ? 'Settimana' : p === 'month' ? 'Mese' : 'Tutto'}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.grandTotal}>
        <Text>Ore totali: {grandTotal.totalHours}</Text>
        <Text>Dovuto: €{grandTotal.totalDue.toFixed(2)}</Text>
        <Text>Ricevuto: €{grandTotal.totalPaid.toFixed(2)}</Text>
        <Text style={styles.balanceText}>Saldo: €{grandTotal.balance.toFixed(2)}</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.client.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/client/${item.client.id}`)}>
            <Text style={styles.clientName}>{item.client.name}</Text>
            <Text>{item.summary.totalHours}h — dovuto €{item.summary.totalDue.toFixed(2)} — ricevuto €{item.summary.totalPaid.toFixed(2)}</Text>
            <Text style={item.summary.balance > 0 ? styles.due : styles.settled}>
              Saldo: €{item.summary.balance.toFixed(2)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text>Nessun cliente ancora.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  periodRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  periodButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, alignItems: 'center' },
  periodButtonActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  grandTotal: { backgroundColor: '#f3f4f6', borderRadius: 8, padding: 12, gap: 2, marginBottom: 8 },
  balanceText: { fontWeight: '700' },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  clientName: { fontWeight: '600' },
  due: { color: '#dc2626' },
  settled: { color: '#16a34a' },
});
```

- [ ] **Step 7: Verifica manuale end-to-end**

Run: `npx expo start --web`. Tab Pagamenti mostra i clienti creati nei task precedenti con ore/dovuto/ricevuto/saldo corretti; cambia il filtro settimana/mese/tutto e verifica che i numeri cambino coerentemente; tocca un cliente e verifica che apra `/client/<id>` con lo storico dettagliato.

- [ ] **Step 8: Esegui l'intera suite**

Run: `npx jest --testPathIgnorePatterns=tests/rls` (unit test, esclude i test RLS che richiedono rete) — expected: tutti PASS. Poi `npx tsc --noEmit` — pulito.

- [ ] **Step 9: Commit**

```bash
git add src/features/payments "src/app/(tabs)/pagamenti.tsx"
git commit -m "feat: add period-based client summaries and Pagamenti tab"
```

---

## Al termine di questo piano

Deliverable funzionante e testabile: gestione clienti con tariffa, registrazione giornate lavorate (con tariffa congelata), registrazione pagamenti a saldo (FIFO, non giorno-per-giorno), colorazione pagato/non-pagato nello storico per cliente, e una tab Pagamenti con ore/dovuto/ricevuto/saldo per cliente e totale complessivo, filtrabile per settimana/mese/tutto. La colorazione FIFO in un vero calendario visuale (giorno/settimana/mese) resta per il prossimo piano ("Calendario Lavoro"), che riuserà `work_session_status` e `useCreateWorkSession` già pronti qui.
