
drop view if exists public.leaderboard;
create view public.leaderboard
with (security_invoker = true) as
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
