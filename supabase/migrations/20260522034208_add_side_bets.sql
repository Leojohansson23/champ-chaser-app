create table public.side_bets (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options text[] not null,
  points int not null default 1,
  deadline timestamptz not null,
  correct_answer text,
  created_at timestamptz not null default now()
);

create table public.side_bet_answers (
  id uuid primary key default gen_random_uuid(),
  side_bet_id uuid not null references public.side_bets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer text not null,
  points int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (side_bet_id, user_id)
);

alter table public.side_bets enable row level security;
alter table public.side_bet_answers enable row level security;

create policy "side bets viewable by authenticated" on public.side_bets
  for select to authenticated using (true);
create policy "admins manage side bets" on public.side_bets
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "side bet answers viewable by authenticated" on public.side_bet_answers
  for select to authenticated using (true);
create policy "users answer open side bets" on public.side_bet_answers
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.side_bets sb
      where sb.id = side_bet_id
      and now() < sb.deadline
      and sb.correct_answer is null
    )
  );
create policy "users update own open side bet answers" on public.side_bet_answers
  for update to authenticated using (
    auth.uid() = user_id
    and exists (
      select 1 from public.side_bets sb
      where sb.id = side_bet_id
      and now() < sb.deadline
      and sb.correct_answer is null
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.side_bets sb
      where sb.id = side_bet_id
      and now() < sb.deadline
      and sb.correct_answer is null
    )
  );
create policy "admins manage side bet answers" on public.side_bet_answers
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.set_side_bet_answer_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bet record;
begin
  select points, correct_answer into bet from public.side_bets where id = new.side_bet_id;

  if bet.correct_answer is not null and new.answer = bet.correct_answer then
    new.points := bet.points;
  else
    new.points := 0;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger side_bet_answers_set_points
  before insert or update on public.side_bet_answers
  for each row execute function public.set_side_bet_answer_points();

create or replace function public.recompute_side_bet_points(_side_bet_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.side_bet_answers a
  set points = case
    when a.answer = sb.correct_answer then sb.points
    else 0
  end
  from public.side_bets sb
  where sb.id = a.side_bet_id
    and sb.id = _side_bet_id;
end;
$$;

create or replace function public.side_bets_after_correct_answer_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.correct_answer is distinct from old.correct_answer
     or new.points is distinct from old.points then
    perform public.recompute_side_bet_points(new.id);
  end if;
  return new;
end;
$$;

create trigger side_bets_recompute_answers
  after update on public.side_bets
  for each row execute function public.side_bets_after_correct_answer_update();

drop view if exists public.leaderboard;
create view public.leaderboard
with (security_invoker = true) as
with prediction_points as (
  select
    user_id,
    coalesce(sum(points), 0)::int as match_points,
    count(id) filter (where points = 3)::int as exact_count,
    count(id) filter (where points = 1)::int as sign_count
  from public.predictions
  group by user_id
),
side_points as (
  select
    user_id,
    coalesce(sum(points), 0)::int as side_points
  from public.side_bet_answers
  group by user_id
)
select
  pr.id as user_id,
  pr.username,
  (coalesce(pp.match_points, 0) + coalesce(sp.side_points, 0))::int as total_points,
  coalesce(pp.exact_count, 0)::int as exact_count,
  coalesce(pp.sign_count, 0)::int as sign_count
from public.profiles pr
left join prediction_points pp on pp.user_id = pr.id
left join side_points sp on sp.user_id = pr.id;

grant select on public.leaderboard to authenticated;

alter publication supabase_realtime add table public.side_bets;
alter publication supabase_realtime add table public.side_bet_answers;
