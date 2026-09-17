# Fondamenta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Progetto Expo funzionante con autenticazione Supabase, schema household multi-tenant con RLS, e flusso di onboarding (crea/unisciti a un household) — la base su cui si appoggeranno tutti i blocchi successivi (clienti/pagamenti, calendario familiare, spese, note).

**Architecture:** App Expo Router (TypeScript) con un client Supabase condiviso, TanStack Query per data fetching/mutazioni, e uno schema Postgres con RLS che isola i dati per `household_id`. La creazione/adesione a un household passa per funzioni Postgres `SECURITY DEFINER` (`create_household`, `join_household`) invece che INSERT diretti dal client, per garantire atomicità e non esporre `invite_code` altrui via SELECT.

**Tech Stack:** Expo (SDK corrente) + Expo Router, TypeScript, `@supabase/supabase-js`, `@tanstack/react-query`, Jest (`jest-expo` preset) per i test.

**Spec:** `docs/superpowers/specs/2026-09-17-family-manager-app-design.md`

## Global Constraints

- TypeScript strict mode ovunque (nessun `any` implicito).
- Routing file-based via Expo Router (`app/` directory), non React Navigation configurato a mano.
- Backend: solo Supabase Cloud — niente Supabase locale via Docker (noto rotto su questa macchina, vedi memoria progetto Investigation).
- RLS attiva su ogni tabella applicativa fin dalla sua creazione, mai disabilitata "temporaneamente".
- Nessuna libreria UI aggiuntiva (no NativeWind/Tailwind/UI kit) — styling con `StyleSheet` nativo.
- Tutte le letture/scritture Supabase dal client passano da TanStack Query (`useQuery`/`useMutation`), mai `useEffect` + `fetch` manuale.
- Variabili d'ambiente pubbliche prefissate `EXPO_PUBLIC_`; la service role key non è mai referenziata da codice che finisce nel bundle app (solo in script di test Node).

---

### Task 1: Scaffold progetto Expo + struttura cartelle

**Files:**
- Create: intero progetto Expo generato in root (`app/`, `package.json`, `tsconfig.json`, `app.json`, ecc.)
- Create: `src/lib/.gitkeep` (placeholder, verrà popolato nel Task 2)
- Create: `.gitignore` (esteso rispetto al default Expo)

**Interfaces:**
- Consumes: niente (primo task)
- Produces: struttura progetto Expo Router standard su cui si baseranno tutti i task successivi (`app/` per le route, `src/` per logica/componenti condivisi)

- [ ] **Step 1: Genera il progetto Expo nella root del repo**

```bash
npx create-expo-app@latest . --yes
```

Questo comando (SDK Expo corrente) crea di default un progetto TypeScript con Expo Router già configurato (route `app/(tabs)/`, `app/_layout.tsx`).

- [ ] **Step 2: Rimuovi le route demo generate da Expo**

Elimina i file demo che non servono (`app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`, `app/(tabs)/_layout.tsx`, cartella `components/` demo, `hooks/` demo se presenti) — verranno ricreati nei task successivi con contenuto reale. Mantieni `app/_layout.tsx` (verrà modificato nel Task 6) e `app.json`/`tsconfig.json`.

- [ ] **Step 3: Crea la struttura `src/`**

```bash
mkdir -p src/lib src/features/auth src/features/household
```

- [ ] **Step 4: Estendi `.gitignore`**

Aggiungi in coda al `.gitignore` generato da Expo:

```
.env
.env.test
```

- [ ] **Step 5: Verifica che il progetto si avvii**

