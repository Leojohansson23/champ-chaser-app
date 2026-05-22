create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "comments viewable by authenticated" on public.comments
  for select to authenticated using (true);

create policy "users create own comments" on public.comments
  for insert to authenticated with check (
    auth.uid() = user_id
    and char_length(trim(body)) between 1 and 300
  );

create policy "users delete own comments" on public.comments
  for delete to authenticated using (auth.uid() = user_id);

create policy "admins delete comments" on public.comments
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

alter publication supabase_realtime add table public.comments;
