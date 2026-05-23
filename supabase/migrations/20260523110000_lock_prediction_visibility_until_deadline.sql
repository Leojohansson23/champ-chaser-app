drop policy if exists "predictions viewable by authenticated" on public.predictions;

create policy "predictions viewable by owner admin or after lock" on public.predictions
  for select to authenticated
  using (
    auth.uid() = user_id
    or public.has_role(auth.uid(), 'admin')
    or now() >= public.tournament_lock_time()
  );

notify pgrst, 'reload schema';