Run: `npx expo start --web`
Expected: il server di sviluppo parte senza errori e la app (anche se con route vuote/rotte per la rimozione dei demo) è raggiungibile su `http://localhost:8081`. Interrompi il processo dopo la verifica (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo Router project"
```

---

### Task 2: Client Supabase e configurazione ambiente

**Files:**
- Create: `.env.example`
- Create: `src/lib/supabase.ts`
- Modify: `app.json` (aggiunta plugin/config se richiesto da expo per env, tipicamente non necessario con `EXPO_PUBLIC_*`)

**Interfaces:**
- Consumes: pacchetto `@supabase/supabase-js`
- Produces: `supabase` (istanza `SupabaseClient`) esportata da `src/lib/supabase.ts`, usata da ogni feature successiva

- [ ] **Step 1: Installa le dipendenze**

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage @tanstack/react-query
```

(`@react-native-async-storage/async-storage` è richiesto da Supabase per persistere la sessione auth su mobile.)

- [ ] **Step 2: Crea `.env.example`**

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 3: Crea `.env` locale (non committato) con i valori reali**

Dopo aver creato il progetto Supabase Cloud (fatto nel Task 3, step 1), copia `.env.example` in `.env` e compila con i valori reali da Supabase Dashboard → Project Settings → API.

- [ ] **Step 4: Scrivi `src/lib/supabase.ts`**

```typescript
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — check your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 5: Installa il polyfill richiesto**

```bash
npx expo install react-native-url-polyfill
```

- [ ] **Step 6: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore di tipo (a parte eventuali route vuote residue, che sistemeremo nei task successivi).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client setup"
```

---

### Task 3: Schema Postgres household + RLS + funzioni di onboarding

**Files:**
- Create: `supabase/migrations/0001_households.sql`
- Create: `supabase/config.toml` (generato da `supabase init`)

**Interfaces:**
- Consumes: niente
- Produces: tabelle `households`, `household_members`; funzioni RPC `create_household(p_name text) returns households` e `join_household(p_code text) returns households`, chiamabili da `supabase.rpc('create_household', { p_name })` / `supabase.rpc('join_household', { p_code })`

- [ ] **Step 1: Crea il progetto Supabase Cloud**

Vai su https://supabase.com/dashboard, crea un nuovo progetto (nome es. `manager-app`), regione vicina, annota Project Ref, URL e anon key (Project Settings → API) — usali per compilare `.env` (Task 2, Step 3).

- [ ] **Step 2: Inizializza e collega la CLI Supabase**

```bash
npx supabase init
npx supabase link --project-ref <il-tuo-project-ref>
```

- [ ] **Step 3: Scrivi la migrazione `supabase/migrations/0001_households.sql`**

```sql
-- households & household_members: isolamento multi-tenant per nucleo familiare

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table households enable row level security;
alter table household_members enable row level security;

-- SELECT: solo i membri del proprio household. Nessuna policy INSERT/UPDATE/DELETE
-- diretta: la creazione/adesione passa esclusivamente dalle funzioni SECURITY DEFINER
-- sotto, per garantire atomicità e non esporre invite_code di altri household.
create policy "select own household" on households
  for select using (
    id in (select household_id from household_members where user_id = auth.uid())
  );

create policy "select own membership rows" on household_members
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );

-- genera un codice invito breve e univoco (6 caratteri alfanumerici maiuscoli)
create or replace function generate_invite_code()
returns text
language plpgsql
as $$
declare
  code text;
  attempts int := 0;
begin
  loop
    code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from households where invite_code = code);
    attempts := attempts + 1;
    if attempts > 10 then
      raise exception 'Could not generate a unique invite code';
    end if;
  end loop;
  return code;
end;
$$;

create or replace function create_household(p_name text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Household name is required';
  end if;

  insert into households (name, invite_code)
  values (trim(p_name), generate_invite_code())
  returning * into new_household;

  insert into household_members (household_id, user_id)
  values (new_household.id, auth.uid());

  return new_household;
end;
$$;

create or replace function join_household(p_code text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into target_household from households where invite_code = upper(trim(p_code));

  if target_household.id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into household_members (household_id, user_id)
  values (target_household.id, auth.uid())
  on conflict do nothing;

  return target_household;
end;
$$;
```

- [ ] **Step 4: Applica la migrazione al progetto Cloud**

```bash
npx supabase db push
```

Expected: output conferma l'applicazione di `0001_households.sql` senza errori.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: household schema, RLS policies, and onboarding RPC functions"
```

---

### Task 4: Test di integrazione RLS per l'isolamento tra household

**Files:**
- Create: `tests/rls/households.test.ts`
- Create: `.env.test.example`
- Modify: `package.json` (script `test:rls`, dipendenza `dotenv`)

**Interfaces:**
- Consumes: `create_household`/`join_household` RPC dal Task 3; variabili d'ambiente `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` lette da `.env.test`
- Produces: test Jest eseguibile con `npm run test:rls`, che verifica che un utente non possa leggere l'household di un altro utente

- [ ] **Step 1: Crea `.env.test.example`**

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Copia in `.env.test` (gitignored) con i valori reali (service role key da Project Settings → API, **mai** committata).

- [ ] **Step 2: Installa dipendenze di test**

```bash
npm install --save-dev dotenv
```

(Jest e `jest-expo` sono già presenti nel template Expo generato al Task 1.)

- [ ] **Step 3: Scrivi `tests/rls/households.test.ts`**

```typescript
import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createTestUser(email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!;
}

async function signInAs(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describe('household RLS isolation', () => {
  const password = 'Test1234!';
  const userAEmail = `rls-test-a-${Date.now()}@example.com`;
  const userBEmail = `rls-test-b-${Date.now()}@example.com`;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const userA = await createTestUser(userAEmail, password);
    const userB = await createTestUser(userBEmail, password);
    userAId = userA.id;
    userBId = userB.id;
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
  });

  it('a user cannot see a household they are not a member of', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA, error: createError } = await clientA.rpc('create_household', {
      p_name: 'Household A',
    });
    expect(createError).toBeNull();
    expect(householdA.id).toBeDefined();

    const clientB = await signInAs(userBEmail, password);
    const { data: visibleToB, error: selectError } = await clientB
      .from('households')
      .select('*')
      .eq('id', householdA.id);

    expect(selectError).toBeNull();
    expect(visibleToB).toEqual([]);
  });

  it('a user can join a household via invite code and then see it', async () => {
    const clientA = await signInAs(userAEmail, password);
    const { data: householdA } = await clientA.rpc('create_household', {
      p_name: 'Household A Join Test',
    });

    const clientB = await signInAs(userBEmail, password);
    const { data: joined, error: joinError } = await clientB.rpc('join_household', {
      p_code: householdA.invite_code,
    });
    expect(joinError).toBeNull();
    expect(joined.id).toBe(householdA.id);

    const { data: visibleToB } = await clientB.from('households').select('*').eq('id', householdA.id);
    expect(visibleToB).toHaveLength(1);
  });

  it('join_household rejects an invalid invite code', async () => {
    const clientB = await signInAs(userBEmail, password);
    const { error } = await clientB.rpc('join_household', { p_code: 'ZZZZZZ' });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 4: Aggiungi lo script in `package.json`**

```json
"scripts": {
  "test:rls": "jest tests/rls --runInBand"
}
```

- [ ] **Step 5: Esegui il test**

Run: `npm run test:rls`
Expected: 3 test PASS (isolamento, join via codice, codice invalido rifiutato).

- [ ] **Step 6: Commit**

```bash
git add tests package.json .env.test.example
git commit -m "test: add RLS integration tests for household isolation"
```

---

### Task 5: Schermate di autenticazione (signup/login)

**Files:**
- Create: `src/features/auth/useAuth.ts`
- Create: `app/login.tsx`
- Create: `app/signup.tsx`

**Interfaces:**
- Consumes: `supabase` da `src/lib/supabase.ts` (Task 2)
- Produces: hook `useSignUp()` e `useSignIn()` (mutazioni TanStack Query), route `/login` e `/signup` navigabili

- [ ] **Step 1: Scrivi `src/features/auth/useAuth.ts`**

```typescript
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    },
  });
}

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
  });
}
```

- [ ] **Step 2: Scrivi `app/login.tsx`**

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { useSignIn } from '../src/features/auth/useAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useSignIn();

  const handleSubmit = () => {
    signIn.mutate(
      { email, password },
      { onSuccess: () => router.replace('/') }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Accedi</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {signIn.isError && <Text style={styles.error}>{(signIn.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={signIn.isPending}>
        <Text style={styles.buttonText}>{signIn.isPending ? 'Accesso...' : 'Accedi'}</Text>
      </Pressable>
      <Link href="/signup">Non hai un account? Registrati</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
});
```

- [ ] **Step 3: Scrivi `app/signup.tsx`**

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { useSignUp } from '../src/features/auth/useAuth';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signUp = useSignUp();

  const handleSubmit = () => {
    signUp.mutate(
      { email, password },
      { onSuccess: () => router.replace('/') }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crea account</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min. 6 caratteri)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {signUp.isError && <Text style={styles.error}>{(signUp.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={signUp.isPending}>
        <Text style={styles.buttonText}>{signUp.isPending ? 'Creazione...' : 'Registrati'}</Text>
      </Pressable>
      <Link href="/login">Hai già un account? Accedi</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
});
```

- [ ] **Step 4: Verifica manuale**

Run: `npx expo start --web`, apri `/signup`, crea un utente di test, verifica in Supabase Dashboard → Authentication che l'utente sia stato creato. Poi vai su `/login` e verifica l'accesso con le stesse credenziali.

- [ ] **Step 5: Commit**

```bash
git add app/login.tsx app/signup.tsx src/features/auth
git commit -m "feat: add login and signup screens"
```

---

### Task 6: Root layout con auth guard

**Files:**
- Modify: `app/_layout.tsx`
- Create: `src/features/auth/useSession.ts`

**Interfaces:**
- Consumes: `supabase.auth.getSession()` / `supabase.auth.onAuthStateChange` (Task 2)
- Produces: hook `useSession()` che espone `{ session, isLoading }`; layout root che reindirizza a `/login` se non autenticato

- [ ] **Step 1: Scrivi `src/features/auth/useSession.ts`**

```typescript
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, isLoading };
}
```

- [ ] **Step 2: Modifica `app/_layout.tsx`**

```tsx
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from '../src/features/auth/useSession';

const queryClient = new QueryClient();

function AuthGate() {
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, isLoading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Verifica manuale**

Run: `npx expo start --web`. Da disconnesso, navigare a `/` deve reindirizzare a `/login`. Dopo il login, navigare a `/login` deve reindirizzare a `/`.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx src/features/auth/useSession.ts
git commit -m "feat: add auth guard to root layout"
```

---

### Task 7: Onboarding household (crea/unisciti) + hook useHousehold + shell tabs

**Files:**
- Create: `src/features/household/useHousehold.ts`
- Create: `app/join-household.tsx`
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/impostazioni.tsx`
- Create: `app/(tabs)/calendario.tsx` (placeholder)
- Create: `app/(tabs)/pagamenti.tsx` (placeholder)
- Create: `app/(tabs)/spese.tsx` (placeholder)
- Create: `app/(tabs)/note.tsx` (placeholder)
- Modify: `app/_layout.tsx` (estendi `AuthGate` per gestire anche l'assenza di household)

**Interfaces:**
- Consumes: `create_household`/`join_household` RPC (Task 3), `useSession` (Task 6)
- Produces: hook `useHousehold()` → `{ household: { id, name, invite_code } | null, isLoading }`, usato da ogni feature successiva per scoping delle query

- [ ] **Step 1: Scrivi `src/features/household/useHousehold.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';

export interface Household {
  id: string;
  name: string;
  invite_code: string;
}

export function useHousehold() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['household', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Household | null> => {
      const { data, error } = await supabase
        .from('household_members')
        .select('households(id, name, invite_code)')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.households as unknown as Household) ?? null;
    },
  });
}

export function useCreateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc('create_household', { p_name: name });
      if (error) throw error;
      return data as Household;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
  });
}

