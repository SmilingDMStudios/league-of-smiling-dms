-- The League of Smiling DMs: Monster Archive
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.archive (
  id text primary key,
  body jsonb not null check (octet_length(body::text) < 200000),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated bigint not null,
  created_at timestamptz not null default now()
);

-- People who can delete anyone's archive entry (moderators).
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.archive enable row level security;
alter table public.admins enable row level security;

-- Anyone can browse the archive.
drop policy if exists "archive is public" on public.archive;
create policy "archive is public" on public.archive for select using (true);

-- Signed-in users add entries as themselves.
drop policy if exists "add your own" on public.archive;
create policy "add your own" on public.archive for insert to authenticated
  with check (author_id = auth.uid());

-- Only the author can edit an entry.
drop policy if exists "edit your own" on public.archive;
create policy "edit your own" on public.archive for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- The author or a moderator can delete an entry.
drop policy if exists "delete own or moderate" on public.archive;
create policy "delete own or moderate" on public.archive for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admins visible to self" on public.admins;
create policy "admins visible to self" on public.admins for select to authenticated using (user_id = auth.uid());

-- To make yourself a moderator: sign in on the site once, then run
--   insert into public.admins (user_id) select id from auth.users where email = 'YOUR-EMAIL';
