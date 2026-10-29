-- CTRL ROOM update: engineer profiles and credits ("Mixed & mastered by …" with a blue check once verified).
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.
create table if not exists engineer_profiles (
  email text primary key,
  full_name text,
  display_name text,
  credit text,
  roles text[] not null default '{}',
  photo_url text,
  bio text,
  verified boolean not null default false,
  is_main boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table engineer_profiles enable row level security;
drop policy if exists ep_read on engineer_profiles;
create policy ep_read on engineer_profiles for select using (auth.role() = 'authenticated');
-- writes only happen through CTRL ROOM's server (it checks you're an engineer and whether your email is verified)
alter table engineer_profiles add column if not exists instagram text;
