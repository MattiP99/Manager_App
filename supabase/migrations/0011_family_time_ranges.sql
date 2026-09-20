-- Sostituisce il singolo campo `time` con un intervallo start_time/end_time
-- per recurring_templates e calendar_events. Le occorrenze già esistenti
-- hanno solo l'orario di inizio: durata di default 30 minuti per calcolare
-- l'orario di fine mancante (deciso con l'utente — modificabile poi a mano
-- riaprendo l'impegno). Righe che avevano già time null restano con
-- start_time/end_time entrambi null (nessun orario da mostrare).
--
-- Ordine importante: il backfill deve girare PRIMA di aggiungere i vincoli
-- CHECK, altrimenti ogni riga già valorizzata violerebbe
-- "(start_time is null) = (end_time is null)" nell'istante in cui
-- end_time viene aggiunta come colonna (sempre NULL finché non backfillata)
-- — la versione precedente di questa migrazione aveva l'ordine invertito
-- ed è "riuscita" solo perché nessuna riga aveva ancora un time valorizzato.

alter table recurring_templates
  rename column time to start_time;
alter table recurring_templates
  add column end_time time;

update recurring_templates
  set end_time = least(start_time + interval '30 minutes', time '23:59:59')
  where start_time is not null;

alter table recurring_templates
  add constraint recurring_templates_time_pair check (
    (start_time is null) = (end_time is null)
  ),
  add constraint recurring_templates_time_order check (
    start_time is null or end_time > start_time
  );

alter table calendar_events
  rename column time to start_time;
alter table calendar_events
  add column end_time time;

update calendar_events
  set end_time = least(start_time + interval '30 minutes', time '23:59:59')
  where start_time is not null;

alter table calendar_events
  add constraint calendar_events_time_pair check (
    (start_time is null) = (end_time is null)
  ),
  add constraint calendar_events_time_order check (
    start_time is null or end_time > start_time
  );
