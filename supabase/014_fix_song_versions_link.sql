-- CTRL ROOM fix: the "active version" link made song/version lookups ambiguous. This keeps the column but
-- removes the extra database link, so every request works no matter how it's written.
alter table songs drop constraint if exists songs_active_version_fkey;
