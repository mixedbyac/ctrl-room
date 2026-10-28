-- CTRL ROOM update: "active version" per song (which mix is the current one) and artist-team admins.
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.
alter table songs add column if not exists active_version uuid references versions(id) on delete set null;
-- Admins are artist_members with role 'Admin'. Their edits go through the app's server, which checks the role.
