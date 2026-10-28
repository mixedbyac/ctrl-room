-- CTRL ROOM update: downloads stay off until the engineer switches them on for a project.
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.
alter table projects add column if not exists allow_download boolean not null default false;

-- invoices: attach a PDF receipt once it's paid, for the client's records
alter table invoices add column if not exists receipt_path text;
