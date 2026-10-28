-- Ctrl Room update: archive sends in the Portal inbox.
alter table uploads add column if not exists archived boolean not null default false;
