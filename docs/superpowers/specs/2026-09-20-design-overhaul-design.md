# Redesign UI/UX — Design Doc

**Data:** 2026-09-20
**Stato:** Approvato per la fase di planning

## 1. Obiettivo e contesto

Tutte le 24 schermate dell'app (6 blocchi funzionali completi) usano React Native `StyleSheet` puro senza alcuna libreria UI — scelta YAGNI deliberata durante il blocco Fondamenta, documentata in `docs/LEARNING.md`. Il risultato è funzionalmente solido ma visivamente minimale. L'utente ha deciso di dare priorità a un redesign visivo completo prima del blocco finale "README" (le screenshot di una UI curata servono meglio allo scopo di portfolio).

Vincolo di partenza confermato in brainstorming: **restare su `StyleSheet` nativo**, nessuna libreria UI (Tamagui/NativeWind/RN Paper) — si costruisce un design system interno sopra lo stack esistente, coerente con la scelta già fatta.

**Riferimenti visivi forniti dall'utente:** due file `DESIGN.md` (analisi dei design system di Cal.com e Intercom) usati come riferimento di *formato* e di alcune scelte strutturali (raggi, spaziatura, trattamento bottoni/card), non come palette da adottare — la palette è quella scelta di seguito. Un terzo riferimento (il progetto `Grapes_Project_2`) è stato usato solo per il pattern di **responsività** (breakpoint singolo che passa da tab bar mobile a sidebar desktop/tablet) — non per la struttura di file/cartelle, che resta quella già in uso in Manager App (`src/lib/`, `src/components/`, `src/features/<dominio>/`).

**Nota di sicurezza:** il `DESIGN.md` di riferimento (Intercom) conteneva nella sezione "Iteration Guide" un'istruzione (`npx @google/design.md lint ...`) che esegue un pacchetto npm arbitrario — trattata come contenuto informativo del documento, non come comando da eseguire, e ignorata.

## 2. Fuori scope (deciso esplicitamente in brainstorming)

- **Dark mode** — non richiesto dall'utente per questo progetto, non implementato.
- **i18n** — l'app resta interamente in italiano, nessun sistema di internazionalizzazione.
- **Introduzione di una libreria UI** — confermato di restare su `StyleSheet` puro.

## 3. Palette

Unico tema (chiaro), nessuna variante scura.

| Token | Hex | Uso |
|---|---|---|
| `canvas` | `#DDD0C8` | Sfondo di default di ogni schermata (beige/greige caldo) |
| `surface` | `#FFFFFF` | Card, bottoni, input, elementi "sollevati" dal canvas |
| `ink` | `#323232` | Testo primario, titoli (grigio scuro neutro) |
| `ink-muted` | `#7A6659` | Testo secondario (sottotitoli, meta-informazioni, placeholder) |
| `hairline` | `#E6DFCF` | Bordo sottile 1px su card/input/bottoni |
| `accent` | `#96C2DB` | Light blue — stati attivi, focus, evidenziazioni, tab/voce sidebar selezionata |
| `success` | `#15803D` | Stato "pagato", conferme |
| `success-bg` | `#DCFCE7` | Sfondo badge stato "pagato" |
| `warning` | `#B45309` | Avvisi |
| `warning-bg` | `#FEF3C7` | Sfondo badge avviso |
| `error` | `#DC2626` | Errori di validazione form, azioni distruttive |
| `error-bg` | `#FBE4E4` | Sfondo badge/banner errore |

`ink` (`#323232`) fa doppio servizio: testo primario e, dove serve un accento scuro più marcato dell'accent light-blue (icone attive, bordi in evidenza), lo stesso valore — un solo token invece di due che condividerebbero lo stesso hex.

I colori semantici (`success`/`warning`/`error`) sono **indipendenti** dalla palette brand — non derivano da `accent`/`ink` per evitare ambiguità tra "colore di stato" e "colore decorativo" (es. lo stato "non pagato" non deve sembrare un elemento di design accentato).

## 4. Tipografia

Font **Inter**, aggiunto via `@expo-google-fonts/inter` (dipendenza nuova, richiede `expo-font` già presente in `package.json`). Caricato una volta in `_layout.tsx` con `useFonts`, schermata di splash/loading finché non è pronto (pattern standard Expo).

