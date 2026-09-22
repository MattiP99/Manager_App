-- Le categorie di Spese (supermercato/frutta_verdura/extra/francesca) erano
-- un elenco fisso, vincolato da una CHECK statica su expenses.category.
-- Diventano righe per-famiglia in questa nuova tabella, stesso principio già
-- usato per note_sections (Note) — l'utente può aggiungerne di nuove
-- ("+ Sezione").
--
-- `slug` è il valore testuale già usato in expenses.category (invariato:
-- 'supermercato', 'frutta_verdura', 'extra', 'francesca' per le 4 di
-- default) — per questo la tabella expenses NON ha bisogno di alcuna
-- migrazione dati, la FK sotto valida i valori esistenti così come sono.
-- Per una categoria nuova creata dall'app, `slug` non viene passato
-- dall'insert e prende il default random qui sotto: è solo un identificatore
-- interno, mai mostrato — l'utente vede sempre `label`.
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  slug text not null default gen_random_uuid()::text,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, slug)
);

alter table expense_categories enable row level security;

create policy "household members manage expense_categories" on expense_categories
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Bootstrap per gli household già esistenti — create_household sotto copre
-- solo quelli futuri. Idempotente (where not exists), sicura da rilanciare.
insert into expense_categories (household_id, slug, label, sort_order)
select h.id, d.slug, d.label, d.sort_order
from households h
cross join (values
  ('supermercato', 'Supermercato', 0),
  ('frutta_verdura', 'Frutta e verdura', 1),
  ('extra', 'Extra', 2),
  ('francesca', 'Francesca', 3)
) as d(slug, label, sort_order)
where not exists (
  select 1 from expense_categories ec where ec.household_id = h.id and ec.slug = d.slug
);

-- La CHECK statica non regge più con categorie dinamiche per famiglia.
-- Sostituita dalla FK composita sotto, che valida ESATTAMENTE la stessa
-- cosa (categoria deve esistere) più in aggiunta lo scoping per household
-- (che la vecchia CHECK non copriva affatto).
alter table expenses drop constraint expenses_category_check;

alter table expenses add constraint expenses_category_fkey
  foreign key (household_id, category) references expense_categories (household_id, slug);

-- Estende create_household (0001, poi 0008 per note_sections) per fare il
-- bootstrap anche delle 4 categorie spesa di default — stesso principio.
create or replace function create_household(p_name text)
returns households
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_household households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Household name is required';
  end if;

  insert into households (name, invite_code)
  values (trim(p_name), generate_invite_code())
  returning * into new_household;

  insert into household_members (household_id, user_id)
  values (new_household.id, auth.uid());

  insert into note_sections (household_id, title, type, sort_order) values
    (new_household.id, 'Info importanti', 'info', 0),
    (new_household.id, 'Info secondarie', 'info', 1),
    (new_household.id, 'Password', 'password', 2);

  insert into expense_categories (household_id, slug, label, sort_order) values
    (new_household.id, 'supermercato', 'Supermercato', 0),
    (new_household.id, 'frutta_verdura', 'Frutta e verdura', 1),
    (new_household.id, 'extra', 'Extra', 2),
    (new_household.id, 'francesca', 'Francesca', 3);

  return new_household;
end;
$$;
