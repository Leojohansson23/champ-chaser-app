create or replace function public.tournament_lock_time()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select timestamptz '2026-06-10 23:59:00+02'
$$;

drop policy if exists "users insert own predictions before lock" on public.predictions;
drop policy if exists "users update own predictions before lock" on public.predictions;

create policy "users insert own predictions before lock" on public.predictions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and now() < public.tournament_lock_time()
  );

create policy "users update own predictions before lock" on public.predictions
  for update to authenticated
  using (
    auth.uid() = user_id
    and now() < public.tournament_lock_time()
  )
  with check (
    auth.uid() = user_id
    and now() < public.tournament_lock_time()
  );

notify pgrst, 'reload schema';
