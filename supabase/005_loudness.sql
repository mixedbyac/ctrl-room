-- Ctrl Room update: LUFS loudness per mix.
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.
alter table versions add column if not exists lufs real;