export function useJoinHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_household', { p_code: code });
      if (error) throw error;
      return data as Household;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
  });
}
```

- [ ] **Step 2: Scrivi `app/join-household.tsx`**

```tsx
import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useCreateHousehold, useJoinHousehold } from '../src/features/household/useHousehold';

export default function JoinHouseholdScreen() {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const createHousehold = useCreateHousehold();
  const joinHousehold = useJoinHousehold();

  const pending = createHousehold.isPending || joinHousehold.isPending;
  const error = (createHousehold.error ?? joinHousehold.error) as Error | null;

  const handleSubmit = () => {
    if (mode === 'create') {
      createHousehold.mutate(name, { onSuccess: () => router.replace('/') });
    } else {
      joinHousehold.mutate(code, { onSuccess: () => router.replace('/') });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Benvenuto</Text>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleButton, mode === 'create' && styles.toggleButtonActive]}
          onPress={() => setMode('create')}
        >
          <Text>Crea nuovo nucleo</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, mode === 'join' && styles.toggleButtonActive]}
          onPress={() => setMode('join')}
        >
          <Text>Unisciti con codice</Text>
        </Pressable>
      </View>

      {mode === 'create' ? (
        <TextInput
          style={styles.input}
          placeholder="Nome del nucleo (es. Famiglia Rossi)"
          value={name}
          onChangeText={setName}
        />
      ) : (
        <TextInput
          style={styles.input}
          placeholder="Codice invito (6 caratteri)"
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
        />
      )}

      {error && <Text style={styles.error}>{error.message}</Text>}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={pending}>
        <Text style={styles.buttonText}>{pending ? 'Attendere...' : 'Continua'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
});
```

- [ ] **Step 3: Estendi `app/_layout.tsx` per gestire l'assenza di household**

```tsx
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from '../src/features/auth/useSession';
import { useHousehold } from '../src/features/household/useHousehold';

