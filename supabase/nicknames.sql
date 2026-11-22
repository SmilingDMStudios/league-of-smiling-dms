-- The League of Smiling DMs: unique nicknames
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Nicknames match ignoring case, spaces and . _ ' - so "Smiling DM" and "smiling_dm" count as the same name.

create or replace function public.nick_key(n text) returns text
language sql immutable as $$ select regexp_replace(lower(coalesce(n, '')), '[[:space:]._''-]+', '', 'g') $$;

create table if not exists public.nicknames (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24 and nickname !~ '[<>[:cntrl:]]'),
  key text generated always as (public.nick_key(nickname)) stored,
  updated_at timestamptz not null default now()
);
create unique index if not exists nicknames_key_unique on public.nicknames (key);

-- Names nobody but a moderator can take. "contains" blocks any nickname with that text inside it.
create table if not exists public.reserved_names (key text primary key, contains boolean not null default false);
insert into public.reserved_names (key, contains) values
  ('smilingdm', true), ('leagueofsmilingdms', true), ('grinninggentleman', true),
  ('admin', true), ('moderator', true), ('official', true),
  ('mod', false), ('staff', false), ('support', false), ('anonymousdm', false), ('wizardsofthecoast', true)
on conflict (key) do nothing;

create or replace function public.nickname_allowed(n text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
      or not exists (select 1 from reserved_names r
                     where (r.contains and position(r.key in nick_key(n)) > 0) or (not r.contains and r.key = nick_key(n)))
$$;

-- Lets the sign-in form say "taken" or "reserved" before sending the email.
create or replace function public.nickname_status(n text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when char_length(trim(n)) < 2 then 'short'
    when not nickname_allowed(n) then 'reserved'
    when exists (select 1 from nicknames where key = nick_key(n) and user_id is distinct from auth.uid()) then 'taken'
    else 'ok' end
$$;

alter table public.nicknames enable row level security;
alter table public.reserved_names enable row level security;

drop policy if exists "nicknames are public" on public.nicknames;
create policy "nicknames are public" on public.nicknames for select using (true);
drop policy if exists "claim your nickname" on public.nicknames;
create policy "claim your nickname" on public.nicknames for insert to authenticated
  with check (user_id = auth.uid() and public.nickname_allowed(nickname));
drop policy if exists "change your nickname" on public.nicknames;
create policy "change your nickname" on public.nicknames for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.nickname_allowed(nickname));

grant select on public.nicknames to anon, authenticated;
grant insert, update on public.nicknames to authenticated;
revoke all on public.reserved_names from anon, authenticated;
grant execute on function public.nickname_status(text) to anon, authenticated;
