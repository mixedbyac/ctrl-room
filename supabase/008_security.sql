-- CTRL ROOM security update. Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.
-- Safe to run more than once.

-- 1) Two-step verification: if someone has turned on 2-step, their session only counts once they've entered the code.
create or replace function mfa_ok() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;

-- 2) New accounts must confirm their email (or be confirmed by the engineer) before any projects unlock.
create or replace function is_verified() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'needs_verify')::boolean, false) = false;
$$;

create or replace function is_engineer() returns boolean
language sql stable security definer set search_path = public as $$
  select mfa_ok() and exists (
    select 1 from app_config
    where key = 'engineer_email'
      and lower(value) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'artist_members') then
    execute $f$
      create or replace function can_see_project(pid uuid) returns boolean
      language sql stable security definer set search_path = public as $q$
        select is_engineer() or (mfa_ok() and is_verified() and exists (
          select 1 from projects p
          where p.id = pid and (
            (p.client_email is not null and lower(p.client_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
            or exists (select 1 from artist_members m where lower(m.artist) = lower(p.artist)
                       and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
          )
        ));
      $q$;
    $f$;
  else
    execute $f$
      create or replace function can_see_project(pid uuid) returns boolean
      language sql stable security definer set search_path = public as $q$
        select is_engineer() or (mfa_ok() and is_verified() and exists (
          select 1 from projects p where p.id = pid and p.client_email is not null
            and lower(p.client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        ));
      $q$;
    $f$;
  end if;
end $$;

-- 3) Clients can only post notes as themselves, and only log plays as themselves.
drop policy if exists n_ins on notes;
create policy n_ins on notes for insert with check (
  can_see_project((select project_id from songs where id = song_id)) and (is_engineer() or from_client = true)
);
drop policy if exists pl_ins on plays;
create policy pl_ins on plays for insert with check (
  can_see_project((select project_id from songs where id = song_id))
  and (listener_email is null or lower(listener_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
);

-- 4) "Request changes" can only name a version of that same song.
create or replace function request_changes(p_song uuid, p_version uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  if not can_see_project((select project_id from songs where id = p_song)) then raise exception 'not allowed'; end if;
  select label into v_label from versions where id = p_version and song_id = p_song;
  update songs set status = 'changes', approved_version = null, approved_at = null where id = p_song;
  insert into updates (song_id, from_client, body) values (p_song, true, 'Requested changes on ' || coalesce(v_label, 'the mix') || '.');
end $$;

-- 5) Things from earlier updates, in case they haven't been run yet.
alter table versions add column if not exists lufs real;
alter table uploads add column if not exists archived boolean not null default false;
