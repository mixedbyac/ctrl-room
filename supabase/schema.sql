-- Ctrl Room database
-- Run this once in Supabase: SQL Editor › New query › paste › Run.
-- Before running, replace you@example.com (near the bottom) with the email you sign in with.

create extension if not exists pgcrypto;

-- ---------- config ----------
create table if not exists app_config (
  key text primary key,
  value text not null
);
alter table app_config enable row level security;

create or replace function is_engineer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_config
    where key = 'engineer_email'
      and lower(value) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- projects ----------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  type text not null default 'Single',
  release date,
  seed bigint not null default floor(random() * 1000000000),
  contact_name text,
  client_email text,
  phone text,
  settings jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function can_see_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_engineer() or exists (
    select 1 from projects p
    where p.id = pid
      and p.client_email is not null
      and lower(p.client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- songs ----------
create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  position int not null default 0,
  bpm numeric,
  musical_key text,
  reference text,
  artist_notes text,
  isrc text,
  status text not null default 'progress' check (status in ('progress','review','changes','approved')),
  approved_version uuid,
  approved_at timestamptz,
  eta date,
  received_at date,
  downloaded_at date,
  mixing_at date,
  files_summary text,
  seed bigint not null default floor(random() * 1000000000),
  created_at timestamptz not null default now()
);

create table if not exists versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  label text not null,
  note text,
  storage_path text not null,
  duration real,
  peaks jsonb,
  peak_db real,
  rms_db real,
  file_name text,
  file_size bigint,
  file_format text,
  sample_rate int,
  bit_depth int,
  lossless boolean,
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  version_id uuid references versions(id) on delete set null,
  t real,
  body text not null,
  author_email text default (auth.jwt() ->> 'email'),
  author_name text,
  from_client boolean not null default true,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists updates (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  from_client boolean not null default false,
  body text not null,
  texted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists plays (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  version_id uuid references versions(id) on delete cascade,
  listener_email text default (auth.jwt() ->> 'email'),
  device text,
  source text,
  listened real not null default 0,
  duration real,
  bins text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text,
  email text,
  phone text,
  artist text,
  message text,
  songs jsonb not null default '[]'::jsonb,
  downloaded_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- row level security ----------
alter table projects enable row level security;
alter table songs enable row level security;
alter table versions enable row level security;
alter table notes enable row level security;
alter table updates enable row level security;
alter table plays enable row level security;
alter table uploads enable row level security;

drop policy if exists p_sel on projects;   create policy p_sel on projects for select using (can_see_project(id));
drop policy if exists p_all on projects;   create policy p_all on projects for all using (is_engineer()) with check (is_engineer());

drop policy if exists s_sel on songs;      create policy s_sel on songs for select using (can_see_project(project_id));
drop policy if exists s_all on songs;      create policy s_all on songs for all using (is_engineer()) with check (is_engineer());

drop policy if exists v_sel on versions;   create policy v_sel on versions for select using (can_see_project((select project_id from songs where id = song_id)));
drop policy if exists v_all on versions;   create policy v_all on versions for all using (is_engineer()) with check (is_engineer());

drop policy if exists n_sel on notes;      create policy n_sel on notes for select using (can_see_project((select project_id from songs where id = song_id)));
drop policy if exists n_ins on notes;      create policy n_ins on notes for insert with check (can_see_project((select project_id from songs where id = song_id)));
drop policy if exists n_eng on notes;      create policy n_eng on notes for update using (is_engineer());
drop policy if exists n_del on notes;      create policy n_del on notes for delete using (is_engineer());

drop policy if exists u_sel on updates;    create policy u_sel on updates for select using (can_see_project((select project_id from songs where id = song_id)));
drop policy if exists u_all on updates;    create policy u_all on updates for all using (is_engineer()) with check (is_engineer());

drop policy if exists pl_sel on plays;     create policy pl_sel on plays for select using (is_engineer() or listener_email = auth.jwt() ->> 'email');
drop policy if exists pl_ins on plays;     create policy pl_ins on plays for insert with check (can_see_project((select project_id from songs where id = song_id)));
drop policy if exists pl_upd on plays;     create policy pl_upd on plays for update using (listener_email = auth.jwt() ->> 'email');

drop policy if exists up_eng on uploads;   create policy up_eng on uploads for all using (is_engineer()) with check (is_engineer());

-- ---------- client actions (approve / request changes) ----------
create or replace function approve_version(p_song uuid, p_version uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  if not can_see_project((select project_id from songs where id = p_song)) then raise exception 'not allowed'; end if;
  select label into v_label from versions where id = p_version and song_id = p_song;
  if v_label is null then raise exception 'unknown version'; end if;
  update songs set status = 'approved', approved_version = p_version, approved_at = now(), eta = null where id = p_song;
  insert into updates (song_id, from_client, body) values (p_song, true, 'Approved ' || v_label || '.');
end $$;

create or replace function undo_approval(p_song uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_see_project((select project_id from songs where id = p_song)) then raise exception 'not allowed'; end if;
  update songs set status = 'review', approved_version = null, approved_at = null where id = p_song;
  insert into updates (song_id, from_client, body) values (p_song, true, 'Took back the approval.');
end $$;

create or replace function request_changes(p_song uuid, p_version uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  if not can_see_project((select project_id from songs where id = p_song)) then raise exception 'not allowed'; end if;
  select label into v_label from versions where id = p_version;
  update songs set status = 'changes', approved_version = null, approved_at = null where id = p_song;
  insert into updates (song_id, from_client, body) values (p_song, true, 'Requested changes on ' || coalesce(v_label, 'the mix') || '.');
end $$;

-- ---------- mix files (private storage) ----------
insert into storage.buckets (id, name, public) values ('mixes', 'mixes', false)
on conflict (id) do nothing;

drop policy if exists mixes_read on storage.objects;
create policy mixes_read on storage.objects for select
  using (bucket_id = 'mixes' and can_see_project(((storage.foldername(name))[1])::uuid));
drop policy if exists mixes_write on storage.objects;
create policy mixes_write on storage.objects for insert
  with check (bucket_id = 'mixes' and is_engineer());
drop policy if exists mixes_delete on storage.objects;
create policy mixes_delete on storage.objects for delete
  using (bucket_id = 'mixes' and is_engineer());

-- ---------- who you are ----------
-- Replace with the email you sign in with:
insert into app_config (key, value) values ('engineer_email', 'me@musicbyac.us')
on conflict (key) do update set value = excluded.value;
