-- Ctrl Room update: share links and artist profiles.
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.
-- (If you haven't yet, run 002_file_format.sql and 003_covers.sql first.)

-- share links
alter table projects add column if not exists share_token text unique;
alter table projects add column if not exists sharing boolean not null default true;
alter table songs add column if not exists share_token text unique;
alter table songs add column if not exists sharing boolean not null default true;

-- artist profiles (one per artist name)
create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text,
  spotify_url text,
  spotify_id text,
  image_url text,
  header_url text,
  bio text,
  genres text,
  followers int,
  listeners text,
  accent text,
  links jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create unique index if not exists artists_name_lower on artists (lower(name));
alter table artists enable row level security;
drop policy if exists ar_sel on artists;
create policy ar_sel on artists for select using (
  is_engineer() or exists (
    select 1 from projects p
    where lower(p.artist) = lower(artists.name)
      and lower(coalesce(p.client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);
-- edits go through the app's server (it checks who you are), so no direct write policies.

-- public bucket for artist photos and headers (anyone can view; only the app's server can upload)
insert into storage.buckets (id, name, public) values ('art', 'art', true) on conflict (id) do update set public = true;
