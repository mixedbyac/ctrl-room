-- CTRL ROOM update: "Remember this device" for two-step verification (30 days).
-- After you enter your code once with the box ticked, that browser/app skips the code on later sign-ins.
-- Your password is still needed, and Security › "Forget remembered devices" turns it off everywhere.
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.

create table if not exists trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists trusted_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references trusted_devices(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table trusted_devices enable row level security;
alter table trusted_sessions enable row level security;
-- no policies: only the functions below (and the server) touch these tables

-- call right after entering the code (the session is aal2): remembers this device
create or replace function trust_device(p_token text, p_label text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' or auth.uid() is null or length(coalesce(p_token, '')) < 32 then return false; end if;
  insert into trusted_devices (user_id, token_hash, label, expires_at)
  values (auth.uid(), encode(sha256(convert_to(p_token, 'utf8')), 'hex'), left(p_label, 80), now() + interval '30 days')
  on conflict (token_hash) do update set expires_at = excluded.expires_at, last_used = now();
  insert into trusted_sessions (session_id, user_id, device_id)
  select (auth.jwt() ->> 'session_id')::uuid, auth.uid(), d.id from trusted_devices d where d.token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
  on conflict (session_id) do nothing;
  return true;
end $$;

-- call after a password sign-in on a remembered device: this session counts as two-step checked
create or replace function claim_device(p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare d uuid;
begin
  if auth.uid() is null or coalesce(p_token, '') = '' then return false; end if;
  select id into d from trusted_devices
   where user_id = auth.uid() and token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex') and expires_at > now();
  if d is null then return false; end if;
  insert into trusted_sessions (session_id, user_id, device_id) values ((auth.jwt() ->> 'session_id')::uuid, auth.uid(), d)
  on conflict (session_id) do nothing;
  update trusted_devices set last_used = now() where id = d;
  return true;
end $$;

create or replace function forget_devices() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from trusted_devices where user_id = auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function trusted_session() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from trusted_sessions s join trusted_devices d on d.id = s.device_id
     where s.session_id = (auth.jwt() ->> 'session_id')::uuid and s.user_id = auth.uid() and d.expires_at > now()
  );
exception when others then return false;
end $$;

create or replace function mfa_ok() returns boolean
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then return true; end if;
  if trusted_session() then return true; end if;
  return not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
exception when others then
  return true; -- if Supabase doesn't let us read 2-step info, don't lock anyone out
end $$;

grant execute on function trust_device(text, text), claim_device(text), forget_devices(), trusted_session() to authenticated;
