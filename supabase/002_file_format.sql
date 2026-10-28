-- Ctrl Room update: remember each mix file's original format.
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.
alter table versions add column if not exists file_name text;
alter table versions add column if not exists file_size bigint;
alter table versions add column if not exists file_format text;
alter table versions add column if not exists sample_rate int;
alter table versions add column if not exists bit_depth int;
alter table versions add column if not exists lossless boolean;
