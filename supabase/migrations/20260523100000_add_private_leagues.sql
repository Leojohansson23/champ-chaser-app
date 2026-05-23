create table if not exists public.private_leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 50),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.private_league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.private_leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create index if not exists private_league_members_user_id_idx
  on public.private_league_members(user_id);

create index if not exists private_league_members_league_id_idx
  on public.private_league_members(league_id);

alter table public.private_leagues enable row level security;
alter table public.private_league_members enable row level security;

create or replace function public.is_private_league_member(_league_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.private_league_members
    where league_id = _league_id
      and user_id = _user_id
  )
$$;

create or replace function public.add_private_league_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.private_league_members (league_id, user_id)
  values (new.id, new.owner_id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists private_leagues_add_owner_member on public.private_leagues;
create trigger private_leagues_add_owner_member
  after insert on public.private_leagues
  for each row execute function public.add_private_league_owner_as_member();

create or replace function public.join_private_league(_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  league_id uuid;
begin
  select id into league_id
  from public.private_leagues
  where invite_code = upper(trim(_invite_code));

  if league_id is null then
    raise exception 'Ligakoden hittades inte.';
  end if;

  insert into public.private_league_members (league_id, user_id)
  values (league_id, auth.uid())
  on conflict do nothing;

  return league_id;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_leagues'
      and policyname = 'members view private leagues'
  ) then
    create policy "members view private leagues" on public.private_leagues
      for select to authenticated
      using (public.is_private_league_member(id, auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_leagues'
      and policyname = 'owners view private leagues'
  ) then
    create policy "owners view private leagues" on public.private_leagues
      for select to authenticated
      using (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_leagues'
      and policyname = 'users create private leagues'
  ) then
    create policy "users create private leagues" on public.private_leagues
      for insert to authenticated
      with check (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_leagues'
      and policyname = 'owners update private leagues'
  ) then
    create policy "owners update private leagues" on public.private_leagues
      for update to authenticated
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_leagues'
      and policyname = 'owners delete private leagues'
  ) then
    create policy "owners delete private leagues" on public.private_leagues
      for delete to authenticated
      using (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_leagues'
      and policyname = 'admins delete private leagues'
  ) then
    create policy "admins delete private leagues" on public.private_leagues
      for delete to authenticated
      using (public.has_role(auth.uid(), 'admin'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'private_league_members'
      and policyname = 'members view league memberships'
  ) then
    create policy "members view league memberships" on public.private_league_members
      for select to authenticated
      using (public.is_private_league_member(league_id, auth.uid()));
  end if;

  drop policy if exists "members leave private leagues" on public.private_league_members;

  create policy "members leave private leagues" on public.private_league_members
    for delete to authenticated
    using (
      user_id = auth.uid()
      or public.has_role(auth.uid(), 'admin')
      or exists (
        select 1
        from public.private_leagues
        where id = league_id
          and owner_id = auth.uid()
      )
    );
end $$;

grant execute on function public.join_private_league(text) to authenticated;

notify pgrst, 'reload schema';
