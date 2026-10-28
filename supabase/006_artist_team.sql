-- Ctrl Room update: artist teams.
-- Anyone on an artist's team can open that artist's projects and add to them from the Portal.
-- Nobody else sees them. Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.

create table if not exists artist_members (
  id uuid primary key default gen_random_uuid(),
  artist text not null,
  email text not null,
  role text,
  added_at timestamptz not null default now()
);
create unique index if not exists artist_members_unique on artist_members (lower(artist), lower(email));
alter table artist_members enable row level security;
drop policy if exists am_eng on artist_members;
create policy am_eng on artist_members for all using (is_engineer()) with check (is_engineer());
drop policy if exists am_self on artist_members;
create policy am_self on artist_members for select using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- who can see a project: the engineer, the project's client email, or anyone on that artist's team
create or replace function can_see_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_engineer() or exists (
    select 1 from projects p
    where p.id = pid
      and (
        (p.client_email is not null and lower(p.client_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
        or exists (
          select 1 from artist_members m
          where lower(m.artist) = lower(p.artist)
            and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      )
  );
$$;

-- team members can see the artist's page too
do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'artists') then
    drop policy if exists ar_sel on artists;
    create policy ar_sel on artists for select using (
      is_engineer()
      or exists (select 1 from projects p where lower(p.artist) = lower(artists.name)
                 and lower(coalesce(p.client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', '')))
      or exists (select 1 from artist_members m where lower(m.artist) = lower(artists.name)
                 and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    );
  end if;
end $$;
