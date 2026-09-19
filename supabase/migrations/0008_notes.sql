-- Note: sezioni (info/password/custom) + note vere e proprie. Le sezioni
-- Password conservano solo materiale non segreto (salt, canary cifrato) —
-- la passphrase stessa non tocca mai il server, la chiave si deriva e si
-- cifra/decifra interamente sul client (vedi Task 3/4).

create table note_sections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  type text not null check (type in ('info', 'password', 'custom')),
  sort_order int not null default 0,
  -- Solo per la sezione 'password': salt (esadecimale) usato per derivare
  -- la chiave dalla passphrase, e un piccolo valore noto cifrato con quella
  -- chiave (per verificare che una passphrase inserita sia corretta anche
  -- prima che esista una nota reale da provare a decifrare). Nessuno dei
  -- due è materiale segreto: senza la passphrase non permettono di
  -- decifrare nulla.
  encryption_salt text,
  encryption_canary text,
  created_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references note_sections(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  -- Esattamente uno dei due è valorizzato: content per sezioni info/custom
  -- (testo in chiaro), content_encrypted per la sezione password (base64
  -- del blob combinato IV+ciphertext+tag di aesEncryptAsync).
  content text,
  content_encrypted text,
  created_at timestamptz not null default now(),
  check ((content is not null) <> (content_encrypted is not null))
);

alter table note_sections enable row level security;
alter table notes enable row level security;

create policy "household members manage note_sections" on note_sections
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "household members manage notes" on notes
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Estende create_household (0001_households.sql) per creare automaticamente
-- le 3 sezioni di base alla creazione di un household. search_path hardening
-- di 0003_harden_search_path.sql dichiarato esplicitamente qui (non solo
-- "public" come nella versione originale di 0001) perché questo
-- `create or replace` ridefinisce l'intero corpo della funzione.
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

  return new_household;
end;
$$;
