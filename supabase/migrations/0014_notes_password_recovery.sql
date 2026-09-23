-- Recupero passphrase Password via email. La vera chiave di cifratura (DEK)
-- diventa casuale e indipendente dalla passphrase — la passphrase la
-- "avvolge" (wrap, AES-256-GCM) tramite una chiave derivata (PBKDF2), ma non
-- È più la chiave stessa (prima lo era: keyBytes = deriveKey(passphrase,
-- salt) veniva usata direttamente per cifrare le note). encryption_salt
-- resta il salt PBKDF2, encryption_canary resta cifrato con la DEK (non più
-- con la chiave derivata direttamente).
alter table note_sections add column encryption_wrapped_key text;

-- Una copia della DEK in chiaro, depositata qui per il recupero via email.
-- Leggibile via RLS SOLO durante una sessione aperta cliccando il link di
-- recupero di Supabase Auth (resetPasswordForEmail) — verificato
-- empiricamente 2026-09-23 con admin.generateLink + verifyOtp che una
-- sessione così ha il claim JWT amr = [{"method":"otp",...}], diverso da un
-- login normale (amr = [{"method":"password",...}]).
--
-- Compromesso di sicurezza dichiarato: questo protegge da un membro della
-- famiglia loggato normalmente ma senza la passphrase, e da chiunque non
-- abbia accesso alla mail di login — NON da un accesso diretto e privilegiato
-- al database (service role key trafugata, dump di backup), che bypassa RLS
-- e potrebbe leggere questa tabella. Accettato: un accesso di quel livello
-- vedrebbe comunque tutti gli altri dati dell'household in chiaro (clienti,
-- pagamenti, calendario), la sezione Password non era pensata per resistere
-- a QUEL livello di compromissione, solo a un dump/lettura casuale del
-- database e a un utente non autorizzato senza la passphrase. Vedi
-- PROGRESS.md per la discussione completa.
create table note_section_recovery (
  section_id uuid primary key references note_sections(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  recovery_key_hex text not null,
  updated_at timestamptz not null default now()
);

alter table note_section_recovery enable row level security;

-- Scrittura: una sessione normale del household può depositare/aggiornare la
-- DEK di recupero (al setup iniziale, o per rigenerarla) — la DEK in sé non è
-- un privilegio nuovo rispetto a quello che un membro con la passphrase
-- corretta già ha.
create policy "household members write note_section_recovery" on note_section_recovery
  for insert with check (is_household_member(household_id));

create policy "household members update note_section_recovery" on note_section_recovery
  for update using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Lettura: SOLO durante una sessione di recupero via email. Nessuna policy
-- "for all"/"for select" più permissiva altrove su questa tabella — è
-- l'unica via di lettura.
create policy "recovery session can read note_section_recovery" on note_section_recovery
  for select using (
    is_household_member(household_id)
    and exists (
      select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) elem
      where elem ->> 'method' = 'otp'
    )
  );
