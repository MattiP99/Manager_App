-- Fix infinite recursion (42P17) in household_members/households SELECT policies.
-- A SECURITY DEFINER helper breaks the cycle: it's owned by a BYPASSRLS role,
-- so its internal query against household_members doesn't re-trigger the policy.

create or replace function is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

drop policy "select own household" on households;
create policy "select own household" on households
  for select using (is_household_member(id));

drop policy "select own membership rows" on household_members;
create policy "select own membership rows" on household_members
  for select using (is_household_member(household_id));
