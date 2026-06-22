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
