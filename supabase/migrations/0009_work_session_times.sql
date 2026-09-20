-- Orario di inizio/fine per le giornate lavorate. Nullable: le righe già
-- esistenti non hanno alcun dato di orario da cui derivarlo — "obbligatorio
-- per i nuovi inserimenti" è applicato lato form (add-work-session.tsx),
-- non con un NOT NULL che romperebbe le righe storiche.

alter table work_sessions
  add column start_time time,
  add column end_time time,
  add constraint work_sessions_time_pair check (
    (start_time is null) = (end_time is null)
  ),
  add constraint work_sessions_time_order check (
    start_time is null or end_time > start_time
  );
