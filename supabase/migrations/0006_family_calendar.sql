-- Calendario familiare: impegni ricorrenti (modelli) + eventi puntuali
-- (eccezioni a un modello ricorrente, o eventi manuali non ricorrenti).
-- Le occorrenze ricorrenti "regolari" non vengono mai materializzate qui:
-- il client le espande al volo da recurring_templates per l'intervallo
-- visualizzato, sovrascrivendole con eventuali righe calendar_events con
-- lo stesso recurring_template_id + date.

create table recurring_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  category text not null check (category in ('mensa', 'palestra', 'cavallo', 'piscina', 'teatro', 'altro')),
  person text not null,
  weekday smallint not null check (weekday between 0 and 6),
  time time,
  note text,
  created_at timestamptz not null default now()
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recurring_template_id uuid references recurring_templates(id) on delete cascade,
  title text not null,
  category text not null check (category in ('mensa', 'palestra', 'cavallo', 'piscina', 'teatro', 'altro')),
  person text not null,
  date date not null,
  time time,
  note text,
  is_cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  -- Al massimo una riga (eccezione o cancellazione) per occorrenza di un
  -- modello ricorrente. NULL su recurring_template_id non collide mai con
  -- se stesso in un vincolo unique Postgres, quindi gli eventi manuali
  -- (recurring_template_id null) non sono limitati da questo vincolo.
  unique (recurring_template_id, date)
);

alter table recurring_templates enable row level security;
alter table calendar_events enable row level security;

create policy "household members manage recurring_templates" on recurring_templates
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "household members manage calendar_events" on calendar_events
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));
