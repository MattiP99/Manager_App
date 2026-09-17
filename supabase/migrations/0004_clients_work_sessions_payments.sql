-- Clienti, giornate lavorate, pagamenti — household-scoped via is_household_member.

create table clients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  hourly_rate numeric(10,2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table work_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  date date not null,
  hours numeric(5,2) not null check (hours > 0),
  rate_snapshot numeric(10,2) not null,
  amount_due numeric(10,2) generated always as (hours * rate_snapshot) stored,
  note text,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  date date not null,
  amount numeric(10,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

alter table clients enable row level security;
alter table work_sessions enable row level security;
alter table payments enable row level security;

create policy "household members manage clients" on clients
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "household members manage work_sessions" on work_sessions
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "household members manage payments" on payments
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Stato pagato/non pagato per singola giornata — FIFO: un pagamento copre
-- le giornate più vecchie non ancora saldate, perché un cliente spesso
-- salda più giornate insieme.
-- security_invoker=true è OBBLIGATORIO: senza, la view gira con i
-- privilegi del proprietario (il ruolo di migrazione) ai fini RLS, non
-- dell'utente che interroga — bypasserebbe silenziosamente l'isolamento
-- per household. Stessa classe di errore già vista e corretta in 0002.
create view work_session_status
  with (security_invoker = true)
as
select
  ws.*,
  sum(ws.amount_due) over (partition by ws.client_id order by ws.date, ws.created_at) as cumulative_due,
  coalesce(p.total_paid, 0) as total_paid,
  case
    when sum(ws.amount_due) over (partition by ws.client_id order by ws.date, ws.created_at)
         <= coalesce(p.total_paid, 0)
    then 'paid' else 'unpaid'
  end as status
from work_sessions ws
left join (
  select client_id, sum(amount) as total_paid from payments group by client_id
) p on p.client_id = ws.client_id;
