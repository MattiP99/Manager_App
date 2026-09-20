# Blocco B — Calendario a griglia oraria e Pagamenti — Design Doc

**Data:** 2026-09-20
**Stato:** Approvato per la fase di planning

## 1. Obiettivo e contesto

Prima vera ristilizzazione di contenuto del redesign (Blocco A ha costruito solo la fondazione: token, componenti base, `AppShell` responsivo — nessuna schermata di dominio toccata). Questo blocco copre due schermate: **Calendario** (viste Giorno/Settimana/Mese, toggle Lavoro/Francesca) e **Pagamenti**. Scope deciso direttamente dall'utente con requisiti visivi concreti, non da un brainstorming di alternative.

**Scoperta di partenza (verificata sullo schema Postgres reale prima di scrivere qualunque codice, stesso principio già seguito nei blocchi precedenti — mai fidarsi di un'assunzione su dati/API senza controllarla):** un vero calendario a griglia oraria richiede un orario di inizio e fine per ogni voce. Oggi:
- `work_sessions` ha solo `hours` (ore totali lavorate quel giorno) — **nessun orario**, nemmeno di inizio.
- `recurring_templates`/`calendar_events` hanno un solo campo `time` (nullable) — **nessun orario di fine**.

Questo blocco include quindi una modifica di schema, non solo di stile.

## 2. Modifica di schema

### 2.1 `work_sessions` — nuove colonne, nullable

```sql
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

**Nullable, non `NOT NULL`:** le righe già esistenti (l'household della madre dell'utente è già in uso) non hanno alcun dato di orario da cui derivarlo — non ha senso inventare un orario fittizio per dati storici. Il vincolo di coerenza incrociata (`start_time`/`end_time` entrambi null o entrambi valorizzati) segue lo stesso pattern già usato per `expenses.francesca_activity` nel blocco Spese mensili. **"Obbligatorio d'ora in poi" è applicato lato form** (Task del piano corrispondente), non con un `NOT NULL` a livello di database — un `NOT NULL` romperebbe le righe storiche che restano legittimamente senza orario.

### 2.2 `recurring_templates`/`calendar_events` — sostituzione di `time` con `start_time`/`end_time`

```sql
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

-- backfill: le occorrenze già esistenti hanno solo l'orario di inizio;
-- durata di default 30 minuti per calcolare l'orario di fine mancante
-- (deciso con l'utente — modificabile poi a mano riaprendo l'impegno).
update recurring_templates
  set end_time = start_time + interval '30 minutes'
  where start_time is not null;

-- stessa cosa su calendar_events (eccezioni/eventi manuali)
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

Righe che avevano già `time is null` restano con `start_time`/`end_time` entrambi null (nessun orario da mostrare, stesso trattamento delle `work_sessions` storiche — vedi §3.2).

### 2.3 Rigenerazione tipi e aggiornamento funzioni pure esistenti

- `src/lib/database.types.ts` rigenerato dopo la migrazione (comando già stabilito nel progetto).
- `expandOccurrences` (`src/features/family-calendar/recurringOccurrences.ts`) oggi propaga il singolo campo `time` dal modello/eccezione all'occorrenza virtuale — va aggiornato per propagare `start_time`/`end_time` invece, stessa logica di override modello→eccezione già esistente, solo con due campi invece di uno.

## 3. Calendario — card a due zone (Giorno/Settimana/Mese unificate) [REVISIONATO 2026-09-21]

**Revisione rispetto alla versione precedente di questa sezione:** la prima stesura prevedeva una griglia oraria a posizionamento pixel (stile Google Calendar, con una funzione `layoutTimeBlocks` che calcola `top`/`height`). Discutendo il risultato con l'utente, la richiesta reale è più semplice: una card per giorno con due zone colorate (Mattina/Pomeriggio) che elencano le voci con orario in testo, non un motore di posizionamento grafico a pixel. Questa sezione sostituisce interamente §3.1-3.5 della versione precedente. Nessun piano di implementazione era ancora stato scritto per questa parte (solo Piano 1 — schema/form — è stato eseguito), quindi non c'è lavoro da disfare.

### 3.1 Un solo componente di cella, usato da Giorno/Settimana/Mese

Niente `TimeGridView` separato. La cella-giorno esistente di `CalendarView` (oggi un piccolo indicatore di stato) diventa una card più ricca, con lo stesso design in tutte e 3 le viste — cambia solo la dimensione (grande in vista Giorno, media in Settimana, piccola nella griglia di Mese), non la struttura. `CalendarView` continua a possedere solo la meccanica di navigazione periodo; il contenuto della card resta iniettato via `renderDay` (stesso principio di inversion-of-control già in uso), non un nuovo componente parallelo.

**Struttura della card:**
- Sfondo bianco (`Colors.surface`), bordo sottile azzurro (`Colors.accent`), angoli arrotondati (`Radii.md`) — non più il bordo grigio (`#eee`) attuale.
- Divisa in due zone verticali, **Mattina** e **Pomeriggio** (soglia alle 13:00, stesso criterio già deciso per la vista Mese nella versione precedente della spec), separate da una linea sottile. Ogni zona ha un leggero tint di sfondo distinto (non un overlay sul singolo evento come nella versione precedente — il tint copre l'intera zona): Mattina `rgba(150, 194, 219, 0.20)` (tint dell'attuale `accent` `#96C2DB`), Pomeriggio `rgba(50, 50, 50, 0.08)` (tint dell'attuale `ink` `#323232`, alpha più basso perché `ink` è scuro).
- Dentro ogni zona, le voci di quella metà giornata sono elencate verticalmente (un semplice `map`, nessun algoritmo di posizionamento — "una sopra l'altra senza sovrapporsi" del messaggio dell'utente è esattamente un elenco verticale), ciascuna come una piccola riga/chip con **testo dell'orario visibile** (`HH:MM–HH:MM`) e l'etichetta (nome cliente per Lavoro, titolo per Francesca).
- Voci senza orario (dati storici, §2) finiscono nella zona Mattina come fallback, stesso criterio già deciso per la vista Mese.

**Nuova funzione pura testabile** (`src/features/calendar/dayHalves.ts`): `splitByHalfDay<T extends {start_time: string | null}>(items: T[]): {morning: T[], afternoon: T[]}` — smista in base a `start_time < '13:00'` (o null → mattina), ordina ciascun gruppo per `start_time`. Sostituisce interamente `layoutTimeBlocks`/`timeGrid.ts` della versione precedente — non serve calcolare alcuna geometria, solo raggruppare e ordinare.

### 3.2 Colori per categoria — Francesca

Decisione rivista rispetto alla versione precedente (che usava un overlay unico per tutta la sezione Francesca): ogni categoria ha il proprio colore, preso dalla palette "Report" del riferimento Intercom già in `DESIGN.md`:

| Categoria | Colore | Hex |
|---|---|---|
| Mensa | Report Blue | `#65b5ff` |
| Palestra | Report Green | `#0bdf50` |
| Cavallo | Report Pink | `#ff2067` |
| Piscina | Report Lime | `#b3e01c` |
| Teatro | Report Cyan | `#03b2cb` |
| Altro | `Colors.inkMuted` (grigio neutro, nessun colore "Report" dedicato) | `#7A6659` |

Nuova mappa `FAMILY_CATEGORY_COLORS: Record<FamilyCategory, string>` in `src/features/family-calendar/constants.ts` (accanto a `FAMILY_CATEGORIES` già esistente). Il colore tinge il chip della voce (sfondo chip, non l'intera zona Mattina/Pomeriggio, che resta con il tint unico di §3.1). La sezione Lavoro non ha categorie — resta un solo colore (l'accent) per tutti i chip.

### 3.3 Interazione: le voci si aprono in una finestra modale (eccezione esplicita al pattern "sempre schermate dedicate")

**Decisione che introduce una seconda eccezione al pattern di navigazione stabilito nel progetto** ("schermate dedicate con `router.back()`, mai modali" — la prima eccezione era il colore hover di Pagamenti, §4.3): toccare un singolo chip (Lavoro o Francesca, in qualunque vista) apre una **finestra modale** con i dettagli della voce, non una navigazione a schermo intero. Nuovo componente condiviso `src/components/DetailModal.tsx` (wrapper minimale sopra `Modal` di React Native — già disponibile, nessuna nuova dipendenza), usato da entrambe le sezioni:
- **Lavoro:** mostra cliente, ore, orario, nota — con la nota modificabile direttamente nel modale (vedi §3.5, nuova `useUpdateWorkSession`).
- **Francesca:** mostra titolo, categoria, persona, orario, nota — stesso contenuto già presente in `edit-family-event.tsx`, ora raggiungibile anche dal modale (il modale copre "modifica rapida"; `edit-family-event.tsx` resta raggiungibile per i casi già gestiti lì, es. "Modifica solo questo giorno" su un'occorrenza ricorrente, che richiede più contesto di un modale rapido).

Le pagine di dettaglio giorno (`day/[date].tsx`, `family-day/[date].tsx`) **restano** — non sostituite dal modale — per la vista d'insieme della giornata e l'aggiunta di nuove voci (vedi §3.4/§3.5). Il modale è per l'interazione rapida su una voce già visibile nel calendario o nella pagina del giorno; le pagine sono per la vista completa/aggiunta.

### 3.4 `family-day/[date].tsx`: solo il colore dei chip, nessun'altra modifica di questo blocco

Riusa `FAMILY_CATEGORY_COLORS` (§3.2) per colorare le righe della lista esistente. Le voci diventano cliccabili verso il modale (§3.3) invece che verso `edit-family-event.tsx` direttamente (che resta raggiungibile dal modale stesso per i casi che lo richiedono, vedi §3.3).

### 3.5 `day/[date].tsx` — ristilizzato, con nota modificabile

- **Sfondo:** oggi questa schermata (come tutte le ~16 fuori da `(tabs)/`) non è avvolta da `AppShell` e quindi non eredita `Colors.canvas` — appare bianca/grigia di default. Fix: `backgroundColor: Colors.canvas` esplicito sul container di questa schermata (fix mirato, non un cambiamento di `AppShell` o delle altre schermate — quelle restano nel Blocco C).
- **Card per giornata lavorata:** ogni riga della `FlatList` diventa una card grande, sfondo bianco, bordo arrotondato azzurrino (stesso stile di §3.1), con il **nome del cliente in testo grande** (`Typography.title`) e, sotto, ore/importo/orario e la nota (se presente).
- **Nota modificabile:** toccare la card apre lo stesso `DetailModal` di §3.3 (variante Lavoro), con la nota modificabile e salvabile. Richiede una nuova `useUpdateWorkSession` (`src/features/work-sessions/useWorkSessions.ts`) — finora non esisteva alcuna modifica di una giornata lavorata dopo la creazione (`add-work-session.tsx` era l'unico punto di scrittura). Campi modificabili dal modale: nota (sempre), ore e orario (opzionale nella prima versione — se il tempo lo consente, altrimenti solo la nota, che è l'unico requisito esplicito dell'utente).
- **Bottone "+ Giornata":** ristilizzato — più stretto e più alto, sfondo `#4D424C` (lo stesso "marrone melanzana" già introdotto per l'hover di Pagamenti, qui però come colore di sfondo permanente, non solo hover). **Seconda eccezione esplicita alla regola "bottoni sempre bianchi"** del Blocco A (la prima era l'hover di Pagamenti) — vale per i bottoni "+" delle pagine calendario (`day/[date].tsx`, `family-day/[date].tsx`), non un cambiamento generale dello stile `Button` condiviso.

### 3.6 Tab Calendario (`index.tsx`) — meno spazio sprecato, card più grandi

Stesso principio già fissato nella versione precedente di questa spec, riconfermato: troppo padding tra il calendario e i bordi della pagina (segnalato di nuovo dall'utente). Fix:
- Il padding laterale della schermata scende a `Spacing.md` (invece del generico `24` uniforme), e le card-giorno di §3.1 si espandono per usare la larghezza extra così liberata — su web, con la sidebar a sinistra e il bordo destro della pagina, il calendario deve occupare la larghezza reale disponibile dentro il `maxWidth` di `AppShell`, non restare compresso con margini larghi.
- Le card diventano anche più alte (specialmente in vista Giorno, dove c'è una sola card a piena larghezza) — l'altezza si adatta al numero di voci nelle due zone piuttosto che a un `minHeight` fisso piccolo come oggi (`56px`), così le voci con orario restano leggibili invece di essere compresse.
- **Bottoni toggle Giorno/Settimana/Mese e Lavoro/Francesca:** diventano bottoni bianchi con rilievo (stesso `Button`/stile del Blocco A), non più il blu generico attuale (`#dbeafe`/`#2563eb`, mai definito nei token del redesign). Voce attiva evidenziata con `Colors.ink` sul testo (stessa correzione di contrasto già applicata alla sidebar/tab bar nel Blocco A) e/o un bordo `Colors.accent`, mai uno sfondo pieno colorato — coerente con la regola bottoni del Blocco A (questi restano bottoni "normali", non rientrano nelle eccezioni marroni di §3.5/§4.3).

## 4. Pagamenti — layout a piena larghezza + drill-down

### 4.1 Righe di riepilogo a piena larghezza

Le 4 righe di riepilogo (ore totali, dovuto, ricevuto, saldo) oggi vivono impilate dentro un unico box `grandTotal` compresso. Diventano 4 elementi che occupano l'intera larghezza disponibile della pagina (dentro il `maxWidth` di `AppShell`, non oltre), ciascuno un `Button`-come-riga (bianco, rilievo, testo che occupa buona parte del bottone — non un'etichetta piccola in un angolo).

### 4.2 Drill-down per cliente

Cliccando una riga si apre un elenco per-cliente che compone quel totale (es. "Dovuto" → lista clienti con il rispettivo dovuto, che sommati danno il totale mostrato) — deciso con l'utente. Implementato come nuova schermata (`src/app/payment-detail.tsx`, parametro `metric` + `period`) piuttosto che un modale, coerente con il pattern di navigazione già usato in tutto il progetto (schermate dedicate con bottone "Annulla"/`router.back()`, mai modali).

### 4.3 Colore hover/pressione — eccezione esplicita alla regola "bottoni sempre bianchi"

Le 4 righe di riepilogo (non gli altri bottoni del progetto) diventano marroni (`#4D424C`, RGB 77/66/76 — un marrone-melanzana scuro fornito dall'utente, **non** lo stesso hex di `Colors.ink`) con testo bianco **solo** in stato hover (web, `Pressable` con gestione `onHoverIn`/`onHoverOut` — React Native Web supporta gli eventi hover su `Pressable`) o pressione (mobile, stato `pressed` di `Pressable`). A riposo restano bianche con rilievo come ogni altro bottone. Nuovo token `Colors.rowHighlight` = `#4D424C`. **Questa è l'unica eccezione nel progetto alla regola "bottoni sempre bianchi, mai sfondo pieno colorato"** fissata nel Blocco A — vale solo per queste righe di riepilogo pagamenti, non si estende automaticamente ad altri bottoni nei Blocchi B/C successivi senza una decisione esplicita.

### 4.4 Padding laterale

Stesso principio del Calendario (§3.5): il contenuto della pagina Pagamenti passa da `padding: 24` fisso a un padding ridotto (`Spacing.md`/`Spacing.lg`) così le righe di riepilogo e la lista clienti usano più larghezza reale dello schermo, specialmente su web dove `AppShell` non aggiunge più il proprio padding dal Blocco A.

## 5. Principio generale per schermate future (Blocco C)

La direzione "meno padding sprecato, elementi che riempiono lo spazio disponibile su web" si applica come linea guida per ogni schermata futura del redesign (Blocco C: form e dettagli), non solo per queste due. Non è uno scope item di questo blocco riscrivere le altre ~16 schermate — sono già in coda nel Blocco C, che erediterà questo principio invece di riscoprirlo schermata per schermata.

## 6. Fasatura (tre piani separati, stesso workflow subagent-driven-development)

1. ✅ **Piano 1 — Schema e form**: migrazione §2, rigenerazione tipi, aggiornamento `expandOccurrences`, campi orario inizio/fine nei form `add-work-session.tsx`/`add-family-event.tsx`/`edit-family-event.tsx`/`add-recurring-template.tsx`/`edit-recurring-template.tsx` (obbligatori per nuovi inserimenti, validazione lato form `end > start`). Completo, 6 commit su `main`.
2. ⬜ **Piano 2 — Calendario** (revisionato 2026-09-21, vedi §3): `dayHalves.ts` (funzione pura + test), card a due zone riusata da Giorno/Settimana/Mese, colori per categoria Francesca, `DetailModal` condiviso, `useUpdateWorkSession`, ristilizzazione `day/[date].tsx`/`family-day/[date].tsx`, bottoni toggle e bottoni "+" ristilizzati, layout a piena altezza/larghezza. **NEXT.**
3. ⬜ **Piano 3 — Pagamenti**: righe di riepilogo a piena larghezza, schermata `payment-detail.tsx`, colore hover/pressione marrone, padding ridotto.

Ogni piano segue la stessa struttura (Global Constraints, task numerati, verifica anti-stale-router-types dove tocca `src/app/`) dei piani precedenti.

## 7. Testing

- Funzione pura `splitByHalfDay` (Piano 2, sostituisce `layoutTimeBlocks` della versione precedente di questa spec): unit test su casi limite (voce esattamente alle 13:00 → pomeriggio o mattina? il confine è "< 13:00 → mattina", quindi 13:00 esatto è pomeriggio — test dedicato su questo confine), voce senza orario → mattina, ordinamento corretto all'interno di ciascun gruppo.
- `expandOccurrences` aggiornato (Piano 1, già fatto): propagazione `start_time`/`end_time` invece di `time` — verificato.
- Nessun test automatico per i componenti `.tsx` (limite noto e accettato del preset Jest di questo progetto), incluso `DetailModal`.
- Verifica visiva reale (card a due zone, colori categoria, apertura modale, layout a piena altezza/larghezza) resta a carico dell'utente — nessun tool browser disponibile in questo ambiente.

## 8. Fuori scope per questo blocco

- Editing di orario/ore dalla card di modifica rapida di `day/[date].tsx` — nella prima versione il modale modifica solo la nota; orario/ore restano modificabili solo se il tempo del blocco lo consente, altrimenti rimandato.
- Un algoritmo di posizionamento a pixel per la griglia oraria (scartato in questa revisione a favore delle due zone Mattina/Pomeriggio con elenco testuale, §3.1).
- Ristilizzazione delle altre ~15 schermate fuori da Calendario/Pagamenti (Blocco C) — `day/[date].tsx` e `family-day/[date].tsx` sono eccezioni esplicite trattate qui perché raggiunte direttamente dal Calendario, non un'estensione dello scope a tutto Blocco C.
- Qualunque altro bottone del progetto che diventi colorato in modo permanente o su hover, oltre alle due eccezioni esplicite già fissate (Pagamenti §4.3, bottoni "+" calendario §3.5) — resta un'eccezione puntuale, non una nuova regola generale.
- Qualunque altra schermata che passi da navigazione a modale, oltre ai chip di Calendario (§3.3) — resta un'eccezione puntuale al pattern "sempre schermate dedicate", non un cambio di convenzione generale del progetto.
