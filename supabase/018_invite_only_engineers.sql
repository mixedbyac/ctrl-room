-- CTRL ROOM update: engineers are invite-only.
-- Signing up always makes an artist account. Engineer access only comes from Security › Engineers, and an added
-- engineer's account only counts once their email is confirmed (from your invite, or Verify). The main engineer always counts.
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.
create or replace function is_engineer() returns boolean
language sql stable security definer set search_path = public as $$
  select mfa_ok() and exists (
    select 1 from app_config
    where lower(value) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (key = 'engineer_email' or (key like 'engineer_email:%' and is_verified()))
  );
$$;
