-- CTRL ROOM update: threaded comments, time ranges, emoji reactions, and (optional) comments from share links.
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.

alter table notes add column if not exists parent_id uuid references notes(id) on delete cascade;
alter table notes add column if not exists t_end real;
alter table notes add column if not exists guest boolean not null default false;
create index if not exists notes_parent on notes(parent_id);

create table if not exists note_reactions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 16),
  who text not null,
  created_at timestamptz not null default now(),
  unique (note_id, emoji, who)
);
alter table note_reactions enable row level security;

create or replace function note_project(nid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select s.project_id from notes n join songs s on s.id = n.song_id where n.id = nid;
$$;

drop policy if exists nr_sel on note_reactions;
create policy nr_sel on note_reactions for select using (can_see_project(note_project(note_id)));
drop policy if exists nr_ins on note_reactions;
create policy nr_ins on note_reactions for insert with check (
  can_see_project(note_project(note_id)) and who = lower(coalesce(auth.jwt() ->> 'email', ''))
);
drop policy if exists nr_del on note_reactions;
create policy nr_del on note_reactions for delete using (is_engineer() or who = lower(coalesce(auth.jwt() ->> 'email', '')));

-- people can delete their own comments; the engineer can delete any
drop policy if exists n_del on notes;
create policy n_del on notes for delete using (is_engineer() or lower(coalesce(author_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')));
