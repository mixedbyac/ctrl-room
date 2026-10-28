-- CTRL ROOM update: more than one engineer (an assistant or co-engineer). Added from the Security page.
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.
create or replace function is_engineer() returns boolean
language sql stable security definer set search_path = public as $$
  select mfa_ok() and exists (
    select 1 from app_config
    where (key = 'engineer_email' or key like 'engineer_email:%')
      and lower(value) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
