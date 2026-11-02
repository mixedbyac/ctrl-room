-- CTRL ROOM update: your own order for a song's versions (drag them around; the top one is the active version).
alter table versions add column if not exists position int;
