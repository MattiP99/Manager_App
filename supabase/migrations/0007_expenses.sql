-- Spese mensili: 4 categorie (supermercato, frutta_verdura, extra,
-- francesca). francesca_activity è valorizzato se e solo se
-- category = 'francesca' (vincolo di coerenza incrociata sotto) e usa le
-- stesse 5 attività reali di recurring_templates/calendar_events
-- (mensa/palestra/cavallo/piscina/teatro, MAI 'altro').

create table expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category text not null check (category in ('supermercato', 'frutta_verdura', 'extra', 'francesca')),
  label text,
  francesca_activity text check (francesca_activity in ('mensa', 'palestra', 'cavallo', 'piscina', 'teatro')),
  amount numeric(10,2) not null check (amount > 0),
  date date not null,
  created_at timestamptz not null default now(),
  check ((category = 'francesca') = (francesca_activity is not null))
);

alter table expenses enable row level security;

create policy "household members manage expenses" on expenses
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));
