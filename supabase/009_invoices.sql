-- CTRL ROOM update: invoices on projects (works with Invoice2go links), optional "locked until paid".
-- Run once in Supabase: SQL Editor › + › Create a new snippet › paste › Run.

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  number text,
  amount numeric,
  currency text not null default 'USD',
  due_date date,
  url text,
  note text,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'void')),
  visible boolean not null default false, -- the client only sees it when you choose to show it
  lock boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
alter table invoices add column if not exists visible boolean not null default false;
create index if not exists invoices_project on invoices(project_id);
alter table invoices enable row level security;
drop policy if exists inv_eng on invoices;
create policy inv_eng on invoices for all using (is_engineer()) with check (is_engineer());
drop policy if exists inv_sel on invoices;
create policy inv_sel on invoices for select using (can_see_project(project_id) and visible and status <> 'void');

-- a project is locked while it has an unpaid invoice marked "lock until paid"
create or replace function project_locked(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from invoices i where i.project_id = pid and i.lock and i.status = 'unpaid');
$$;

-- clients can't stream a locked project's mixes (the engineer always can)
drop policy if exists mixes_read on storage.objects;
create policy mixes_read on storage.objects for select using (
  bucket_id = 'mixes'
  and can_see_project(((storage.foldername(name))[1])::uuid)
  and (is_engineer() or not project_locked(((storage.foldername(name))[1])::uuid))
);