const queryClient = new QueryClient();

function AuthGate() {
  const { session, isLoading: sessionLoading } = useSession();
  const { data: household, isLoading: householdLoading } = useHousehold();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (sessionLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    if (!session && !inAuthGroup) {
      router.replace('/login');
      return;
    }
    if (session && inAuthGroup) {
      router.replace('/');
      return;
    }
    if (session && !householdLoading && !household && segments[0] !== 'join-household') {
      router.replace('/join-household');
      return;
    }
    if (session && household && segments[0] === 'join-household') {
      router.replace('/');
    }
  }, [session, sessionLoading, household, householdLoading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Scrivi `app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="calendario" options={{ title: 'Calendario' }} />
      <Tabs.Screen name="pagamenti" options={{ title: 'Pagamenti' }} />
      <Tabs.Screen name="spese" options={{ title: 'Spese' }} />
      <Tabs.Screen name="note" options={{ title: 'Note' }} />
      <Tabs.Screen name="impostazioni" options={{ title: 'Impostazioni' }} />
    </Tabs>
  );
}
```

- [ ] **Step 5: Scrivi `app/(tabs)/impostazioni.tsx` (prima schermata reale)**

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useHousehold } from '../../src/features/household/useHousehold';

export default function ImpostazioniScreen() {
  const { data: household, isLoading } = useHousehold();

  if (isLoading) return <Text style={styles.padded}>Caricamento...</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{household?.name}</Text>
      <Text>Codice invito per far entrare un altro membro:</Text>
      <Text style={styles.code}>{household?.invite_code}</Text>
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
  button: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: 'white', fontWeight: '600' },
});
```

- [ ] **Step 6: Scrivi i placeholder delle altre tab**

`app/(tabs)/calendario.tsx`, `app/(tabs)/pagamenti.tsx`, `app/(tabs)/spese.tsx`, `app/(tabs)/note.tsx` — stesso schema minimale per tutti e quattro, ad es. per `calendario.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function CalendarioScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calendario</Text>
      <Text>Sezione in costruzione — arriva nel prossimo blocco.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
});
```

(Ripeti sostituendo titolo/testo per `pagamenti.tsx`, `spese.tsx`, `note.tsx`.)

- [ ] **Step 7: Verifica manuale end-to-end**

Run: `npx expo start --web`. Flusso completo: signup → reindirizzato a `/join-household` → crea nuovo nucleo → reindirizzato alla tab bar con 5 tab → tab Impostazioni mostra nome household e codice invito → Esci → torna a `/login`. Poi: registra un secondo utente, in `/join-household` usa "Unisciti con codice" con il codice del primo → verifica di vedere lo stesso nome household in Impostazioni.

- [ ] **Step 8: Commit**

```bash
git add app src/features/household
git commit -m "feat: add household onboarding and tab shell"
```

---

## Al termine di questo piano

Deliverable funzionante e testabile: un'app Expo (web + mobile) dove più utenti possono registrarsi, creare o unirsi a un nucleo familiare tramite codice invito, con isolamento dati verificato da test automatici. Nessuna funzionalità di business (clienti, calendario, spese, note) ancora presente — arriva nei piani successivi, che partiranno da questa base reale invece che da ipotesi.
