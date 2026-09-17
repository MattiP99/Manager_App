# Manager App — Note tecniche per colloqui

> Documento di studio, non di codice. Raccoglie le scelte tecniche del progetto e il *perché*, organizzate per argomento, per poterle spiegare e giustificare a un reclutatore (posizioni backend/frontend/full stack). Aggiornato a ogni blocco completato — ultimo aggiornamento: fine blocco "Clienti + Pagamenti" (2/6 blocchi).

Indice: [Architettura](#architettura-generale) · [Database e RLS](#database-e-sicurezza-a-livello-di-riga-rls) · [Ledger FIFO](#il-ledger-dei-pagamenti-pattern-fifo) · [Frontend](#frontend-e-mobile) · [Sicurezza](#sicurezza) · [Testing](#strategia-di-testing) · [Processo di sviluppo](#processo-di-sviluppo) · [Bug reali trovati](#bug-reali-trovati-durante-lo-sviluppo)

---

## Architettura generale

**Stack:** React Native + Expo Router (routing file-based, web e mobile dalla stessa codebase) + TypeScript (strict mode) + Supabase (Postgres + Auth + Storage) + TanStack Query per la gestione dello stato server.

**Perché Expo Router invece di React Navigation "puro" o due app separate:** un singolo albero di route serve sia il web (via React Native Web) sia iOS/Android, con lo stesso codice. Il routing è file-based (ogni file in `src/app/` è una schermata), stesso paradigma di Next.js — riduce il boilerplate di configurazione della navigazione e rende l'architettura leggibile: la struttura delle cartelle *è* la mappa dell'app.

**Perché Supabase invece di un backend custom (Express/Nest + Postgres gestito a mano):** Postgres reale (non un database proprietario) con Row Level Security nativa, autenticazione integrata, e un client tipizzato generato automaticamente dallo schema. Per un'app di questa scala, scrivere un backend REST/GraphQL custom sarebbe stato lavoro duplicato senza vantaggi — la vera logica applicativa "server-side" che serviva (funzioni atomiche, policy di accesso) è comunque scritta a mano in SQL/PL-pgSQL dentro Postgres stesso, non delegata a un livello di astrazione in più.

**Perché TanStack Query invece di Redux/Context per lo stato:** l'app non ha quasi stato *client-only* — quasi tutto è dati letti/scritti da Supabase. TanStack Query gestisce cache, invalidazione dopo mutazioni, stato di loading/error in modo dichiarativo, evitando `useEffect` + `useState` manuali sparsi ovunque (un pattern facile da sbagliare — race condition, memory leak sulle subscription non ripulite).

**Struttura del codice:** `src/app/` (route Expo Router) → `src/features/<dominio>/` (un hook TanStack Query per dominio: `useClients`, `useWorkSessions`, `usePayments`, ciascuno con query + mutation) → `src/lib/` (client Supabase, tipi generati). Separazione netta: i componenti UI non parlano mai direttamente con Supabase, sempre tramite un hook del dominio.

---

## Database e sicurezza a livello di riga (RLS)

**Il problema:** l'app è multi-tenant (più nuclei familiari indipendenti sugli stessi dati), pensata fin dall'inizio per poter essere usata da più famiglie diverse, non solo quella dell'utente. Ogni riga di ogni tabella appartiene a un `household_id`, e un utente deve poter leggere/scrivere *solo* i dati del proprio household.

**Perché RLS invece di un filtro `WHERE household_id = ...` scritto a mano in ogni query applicativa:** un filtro applicativo è un bug in attesa di succedere — basta dimenticarlo in *una* query, o aggiungerne una nuova senza ricordarsene, per esporre dati di un'altra famiglia. RLS sposta il controllo a livello di database: anche se il codice client ha un bug, Postgres rifiuta comunque la query. È "secure by default" invece che "secure se non dimentichi nulla".

**Pattern usato per ogni tabella:**
```sql
alter table clients enable row level security;

create policy "household members manage clients" on clients
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));
```
`is_household_member(household_id)` è una funzione helper riutilizzata su tutte le tabelle — `using` controlla le letture, `with check` le scritture (senza `with check`, un utente potrebbe modificare una riga e "spostarla" verso un household che non è il suo).

**L'incidente di ricorsione infinita (talking point forte per un colloquio):** la prima versione della policy su `household_members` controllava l'appartenenza interrogando... `household_members` stessa, dentro la propria `USING` clause. Postgres rileva questo come ricorsione infinita e lancia un errore (`42P17`). La soluzione standard (e quella usata qui) è una funzione `SECURITY DEFINER`:
```sql
create function is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;
```
`SECURITY DEFINER` fa eseguire la funzione con i privilegi del *proprietario* (il ruolo di migrazione, che ha `BYPASSRLS`), non del chiamante — quindi la query interna alla funzione non ri-attiva la policy che la sta chiamando, rompendo il ciclo. Questo bug è stato trovato **dai test di integrazione**, non da una revisione del codice: i test creavano due utenti reali, uno provava a leggere i dati dell'altro, e la query letteralmente falliva con l'errore Postgres — prova diretta che "sembra corretto leggendo l'SQL" non basta.

**`search_path` hardening (dettaglio di sicurezza spesso trascurato):** le funzioni `SECURITY DEFINER` dichiarano `set search_path = public, pg_temp` esplicitamente. Senza, Postgres cerca prima in `pg_temp` per risolvere i nomi delle tabelle — un utente che crea una tabella temporanea con lo stesso nome di una tabella reale potrebbe dirottare le query interne della funzione verso i propri dati. È lo stesso genere di vulnerabilità delle SQL injection ma a livello di *risoluzione dei nomi* invece che di sintassi.

**View e RLS — un'insidia meno nota:** una `view` Postgres normale eredita i privilegi del *proprietario* della view (non di chi la interroga) ai fini di RLS, a meno di dichiarare esplicitamente `with (security_invoker = true)`. Senza, una view potrebbe bypassare silenziosamente l'isolamento RLS delle tabelle sottostanti — stessa classe di bug della ricorsione, ma più subdola perché non dà nessun errore, semplicemente mostra dati che non dovrebbe. Usato per la view `work_session_status` (vedi sezione FIFO sotto).

---

## Il ledger dei pagamenti (pattern FIFO)

**Il problema di dominio:** la madre dell'utente fa pulizie in più case; alcuni clienti (case di villeggiatura) pagano più giornate insieme, non giorno per giorno. Serve un sistema che tenga traccia di "quanto è dovuto" vs "quanto è stato pagato" senza richiedere all'utente di associare manualmente ogni pagamento a giornate specifiche.

**Design scelto — saldo calcolato, non memorizzato:** invece di una colonna "pagato/non pagato" su ogni giornata lavorata (che richiederebbe logica applicativa complessa per aggiornarla ogni volta che arriva un pagamento parziale), lo stato si calcola *al volo* con una window function SQL:
```sql
create view work_session_status with (security_invoker = true) as
select ws.*,
  sum(ws.amount_due) over (partition by ws.client_id order by ws.date, ws.created_at, ws.id) as cumulative_due,
  coalesce(p.total_paid, 0) as total_paid,
  case when sum(ws.amount_due) over (...) <= coalesce(p.total_paid, 0) then 'paid' else 'unpaid' end as status
from work_sessions ws
left join (select client_id, sum(amount) as total_paid from payments group by client_id) p
  on p.client_id = ws.client_id;
```
Ordinando le giornate per data e sommando in modo cumulativo, e confrontando con la somma totale dei pagamenti di quel cliente, ogni giornata risulta "pagata" se il totale dovuto fino a quel punto è coperto dal totale pagato — esattamente la semantica FIFO (i pagamenti coprono le giornate più vecchie per prime) senza dover mai decidere esplicitamente "questo pagamento copre queste giornate". **Vantaggio architetturale:** non esiste mai uno stato inconsistente da correggere — il saldo è sempre una funzione pura dei dati grezzi (`work_sessions` + `payments`), ricalcolata a ogni lettura.

**Tariffa congelata (`rate_snapshot`):** ogni giornata lavorata salva la tariffa oraria del cliente *al momento dell'inserimento*, non un riferimento alla tariffa corrente. Se il cliente cambia tariffa in futuro, le giornate passate non vengono ricalcolate — è un requisito di correttezza storica/contabile comune in qualsiasi sistema di fatturazione.

**Colonna generata (`amount_due`):** `amount_due numeric generated always as (hours * rate_snapshot) stored` — Postgres calcola e memorizza automaticamente il prodotto, garantendo che non possa mai esistere una riga con un importo incoerente rispetto a ore×tariffa (impossibile scrivere un valore "sbagliato" per errore applicativo, perché la colonna non è scrivibile direttamente).

---

## Frontend e mobile

**Bug reale — differenza SSR tra web e nativo:** `AsyncStorage` (usato per la persistenza della sessione Supabase su mobile) funziona bene su nativo, ma la sua implementazione web tocca `window.localStorage` — che non esiste durante il rendering statico lato server di Expo Router (config `"web": {"output": "static"}`). Il fix corretto è un adapter differenziato per piattaforma:
```ts
storage: Platform.OS === 'web' ? webStorage : AsyncStorage
```
dove `webStorage` è un wrapper che controlla `typeof window === 'undefined'` prima di toccare `localStorage`. **Nota per il colloquio:** il primo tentativo di fix ha sostituito `AsyncStorage` con un adapter unico che diventava un no-op silenzioso su nativo (rompendo la persistenza della sessione su mobile, ad ogni riavvio l'utente sarebbe stato disconnesso) — un esempio concreto di come una correzione "veloce" possa introdurre una regressione peggiore del bug originale se non si legge con attenzione l'intero diff prima di accettarlo.

**Route dinamiche con parametri:** navigazione tra schermate passando id via query param (`router.push({ pathname: '/client/[id]', params: { id } })`, letto con `useLocalSearchParams()`), pattern standard di Expo Router equivalente ai dynamic route params di Next.js.

**Perché niente libreria UI (Tailwind/NativeWind, UI kit):** `StyleSheet` nativo di React Native è sufficiente per la complessità attuale, e ogni libreria in più è un vincolo di compatibilità cross-platform (web/iOS/Android) da mantenere. Principio YAGNI applicato consapevolmente.

---

## Sicurezza

- **RLS come confine di sicurezza primario** (vedi sopra) — mai fidarsi della UI per nascondere dati, la query stessa non può restituirli.
- **Nessuna scrittura diretta su `households`/`household_members`**: la creazione/adesione a un nucleo familiare passa da funzioni `SECURITY DEFINER` (`create_household`, `join_household`) invece che INSERT diretti — garantisce atomicità (household + membership creati insieme, mai uno senza l'altro) e non espone il codice invito di altri household tramite una policy SELECT permissiva.
- **Nessun segreto nel bundle client:** la service role key di Supabase (accesso amministrativo, bypassa RLS) è usata *solo* in script Node lato sviluppo/test, mai referenziata da codice che finisce nell'app. Le variabili `EXPO_PUBLIC_*` (uniche incluse nel bundle) contengono solo la anon key, pensata per essere pubblica — la sicurezza reale è delegata a RLS, non alla segretezza della chiave.
- **Verifica dei permessi CLI/token:** un personal access token Supabase (accesso all'intero account, non solo al progetto) è stato usato solo per comandi CLI non interattivi, mai scritto in file committati, mai stampato in log/commit — con verifica esplicita ("grep del diff per il prefisso del token") prima di ogni commit che toccava configurazione legata al progetto Supabase.

---

## Strategia di testing

**Due livelli distinti, per due scopi diversi:**
1. **Test di integrazione RLS** (`tests/rls/*.test.ts`, Jest, contro il database Supabase reale — non mock): creano utenti veri, autenticano client Supabase reali, e verificano che le policy blocchino davvero gli accessi incrociati tra household — incluso il *write-path* (INSERT/UPDATE/DELETE vietati), non solo la lettura. **Perché non basta testare solo SELECT:** in Postgres un UPDATE/DELETE bloccato da RLS non genera un errore, semplicemente non modifica righe (`0 rows affected`) — un test che si limita a "il comando non ha lanciato un'eccezione" darebbe falsa sicurezza; serve rileggere il dato e verificare che non sia stato alterato.
2. **Funzioni pure testate in isolamento** (Jest, nessuna rete): tutta la logica di calcolo monetario (`computeClientSummary`, filtri per periodo) è scritta come funzione pura (stesso input → stesso output, nessun side-effect) proprio per poterla testare senza dover simulare un database. Ha ripagato concretamente: la revisione finale del blocco ha trovato due bug reali proprio in queste funzioni (vedi sotto) grazie a test mirati sui casi limite.

**TDD applicato selettivamente:** non ovunque, ma sulla logica di business più a rischio di errore silenzioso (calcoli monetari) — scritto prima il test che fallisce (RED, verificando che fallisca per il motivo giusto: modulo non ancora esistente, non un'asserzione sbagliata), poi l'implementazione minima che lo fa passare (GREEN).

---

## Processo di sviluppo

Questo progetto è stato costruito con un flusso di lavoro strutturato basato su agenti AI (Claude Code), non semplicemente "chiedendo di scrivere codice" — un dettaglio che vale la pena spiegare in un colloquio come esempio di uso maturo di strumenti AI nello sviluppo software:

1. **Spec scritta e approvata prima di qualsiasi codice** (`docs/superpowers/specs/`) — decisioni architetturali discusse e fissate per iscritto, con alternative valutate esplicitamente (es. saldo FIFO calcolato vs. tabella di allocazione pagamenti separata).
2. **Piano di implementazione dettagliato per ogni blocco** (`docs/superpowers/plans/`), scomposto in task piccoli e verificabili, ciascuno con file esatti da toccare e codice completo (niente placeholder).
3. **Esecuzione con doppio livello di revisione:** ogni task viene implementato e poi revisionato *da un agente diverso* (non si auto-approva), con un ciclo di correzione se emergono problemi; a fine blocco, una revisione finale su tutto il diff cumulativo cerca problemi di integrazione che le revisioni per singolo task non potrebbero vedere.
4. **Verifica indipendente, non fiducia cieca:** ogni volta che un'implementazione dichiarava "test passati" o "nessun problema", chi coordinava il lavoro ha ri-eseguito la verifica in autonomia prima di accettarla — pratica che ha effettivamente catturato più bug reali durante lo sviluppo (vedi sotto).

Questo è un buon esempio per un colloquio di come l'AI possa essere usata per aumentare la produttività *senza* sacrificare la qualità — il valore non è "l'AI scrive il codice", ma il processo di verifica e revisione strutturato attorno ad essa.

---

## Bug reali trovati durante lo sviluppo

Ottimo materiale per la domanda da colloquio "raccontami di un bug che hai trovato e risolto":

1. **Ricorsione infinita in una policy RLS** (dettagli sopra) — trovata dai test di integrazione contro il database reale, non da lettura del codice. Risolta con una funzione `SECURITY DEFINER`.
2. **Regressione di persistenza sessione su mobile** — un tentativo di fix per un problema di rendering web ha silenziosamente rotto il login persistente su Android/iOS. Trovata leggendo il diff riga per riga invece di fidarsi del report "fatto" dell'implementazione.
3. **Bug di fine mese nel calcolo delle date** — `date.setMonth(date.getMonth() - 1)` in JavaScript non gestisce correttamente i giorni che non esistono nel mese precedente (es. 31 marzo meno un mese non dà 28 febbraio, ma "rotola" in avanti dentro marzo) — perdeva silenziosamente fino a 3 giorni dai totali del filtro "mese" in determinate date. Risolto trattando "mese" come finestra scorrevole di 30 giorni invece che mese di calendario.
4. **Bug UTC vs ora locale** — `new Date().toISOString().slice(0, 10)` restituisce la data in UTC, non quella locale: un'operazione registrata subito dopo mezzanotte in Italia risultava datata al giorno precedente. Risolto con una funzione dedicata che legge anno/mese/giorno locali (`getFullYear()`/`getMonth()`/`getDate()`) invece di passare per la stringa ISO.
5. **Test che darebbero falsa sicurezza** — un test di "negazione scrittura" usava un `client_id` inventato per provocare il rifiuto dell'INSERT: l'inserimento falliva sì, ma per un vincolo di chiave esterna (il cliente non esiste), non perché RLS lo stesse bloccando — quindi il test sarebbe passato anche con una policy di sicurezza completamente rotta. Corretto usando un cliente realmente esistente in un altro household, isolando il segnale RLS dal rumore del vincolo FK.
