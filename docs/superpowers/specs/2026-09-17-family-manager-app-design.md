# Family Manager App — Design Doc

**Data:** 2026-09-17
**Stato:** Approvato per la fase di planning

## 1. Obiettivo e contesto

App per la gestione della vita familiare/lavorativa di un nucleo familiare, nata per la madre dell'utente (lavoro di pulizie domestiche presso più clienti privati) ma progettata per essere riutilizzabile da altri nuclei familiari con esigenze simili — in particolare famiglie con un membro con disabilità che richiede la gestione di appuntamenti ricorrenti (visite mediche, attività con associazioni) e relative spese.

Progetto anche a scopo di portfolio tecnico per colloqui di lavoro (backend/frontend/full stack) — le scelte architetturali sono motivate esplicitamente in questo documento perché possano essere spiegate e difese in un colloquio.

**Aree di approfondimento tecnico prioritarie (per il portfolio):** architettura dati e Row Level Security multi-tenant "leggero" (isolamento per household).

## 2. Utenti e accesso

- Più utenti per nucleo familiare, tutti con accesso completo in lettura/scrittura ai dati del proprio household (nessun sistema di ruoli/permessi differenziati in questa fase).
- L'app è multi-household fin dall'inizio: nuclei familiari diversi sono completamente isolati tra loro. Non è però un vero SaaS commerciale (niente billing, niente pannello super-admin) — solo isolamento dati corretto per permettere in futuro di offrirla ad altre famiglie senza modifiche allo schema.
- Autenticazione: Supabase Auth, email + password.
- Onboarding: dopo la prima registrazione, l'utente deve creare un nuovo household oppure unirsi a uno esistente tramite `invite_code` (codice breve, condiviso a voce/messaggio, non via invito email formale).
- Piattaforme: Expo (React Native + React Native Web) — uso paritario web e mobile (Android/iOS) fin dal primo rilascio.

## 3. Architettura e stack tecnico

| Livello | Scelta | Perché |
|---|---|---|
| Frontend | Expo + Expo Router + TypeScript | Un'unica codebase per web/iOS/Android, routing file-based che gestisce sia tab bar mobile sia sidebar web |
| Data fetching / cache | TanStack Query sopra client Supabase | Cache, invalidazione automatica dopo mutazioni, stato loading/error dichiarativo |
| Form | React Hook Form + Zod | Validazione tipizzata condivisa client-side |
| Styling | React Native `StyleSheet` nativo | Nessuna dipendenza UI aggiuntiva finché non serve davvero (YAGNI) |
| Backend | Supabase (Postgres + Auth + RLS + Storage) | Backend-as-a-service con RLS nativa a livello di riga, coerente con lo stack già validato nel progetto "Investigation" |
| Notifiche | `expo-notifications` (locali, on-device) | Promemoria impegni di Francesca senza infrastruttura server (nessun cron/Edge Function) |
| Cifratura note-password | AES-256 client-side, chiave derivata da master passphrase (`expo-crypto`, PBKDF2) | Il server vede solo ciphertext; nessuna dipendenza da infrastruttura di key management |

## 4. Modello dati (Postgres / Supabase)

### 4.1 Household (isolamento multi-famiglia)

```sql
households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,   -- generato alla creazione, breve (es. 6 char)
  created_at timestamptz not null default now()
)

household_members (
  household_id uuid references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
)
```

Ogni tabella applicativa sottostante ha una colonna `household_id`. Policy RLS standard su ognuna:

```sql
household_id in (
  select household_id from household_members where user_id = auth.uid()
)
```

applicata a SELECT/INSERT/UPDATE/DELETE. Isolamento garantito a livello di database, non solo di applicazione.

### 4.2 Clienti, ore lavorate, pagamenti (ledger a saldo)

```sql
clients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  name text not null,
  hourly_rate numeric(10,2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
)

work_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  client_id uuid references clients(id),
  date date not null,
  hours numeric(5,2) not null,
  rate_snapshot numeric(10,2) not null,       -- tariffa congelata al momento dell'inserimento
  amount_due numeric(10,2) generated always as (hours * rate_snapshot) stored,
  note text,
  created_at timestamptz not null default now()
)

payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  client_id uuid references clients(id),
  date date not null,
  amount numeric(10,2) not null,
  note text,
  created_at timestamptz not null default now()
)
```

**Decisione chiave — saldo calcolato, non memorizzato:** non esiste una colonna "pagato/non pagato" su `work_sessions`. Un pagamento è un importo che il cliente consegna e che copre le giornate più vecchie non ancora saldate (FIFO), perché nella realtà (case di villeggiatura, proprietari assenti) il cliente salda più giornate insieme e non sempre per intero.

Il saldo e la copertura per-giorno si calcolano con una funzione/view Postgres che, per ogni cliente, ordina le `work_sessions` per data e confronta la somma cumulativa dovuta con il totale dei `payments`:

```sql
create or replace view work_session_status as
select
  ws.*,
  sum(ws.amount_due) over (partition by ws.client_id order by ws.date, ws.created_at) as cumulative_due,
  p.total_paid,
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

Vantaggio: nessuna doppia contabilità da mantenere sincronizzata: la verità è sempre "somma ore dovute" vs "somma pagamenti", ricalcolata al volo. Il calendario lavoro legge `work_session_status.status` per colorare ogni giorno (due colori: dovuto / saldato).

*Evoluzione futura possibile (non nell'MVP):* tabella esplicita `payment_allocations` per tracciare quale pagamento ha coperto quali giornate specifiche, utile se in futuro serve un audit trail preciso per pagamento.

### 4.3 Calendario familiare (impegni di Francesca e altri)

```sql
recurring_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  title text not null,
  category text not null,   -- mensa | palestra | cavallo | piscina | teatro | altro
  person text not null,     -- es. "Francesca"
  weekday smallint not null,  -- 0-6
  time time,
  note text
)

calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  recurring_template_id uuid references recurring_templates(id),  -- null se evento manuale
  title text not null,
  category text not null,
  person text not null,
  date date not null,
  time time,
  note text,
  is_cancelled boolean not null default false,
  created_at timestamptz not null default now()
)
```

Le occorrenze ricorrenti **non vengono materializzate in anticipo**: per un intervallo di date visualizzato, il client espande i `recurring_templates` in occorrenze virtuali (una funzione pura TypeScript, facilmente testabile in isolamento) e le sovrascrive con eventuali righe `calendar_events` collegate allo stesso `recurring_template_id` + data (modifica puntuale o `is_cancelled = true` per un'eccezione singola). Gli eventi manuali non ricorrenti hanno semplicemente `recurring_template_id = null`.

### 4.4 Spese mensili

```sql
expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  category text not null,   -- supermercato | frutta_verdura | extra | francesca
  label text,                -- tipologia (extra) o descrizione/giustificativo (francesca)
  francesca_activity text,   -- nullable: mensa | palestra | cavallo | piscina | teatro
  amount numeric(10,2) not null,
  date date not null,
  created_at timestamptz not null default now()
)
```

Nessun allegato/foto ricevuta nell'MVP (solo importo + data + descrizione) — evoluzione futura se necessario, richiederebbe Supabase Storage.

### 4.5 Note

```sql
note_sections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  title text not null,
  type text not null,        -- info | password | custom
  sort_order int not null default 0
)

notes (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references note_sections(id),
  household_id uuid references households(id),
  title text not null,
  content text,               -- testo in chiaro (sezioni info/custom)
  content_encrypted text,     -- ciphertext AES-256 (sezioni password), mai in chiaro
  created_at timestamptz not null default now()
)
```

Alla creazione di un household vengono create automaticamente 3 `note_sections` di base (`Info importanti`, `Info secondarie`, `Password`, type rispettivamente `info`/`info`/`password`); l'utente può aggiungerne altre (type `custom`) tramite "Aggiungi nuovo".

**Cifratura password:** al primo utilizzo della sezione Password, l'utente imposta una master passphrase mai inviata al server. Il client deriva una chiave AES-256 (PBKDF2 via `expo-crypto`) e cifra/decifra `content_encrypted` localmente. Limite esplicito da comunicare in UI: se la passphrase si perde, le note in quella sezione sono irrecuperabili (cifratura E2E single-user, non c'è recupero password lato server).

## 5. Struttura frontend (Expo Router)

```
/login, /signup, /join-household          (fuori dalle tab, utente non autenticato o senza household)

(tabs)/
  calendario/     — toggle Lavoro | Francesca, vista giorno/settimana/mese
  pagamenti/      — lista clienti con saldo corrente, dettaglio ore/pagamenti per cliente
  spese/          — riepilogo mensile a sottosezioni (supermercato/frutta e verdura/extra/francesca)
  note/           — sezioni + note, editor per sezione Password con sblocco via passphrase
  impostazioni/   — household (codice invito, membri), anagrafica clienti (CRUD nome+tariffa)
```

Componenti condivisi chiave:
- `CalendarView` — componente parametrico giorno/settimana/mese, riusato sia per calendario Lavoro sia per Francesca tramite una prop `renderDay` che personalizza il contenuto di ogni cella (ore+colore pagamento vs categoria impegno).
- `useHousehold()` — hook che espone l'household corrente dell'utente autenticato; ogni query Supabase lo usa per filtrare (anche se la RLS è la garanzia reale, il filtro lato client evita richieste inutili).

## 6. Notifiche

`expo-notifications`, notifiche locali schedulate on-device alla creazione/modifica di un `calendar_event` (es. giorno prima alle 20:00, solo per eventi con `person` impostato, in primis Francesca). Richiede permesso OS al primo utilizzo; se negato, l'app resta pienamente funzionante senza promemoria. Nessuna infrastruttura server (no cron, no Expo push token registry).

## 7. Testing (focus: architettura dati/RLS)

Priorità coerente con l'area di approfondimento scelta:
1. **Funzione pura di calcolo saldo FIFO** (sezione 4.2) — unit test su casi: pagamento parziale, pagamento che copre più giornate, pagamento che eccede il dovuto.
2. **Funzione pura di espansione eventi ricorrenti** (sezione 4.3) — unit test su: eccezione singola, cancellazione singola occorrenza, evento manuale che convive con occorrenze generate.
3. **Test di integrazione RLS** — contro un progetto Supabase locale/staging: verificano che un utente autenticato in un household non possa leggere/scrivere righe di un altro household, per ciascuna tabella.

Niente suite E2E completa nell'MVP — sproporzionata rispetto allo scopo del progetto.

## 8. Fuori scope per questa fase (possibili evoluzioni future)

- Ruoli/permessi differenziati tra membri dello stesso household.
- Allegati/foto ricevute per le spese.
- Notifiche push server-side (invece che locali on-device).
- Tabella esplicita di allocazione pagamenti (`payment_allocations`) per audit trail preciso.
- Supporto offline con sincronizzazione.
- Onboarding/invito via email invece che tramite codice.
