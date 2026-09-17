-- Harden search_path on all SECURITY DEFINER / privileged functions:
-- explicit "public, pg_temp" ordering prevents a caller-created temp object
-- from shadowing the relations these functions reference internally.

alter function generate_invite_code() set search_path = public, pg_temp;
alter function create_household(text) set search_path = public, pg_temp;
alter function join_household(text) set search_path = public, pg_temp;
alter function is_household_member(uuid) set search_path = public, pg_temp;
