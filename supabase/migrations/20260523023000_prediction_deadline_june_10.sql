create or replace function public.tournament_lock_time()
returns timestamptz language sql stable security definer set search_path = public as $$
  select timestamptz '2026-06-10 23:59:00+02'
$$;

drop policy if exists "users insert own predictions before lock" on public.predictions;
drop policy if exists "users update own predictions before lock" on public.predictions;

create policy "users insert own predictions before lock" on public.predictions
  for insert to authenticated with check (
    auth.uid() = user_id
    and now() < public.tournament_lock_time()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.home_score is null
        and m.away_score is null
    )
  );

create policy "users update own predictions before lock" on public.predictions
  for update to authenticated using (
    auth.uid() = user_id
    and now() < public.tournament_lock_time()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.home_score is null
        and m.away_score is null
    )
  )
  with check (
    auth.uid() = user_id
    and now() < public.tournament_lock_time()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.home_score is null
        and m.away_score is null
    )
  );
