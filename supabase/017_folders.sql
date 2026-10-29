-- CTRL ROOM update: folders to organize projects in the sidebar (engineer only; clients just see their projects).
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.
create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table folders enable row level security;
drop policy if exists folders_eng on folders;
create policy folders_eng on folders for all using (is_engineer()) with check (is_engineer());
alter table projects add column if not exists folder_id uuid references folders(id) on delete set null;
