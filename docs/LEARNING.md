# Manager App — Note tecniche per colloqui

> Documento di studio, non di codice. Raccoglie le scelte tecniche del progetto e il *perché*, organizzate per argomento, per poterle spiegare e giustificare a un reclutatore (posizioni backend/frontend/full stack). Aggiornato a ogni blocco completato — ultimo aggiornamento: fine blocco "Calendario Lavoro" (3/6 blocchi).

Indice: [Architettura](#architettura-generale) · [Database e RLS](#database-e-sicurezza-a-livello-di-riga-rls) · [Ledger FIFO](#il-ledger-dei-pagamenti-pattern-fifo) · [Calendario visuale](#calendario-visuale-componente-parametrico) · [Frontend](#frontend-e-mobile) · [Sicurezza](#sicurezza) · [Testing](#strategia-di-testing) · [Processo di sviluppo](#processo-di-sviluppo) · [Bug reali trovati](#bug-reali-trovati-durante-lo-sviluppo)

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

## Calendario visuale (componente parametrico)

**Il problema di design:** la spec richiedeva fin dall'inizio due calendari visivamente diversi (giornate lavorate pagato/non-pagato, e in un blocco futuro gli impegni di Francesca con categorie/persone), ma con la stessa meccanica di navigazione giorno/settimana/mese. Duplicare la griglia calendario per ognuno sarebbe stato il classico errore di accoppiare "come si disegna una cella" a "cosa contiene una cella".

**Soluzione — inversion of control via prop `renderDay`:** `CalendarView` (componente condiviso) non sa nulla di clienti, pagamenti o stati: possiede solo la meccanica generica (calcolo griglia, toggle vista, navigazione periodo) e delega interamente il contenuto/colore di ogni cella al chiamante tramite `renderDay(date, meta) => ReactNode` e la navigazione al tap tramite `onDayPress(date)`. Il tab Calendario Lavoro passa un `renderDay` che legge lo stato pagato/non-pagato; un futuro tab Calendario Francesca passerà un `renderDay` diverso senza toccare `CalendarView` — lo stesso pattern dei "render prop"/"slot" component usato in tante UI library, qui applicato senza dipendenze esterne.

**Perché la logica di calcolo data è separata dal componente:** tutte le funzioni di griglia (`getWeekDays`, `getMonthGridDays`, `shiftAnchorDate`, formattazione etichette) vivono in `src/features/calendar/calendarGrid.ts` come funzioni pure, non nel file `.tsx` del componente. Motivo molto concreto, non solo "best practice" astratta: il progetto usa il preset Jest `jest-expo/node`, che **non ha un renderer** — qualunque logica scritta dentro un componente `.tsx` è di fatto non testabile in questo setup. Una violazione di questa regola (successa proprio durante questo blocco, vedi sotto) è passata inosservata per sei revisioni di task prima di essere presa dalla revisione finale sull'intero branch, proprio perché nessun test poteva accorgersene.

**Il bug di fine-anno (variante del bug di fine-mese già visto nel blocco precedente):** la funzione che genera l'etichetta della vista settimana confrontava solo il mese di inizio/fine settimana, mai l'anno — una settimana come 28 dicembre 2026 – 3 gennaio 2027 veniva etichettata interamente "2027", attribuendo dicembre all'anno sbagliato. Stessa famiglia di bug delle date-al-contorno già viste (rollover di fine mese, UTC vs locale), stesso motivo: codice di calcolo data scritto senza un test che eserciti esplicitamente il caso limite. Fix: controllare sempre `primaData.getFullYear() !== ultimaData.getFullYear()` prima di assumere un solo anno, e un test dedicato con una settimana reale a cavallo di due anni (non un caso sintetico) per non lasciarlo mai più senza copertura.

## Frontend e mobile

**Bug reale — differenza SSR tra web e nativo:** `AsyncStorage` (usato per la persistenza della sessione Supabase su mobile) funziona bene su nativo, ma la sua implementazione web tocca `window.localStorage` — che non esiste durante il rendering statico lato server di Expo Router (config `"web": {"output": "static"}`). Il fix corretto è un adapter differenziato per piattaforma:
```ts
storage: Platform.OS === 'web' ? webStorage : AsyncStorage
```
dove `webStorage` è un wrapper che controlla `typeof window === 'undefined'` prima di toccare `localStorage`. **Nota per il colloquio:** il primo tentativo di fix ha sostituito `AsyncStorage` con un adapter unico che diventava un no-op silenzioso su nativo (rompendo la persistenza della sessione su mobile, ad ogni riavvio l'utente sarebbe stato disconnesso) — un esempio concreto di come una correzione "veloce" possa introdurre una regressione peggiore del bug originale se non si legge con attenzione l'intero diff prima di accettarlo.

**Route dinamiche con parametri:** navigazione tra schermate passando id via query param (`router.push({ pathname: '/client/[id]', params: { id } })`, letto con `useLocalSearchParams()`), pattern standard di Expo Router equivalente ai dynamic route params di Next.js.

**Perché niente libreria UI (Tailwind/NativeWind, UI kit):** `StyleSheet` nativo di React Native è sufficiente per la complessità attuale, e ogni libreria in più è un vincolo di compatibilità cross-platform (web/iOS/Android) da mantenere. Principio YAGNI applicato consapevolmente. Stessa scelta per il calendario: nessuna libreria di date/calendario aggiunta, la griglia giorno/settimana/mese è `View`/`Pressable` puri sopra funzioni di calcolo data scritte a mano.

**`ScrollView` senza un `style` con altezza vincolata è un no-op silenzioso (bug reale trovato nella revisione finale):** per far scorrere un contenuto più alto dello schermo (una griglia mese di 6 settimane), non basta avvolgerlo in `<ScrollView contentContainerStyle={...}>`. `contentContainerStyle` definisce solo lo stile del contenuto interno; la `ScrollView` stessa ha bisogno di un `style` con un'altezza delimitata (tipicamente `flex: 1`) per stabilire il "viewport" oltre il quale il contenuto può scorrere — senza, il componente nativo si dimensiona sul contenuto stesso invece che sullo schermo, e non c'è nulla da cui "scorrere fuori". Pattern corretto: `<ScrollView style={{flex: 1}} contentContainerStyle={{padding, gap}}>`, tenendo `flex` fuori dal contenitore del contenuto (dove il valore corretto, se serve, sarebbe `flexGrow: 1`, non `flex: 1`, per non introdurre un `flexShrink` che confligge con l'altezza naturale del contenuto). Bug facile da introdurre proprio perché sui browser (React Native Web) il comportamento di default del CSS flex può mascherarlo, mentre su nativo (iOS/Android) l'assenza del viewport delimitato è più evidente.

**Limite noto del routing `<Slot />` senza `Stack`:** lo stato locale (`useState`) di una schermata tab viene perso quando si naviga via e si torna indietro, perché `<Slot />` smonta la schermata non a fuoco invece di tenerla in una history stack. Per il calendario questo significa che la vista/il periodo selezionati tornano al default (settimana corrente) dopo aver aperto il dettaglio di un giorno e essere tornati indietro — comportamento già latente nel filtro periodo della tab Pagamenti, solo mai notato prima. Non è un bug di dati (l'invalidazione cache funziona correttamente), è una perdita di stato di navigazione. Soluzione corretta se/quando servirà: spostare quello stato nei parametri di ricerca dell'URL (`useLocalSearchParams`) invece che in `useState` locale, così sopravvive al remount. Accettato come limite noto per ora, non risolto in questo blocco.

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
6. **Bug di fine-anno nell'etichetta della vista settimana** (blocco Calendario Lavoro) — una settimana a cavallo tra dicembre e gennaio veniva etichettata con un solo anno (quello sbagliato per i giorni di dicembre), perché il confronto controllava solo il mese, mai l'anno. Trovato dalla revisione finale sull'intero branch, non dalle revisioni per singolo task — perché il codice colpevole viveva in un file `.tsx` non testabile con il preset Jest del progetto, e nessuna revisione di task aveva verificato che il codice del piano stesso rispettasse il vincolo "tutta la logica di data deve essere in funzioni pure testabili". Lezione di processo: un piano che scrive codice verbatim può violare i propri stessi vincoli, e le revisioni per-task controllano l'aderenza al piano, non l'aderenza del piano a se stesso — serve un controllo esplicito in più a fine blocco.
7. **`ScrollView` senza viewport delimitato, un fix apparente che in realtà non fixava nulla** — durante il primo giro di correzioni post-revisione-finale, il fix per l'overflow della vista mese ha spostato l'intero stile del contenitore (incluso `flex: 1`) su `contentContainerStyle`, lasciando la `ScrollView` stessa senza `style`. Il codice compilava, i test passavano (nessun test automatico può verificare comportamento di scroll in questo progetto), e il fix sarebbe stato accettato senza una revisione mirata che ha ragionato esplicitamente sulla differenza tra `style` e `contentContainerStyle` di una `ScrollView` — un promemoria che "i test passano" e "il codice compila" non bastano per una correzione di layout/UI in un progetto senza tooling di browser.

## Nota di processo aggiunta in questo blocco

La revisione finale sull'intero branch ha reso esplicito un punto cieco delle revisioni per-task: quando un piano di implementazione contiene codice scritto per intero (non solo una descrizione), quel codice può violare i vincoli che il piano stesso dichiara (es. "tutta la logica di data in funzioni pure testabili"), e nessuna revisione per-task lo scoprirà perché ogni revisione confronta l'implementazione col piano, non il piano con se stesso. Aggiunta come pratica per i prossimi blocchi: durante la scrittura del piano, un controllo esplicito "il codice che sto scrivendo nel piano rispetta i miei stessi Global Constraints?" prima di considerarlo pronto per l'esecuzione.
