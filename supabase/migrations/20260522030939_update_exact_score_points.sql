create or replace function public.recompute_points_for_match(_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m record;
  actual_sign text;
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
    when p.predicted_home = m.home_score and p.predicted_away = m.away_score then 3
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

drop view if exists public.leaderboard;
create view public.leaderboard
with (security_invoker = true) as
select
  pr.id as user_id,
  pr.username,
  coalesce(sum(p.points), 0)::int as total_points,
  count(p.id) filter (where p.points = 3)::int as exact_count,
  count(p.id) filter (where p.points = 1)::int as sign_count
from public.profiles pr
left join public.predictions p on p.user_id = pr.id
group by pr.id, pr.username;

grant select on public.leaderboard to authenticated;

do $$
declare
  match_row record;
begin
  for match_row in
    select id from public.matches
    where home_score is not null and away_score is not null
  loop
    perform public.recompute_points_for_match(match_row.id);
  end loop;
end;
$$;