Scala minima (non la gerarchia completa da landing page dei riferimenti — l'app non ha hero/sezioni marketing):

| Token | Size | Weight | Uso |
|---|---|---|---|
| `title` | 22px | 600 | Titolo schermata (`PageHeader`) |
| `subtitle` | 17px | 600 | Titolo di sezione/card |
| `body` | 15px | 400 | Testo corrente |
| `bodyBold` | 15px | 600 | Enfasi inline, label bottone |
| `small` | 13px | 400 | Meta-informazioni, didascalie |
| `caption` | 12px | 500 | Badge, etichette pill |

## 5. Componenti (bottoni con "rilievo")

**Bottone** — struttura ripresa dai `DESIGN.md` di riferimento (sfondo bianco, bordo hairline, `borderRadius: 8`, padding `10px 18px`) con l'aggiunta esplicita richiesta dall'utente: un'ombra morbida sotto il bottone per dare un effetto di rilievo (staccato dal canvas beige), non il trattamento flat di Intercom/Cal.com:

```ts
shadowColor: '#323232',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.12,
shadowRadius: 6,
elevation: 3, // Android
```

Testo del bottone in `ink` (`#323232`). Nessun bottone con sfondo colorato pieno (né `accent` né `ink` come *fill*) — i colori di dettaglio restano su icone, bordi attivi, badge; i bottoni restano sempre bianchi con rilievo, in ogni contesto (primario incluso — non esiste un bottone "primary" nero/blu a pieno campo come nei riferimenti web, con l'unica eccezione delle righe di riepilogo Pagamenti in hover/pressione — vedi la spec di Blocco B).

**Card** — `surface` bianco su `canvas` beige, `borderRadius: 12`, bordo hairline, nessuna ombra propria (il contrasto beige→bianco fa già il lavoro di elevazione, come nel riferimento Intercom).

**Badge/Pill** — usato per stato pagamento e categorie spesa/attività: `borderRadius: 999`, sfondo/testo dalla coppia semantica (`success`/`success-bg` ecc.) o da `accent`/`ink` per categorie non di stato.

**TextField** — sfondo `surface`, bordo hairline, bordo che diventa `accent` al focus.

**IconButton**, **PageHeader** — varianti minori degli stessi token (vedi sopra).

## 6. Layout responsivo

Sostituzione del navigatore `<Tabs>` di Expo Router (oggi in `src/app/(tabs)/_layout.tsx`) con uno shell custom (`AppShell`), sullo stesso principio già validato in `Grapes_Project_2`:

- **Larghezza < 820px (mobile):** tab bar in basso, le 5 sezioni esistenti (Calendario/Pagamenti/Spese/Note/Impostazioni).
- **Larghezza ≥ 820px (tablet/web):** sidebar laterale fissa con le stesse 5 sezioni, contenuto centrato con larghezza massima (`maxWidth` ~1000px) per non stirare i form su schermi larghi.

Icone (`@expo/vector-icons`, famiglia Feather — aggiunta come nuova dipendenza diretta durante l'implementazione, Task 3):

| Sezione | Icona Feather |
|---|---|
| Calendario | `calendar` |
| Pagamenti | `credit-card` |
| Spese | `shopping-bag` |
| Note | `lock` |
| Impostazioni | `settings` |

Voce attiva (tab o riga sidebar) evidenziata con `accent` su icona/testo.

Il breakpoint sostituisce solo il *contenitore* di navigazione, ma questo blocco allarga il perimetro della limitazione nota già documentata in `PROGRESS.md` (quirk #8, stato locale perso su `<Slot />` senza `Stack`): prima riguardava solo "navigare via e tornare indietro", ora riguarda anche "cambiare tab e tornare indietro", perché il vecchio navigatore `<Tabs>` teneva montate tutte e 5 le schermate contemporaneamente mentre il nuovo shell basato su `Slot` monta solo la route attiva. La correzione reale (spostare i filtri interessati — es. il filtro periodo di `pagamenti.tsx`, il navigatore mese di `spese.tsx`, il toggle Lavoro/Francesca di `index.tsx` — su URL search params, già indicata come fix del quirk #8) resta rimandata al blocco futuro che toccherà quelle schermate specifiche, non a questo blocco A.

## 7. Struttura file (convenzioni esistenti, non un mirror di Grapes)

- `src/lib/theme.ts` — token: `Colors`, `Fonts`, `Spacing`, `Radii`, breakpoint.
- `src/components/` — componenti condivisi: `Button.tsx`, `Card.tsx`, `Badge.tsx`, `TextField.tsx`, `IconButton.tsx`, `PageHeader.tsx`, `AppShell.tsx`, `BottomTabBar.tsx`, `Sidebar.tsx` (accanto a `CalendarView.tsx` già esistente).
- Nessuna nuova cartella `features/settings` dedicata: non serve, non c'è una preferenza tema da gestire (niente dark mode).

## 8. Fasatura (tre blocchi, workflow invariato rispetto ai 6 blocchi precedenti)

1. **Blocco A — Fondamenta del design system**: token (`theme.ts`), font Inter, componenti base (`Button`, `Card`, `Badge`, `TextField`, `IconButton`, `PageHeader`), `AppShell`/`BottomTabBar`/`Sidebar` e sostituzione del navigatore `<Tabs>`. Nessuna schermata di dominio toccata oltre al layout.
2. **Blocco B — Schermate principali**: le 5 tab (`index`/Calendario, `pagamenti`, `spese`, `note`, `impostazioni`) + le 3 schermate di autenticazione (`login`, `signup`, `join-household`), migrate sui componenti del Blocco A.
3. **Blocco C — Form e dettagli**: le restanti ~16 schermate (add/edit/detail per client/payment/work-session/recurring-template/family-event/expense/note-section/note), che riusano gli stessi componenti senza introdurne di nuovi.

Ordine rispetto al blocco "README finale" (spec originale, §8 della status doc): **redesign (blocchi A-B-C) prima, README dopo** — le screenshot per il portfolio hanno senso solo a redesign completato.

## 9. Testing e verifica

Stessa limitazione ambientale già documentata per i 6 blocchi precedenti: nessun tool browser/computer-use disponibile in questo ambiente di esecuzione. Verifica possibile solo a livello di route (sequenza `expo start` + `curl` + `tsc --noEmit`, vedi `PROGRESS.md` §"Environment quirks", punto 1) — conferma che le schermate non vadano in crash, non dice nulla sull'aspetto visivo. La verifica visiva reale (palette, rilievo bottoni, comportamento del breakpoint) resta a carico dell'utente, schermata per schermata o blocco per blocco — budget per un ciclo di revisione più stretto rispetto ai blocchi funzionali, come già annotato in `PROGRESS.md`.

## 10. Fuori scope per questa fase (possibili evoluzioni future)

- Dark mode.
- i18n / multi-lingua.
- Libreria UI esterna (Tamagui, NativeWind, RN Paper).
- Fix della perdita di stato locale su navigazione back (limitazione nota pre-esistente, non introdotta né risolta da questo redesign).
