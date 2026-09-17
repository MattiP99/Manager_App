-- households & household_members: isolamento multi-tenant per nucleo familiare

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table households enable row level security;
alter table household_members enable row level security;

-- SELECT: solo i membri del proprio household. Nessuna policy INSERT/UPDATE/DELETE
-- diretta: la creazione/adesione passa esclusivamente dalle funzioni SECURITY DEFINER
-- sotto, per garantire atomicità e non esporre invite_code di altri household.
create policy "select own household" on households
  for select using (
    id in (select household_id from household_members where user_id = auth.uid())
  );

create policy "select own membership rows" on household_members
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );

-- genera un codice invito breve e univoco (6 caratteri alfanumerici maiuscoli)
create or replace function generate_invite_code()
returns text
language plpgsql
as $$
declare
  code text;
  attempts int := 0;
begin
  loop
    code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from households where invite_code = code);
    attempts := attempts + 1;
    if attempts > 10 then
      raise exception 'Could not generate a unique invite code';
    end if;
  end loop;
  return code;
end;
$$;

create or replace function create_household(p_name text)
returns households
language plpgsql
security definer
set search_path = public
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

  return new_household;
end;
$$;

create or replace function join_household(p_code text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into target_household from households where invite_code = upper(trim(p_code));

  if target_household.id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into household_members (household_id, user_id)
  values (target_household.id, auth.uid())
  on conflict do nothing;

  return target_household;
end;
$$;
