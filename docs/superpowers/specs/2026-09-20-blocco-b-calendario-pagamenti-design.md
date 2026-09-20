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

## 3. Calendario — griglia oraria (viste Giorno/Settimana)

### 3.1 Nuovo componente, non una modifica di `CalendarView`

Le viste Giorno/Settimana passano da "riga di celle piccole con un indicatore" (quello che `CalendarView` fa oggi per tutte e 3 le viste) a una vera griglia oraria (colonna di ore, blocchi posizionati/dimensionati per orario di inizio/fine — stile Google Calendar). La vista Mese resta invece un riquadro per giorno (ristilizzato, vedi §3.3). Questo è un cambio di paradigma, non solo di stile, per due delle tre viste — `CalendarView` viene diviso:
- `CalendarView` mantiene la meccanica di navigazione periodo (mese/settimana/giorno, frecce, etichetta periodo) e diventa il contenitore che sceglie il layout in base a `view`.
- Nuovo componente puro-di-rendering `TimeGridView` (Giorno/Settimana) — riceve una lista di "blocchi" già pronti (non conosce nulla di lavoro/pagamenti/Francesca, stesso principio di inversion-of-control già usato per `renderDay`) e li posiziona in una griglia oraria.
- Nuova funzione pura testabile `layoutTimeBlocks` (`src/features/calendar/timeGrid.ts`) che, data una lista di `{startTime, endTime, ...}` e un range orario della griglia (es. 07:00-21:00), calcola `top`/`height` in percentuale per ogni blocco — stessa disciplina già applicata a `calendarGrid.ts`/`expenseSummary.ts`: tutta la logica di calcolo in una funzione pura testata, mai dentro il componente `.tsx`.

### 3.2 Voci senza orario (dati storici)

Le `work_sessions` storiche (nessun orario) e le occorrenze Francesca che restano senza orario dopo il backfill (§2.2) non hanno un `top`/`height` calcolabile. Vengono mostrate in una striscia "Senza orario" sopra la griglia oraria del giorno (pattern standard "eventi tutto il giorno" dei calendari, non inventato qui) — non forzate dentro la griglia con un orario fittizio.

### 3.3 Vista Mese — riquadro per giorno con due sezioni

Ogni cella del mese (già esistente in `CalendarView`, non nel nuovo `TimeGridView`) diventa un riquadro bianco diviso in due sezioni verticali, **Mattina** (fino alle 13:00) e **Pomeriggio** (dalle 13:00), ciascuna con orario + etichetta (nome cliente per Lavoro, titolo/persona per Francesca) delle voci di quella metà giornata. Voci senza orario finiscono nella sezione Mattina come fallback (nessuna terza sezione "senza orario" nel mese, a differenza di Giorno/Settimana — il riquadro mese è già piccolo, una terza sezione lo affollerebbe).

### 3.4 Colori dei blocchi occupati

Una "maschera leggermente colorata" (overlay semi-trasparente sul rettangolo bianco, non un riempimento pieno) — un solo colore per sezione, non uno per categoria (deciso con l'utente):
- Lavoro: overlay `rgba(164, 200, 225, 0.35)` (tint di `accent`).
- Francesca: overlay `rgba(63, 32, 33, 0.15)` (tint di `ink`, alpha più basso perché `ink` è un colore scuro — a parità di leggerezza percepita).

Questi due valori sono nuovi token in `src/lib/theme.ts` (`Colors.workBlockOverlay`, `Colors.familyBlockOverlay`), non calcolati a runtime.

### 3.5 Layout verticale: la griglia riempie la pagina

I riquadri bianchi della griglia oraria devono occupare quasi tutta l'altezza disponibile della pagina, non una porzione piccola circondata da spazio vuoto. Lo schermo `index.tsx` (tab Calendario) passa da `ScrollView` con `padding: 24` fisso a un layout che dà alla griglia oraria `flex: 1` reale (stesso principio già noto nel progetto per `ScrollView`: serve un contenitore con altezza vincolata, non contenuto che si dimensiona su se stesso). Il padding laterale interno alla schermata si riduce a `Spacing.md`/`Spacing.lg` invece del generico `24` uniforme su ogni lato — l'eccesso di padding segnalato dall'utente viene da qui, non da `AppShell` (che dal Blocco A non ha più padding proprio).

**Bottoni toggle Giorno/Settimana/Mese e Lavoro/Francesca:** diventano bottoni bianchi con rilievo (stesso `Button`/stile del Blocco A), non più il blu generico attuale (`#dbeafe`/`#2563eb`, mai definito nei token del redesign). Voce attiva evidenziata con `Colors.ink` sul testo (stessa correzione di contrasto già applicata alla sidebar/tab bar nel Blocco A) e/o un bordo `Colors.accent`, mai uno sfondo pieno colorato — coerente con la regola bottoni del Blocco A.

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

1. **Piano 1 — Schema e form**: migrazione §2, rigenerazione tipi, aggiornamento `expandOccurrences`, campi orario inizio/fine nei form `add-work-session.tsx`/`add-family-event.tsx`/`edit-family-event.tsx`/`add-recurring-template.tsx`/`edit-recurring-template.tsx` (obbligatori per nuovi inserimenti, validazione lato form `end > start`).
2. **Piano 2 — Calendario**: `timeGrid.ts` (funzione pura + test), `TimeGridView`, integrazione in `CalendarView`/`index.tsx` per Giorno/Settimana, riquadro Mese a due sezioni, colori overlay, bottoni toggle ristilizzati, layout a piena altezza.
3. **Piano 3 — Pagamenti**: righe di riepilogo a piena larghezza, schermata `payment-detail.tsx`, colore hover/pressione marrone, padding ridotto.

Ogni piano segue la stessa struttura (Global Constraints, task numerati, verifica anti-stale-router-types dove tocca `src/app/`) dei piani precedenti — Piano 2/3 dipendono dal completamento del Piano 1 (i dati di orario devono esistere prima che la UI possa mostrarli).

## 7. Testing

- Funzione pura `layoutTimeBlocks` (Piano 2): unit test su casi limite (blocco che inizia esattamente all'ora di apertura griglia, blocco che finisce esattamente alla chiusura, blocchi sovrapposti sullo stesso giorno — comportamento: affiancati, non sovrapposti visivamente, stesso principio delle colonne multiple di un calendario reale).
- `expandOccurrences` aggiornato (Piano 1): estendere i test esistenti per verificare la propagazione di `start_time`/`end_time` invece di `time`.
- Nessun test automatico per i componenti `.tsx` (limite noto e accettato del preset Jest di questo progetto).
- Verifica visiva reale (griglia oraria, colori overlay, layout a piena altezza, hover marrone) resta a carico dell'utente — nessun tool browser disponibile in questo ambiente.

## 8. Fuori scope per questo blocco

- Editing di `work_sessions` esistenti per aggiungere retroattivamente un orario (le righe storiche restano "senza orario" per sempre, a meno che l'utente non le riapra e modifichi manualmente in futuro).
- Sovrapposizioni complesse nella griglia oraria oltre il caso base "affianca i blocchi che si sovrappongono" (nessun algoritmo di scheduling avanzato).
- Ristilizzazione delle altre ~16 schermate (Blocco C).
- Qualunque altro bottone del progetto che diventi colorato su hover — resta un'eccezione isolata a Pagamenti §4.3.
