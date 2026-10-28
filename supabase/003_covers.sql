-- Ctrl Room update: your own cover images for projects and songs.
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.
alter table projects add column if not exists cover_path text;
alter table songs add column if not exists cover_path text;
