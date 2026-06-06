create table public.admin_announcement_reactions (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.admin_announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (
    char_length(trim(emoji)) between 1 and 32
    and trim(emoji) ~ '[^[:ascii:]]'
    and trim(emoji) !~ '[[:alpha:][:digit:]]'
  ),
  created_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

alter table public.admin_announcement_reactions enable row level security;

create policy "announcement reactions viewable by authenticated" on public.admin_announcement_reactions
  for select to authenticated using (true);

create policy "users create own announcement reactions" on public.admin_announcement_reactions
  for insert to authenticated with check (
    auth.uid() = user_id
    and char_length(trim(emoji)) between 1 and 32
    and trim(emoji) ~ '[^[:ascii:]]'
    and trim(emoji) !~ '[[:alpha:][:digit:]]'
    and exists (
      select 1
      from public.admin_announcements announcement
      where announcement.id = announcement_id
        and announcement.is_active = true
    )
  );

create policy "users delete own announcement reactions" on public.admin_announcement_reactions
  for delete to authenticated using (auth.uid() = user_id);

create policy "users update own announcement reactions" on public.admin_announcement_reactions
  for update to authenticated using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and char_length(trim(emoji)) between 1 and 32
    and trim(emoji) ~ '[^[:ascii:]]'
    and trim(emoji) !~ '[[:alpha:][:digit:]]'
  );

create policy "admins delete announcement reactions" on public.admin_announcement_reactions
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

alter publication supabase_realtime add table public.admin_announcement_reactions;
