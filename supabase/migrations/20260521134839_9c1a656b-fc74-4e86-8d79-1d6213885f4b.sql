
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Matches
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  home_team text not null,
  away_team text not null,
  kickoff timestamptz not null,
  home_score int,
  away_score int,
  created_at timestamptz not null default now()
);

-- Predictions
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  predicted_home int not null,
  predicted_away int not null,
  points int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

-- Helper: lock time = earliest match kickoff
create or replace function public.tournament_lock_time()
returns timestamptz language sql stable security definer set search_path = public as $$
  select min(kickoff) from public.matches
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

-- Profiles policies
create policy "profiles viewable by authenticated" on public.profiles
  for select to authenticated using (true);
create policy "users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);
create policy "users insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- user_roles policies
create policy "roles viewable by authenticated" on public.user_roles
  for select to authenticated using (true);
create policy "admins manage roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Matches policies
create policy "matches viewable by authenticated" on public.matches
  for select to authenticated using (true);
create policy "admins insert matches" on public.matches
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "admins update matches" on public.matches
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete matches" on public.matches
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Predictions policies
create policy "predictions viewable by authenticated" on public.predictions
  for select to authenticated using (true);
create policy "users insert own predictions before lock" on public.predictions
  for insert to authenticated with check (
    auth.uid() = user_id
    and (public.tournament_lock_time() is null or now() < public.tournament_lock_time())
  );
create policy "users update own predictions before lock" on public.predictions
  for update to authenticated using (
    auth.uid() = user_id
    and (public.tournament_lock_time() is null or now() < public.tournament_lock_time())
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at trigger for predictions
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger predictions_set_updated
  before update on public.predictions
  for each row execute function public.set_updated_at();

-- Recompute points for a match
create or replace function public.recompute_points_for_match(_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m record;
  actual_sign text;
  pred_sign text;
  pts int;
begin
  select * into m from public.matches where id = _match_id;
  if m.home_score is null or m.away_score is null then
    update public.predictions set points = 0 where match_id = _match_id;
    return;
  end if;

  actual_sign := case
    when m.home_score > m.away_score then '1'
    when m.home_score < m.away_score then '2'
    else 'X'
  end;

  update public.predictions p
  set points = case
    when p.predicted_home = m.home_score and p.predicted_away = m.away_score then 2
    when (
      case
        when p.predicted_home > p.predicted_away then '1'
        when p.predicted_home < p.predicted_away then '2'
        else 'X'
      end
    ) = actual_sign then 1
    else 0
  end
  where p.match_id = _match_id;
end;
$$;

-- Trigger: recompute on match result change
create or replace function public.matches_after_score_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.home_score is distinct from old.home_score)
     or (new.away_score is distinct from old.away_score) then
    perform public.recompute_points_for_match(new.id);
  end if;
  return new;
end;
$$;

create trigger matches_score_recompute
  after update on public.matches
  for each row execute function public.matches_after_score_update();

-- Leaderboard view
create or replace view public.leaderboard as
select
  pr.id as user_id,
  pr.username,
  coalesce(sum(p.points), 0)::int as total_points,
  count(p.id) filter (where p.points = 2)::int as exact_count,
  count(p.id) filter (where p.points = 1)::int as sign_count
from public.profiles pr
left join public.predictions p on p.user_id = pr.id
group by pr.id, pr.username;

grant select on public.leaderboard to authenticated;

-- Realtime for leaderboard updates
alter publication supabase_realtime add table public.predictions;
alter publication supabase_realtime add table public.matches;
