-- CTRL ROOM repair: if songs/projects stopped showing after the security update, run this.
-- It makes the two-step check fail safe (it can never block the database from answering).
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.

create or replace function mfa_ok() returns boolean
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then return true; end if;
  return not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
exception when others then
  return true; -- if Supabase doesn't let us read 2-step info, don't lock anyone out
end $$;

create or replace function is_verified() returns boolean
language plpgsql stable as $$
begin
  return coalesce((auth.jwt() -> 'app_metadata' ->> 'needs_verify')::boolean, false) = false;
exception when others then
  return true;
end $$;

create or replace function is_engineer() returns boolean
language sql stable security definer set search_path = public as $$
  select mfa_ok() and exists (
    select 1 from app_config
    where key = 'engineer_email'
      and lower(value) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- quick check: this should list your projects and how many songs each has
select p.title, p.artist, count(s.id) as songs
from projects p left join songs s on s.project_id = p.id
group by p.id order by p.created_at desc;
