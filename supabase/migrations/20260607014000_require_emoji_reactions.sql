delete from public.admin_announcement_reactions
where trim(emoji) !~ '[^[:ascii:]]'
  or trim(emoji) ~ '[[:alpha:][:digit:]]';

alter table public.admin_announcement_reactions
  drop constraint if exists admin_announcement_reactions_emoji_check;

alter table public.admin_announcement_reactions
  add constraint admin_announcement_reactions_emoji_check
  check (
    char_length(trim(emoji)) between 1 and 32
    and trim(emoji) ~ '[^[:ascii:]]'
    and trim(emoji) !~ '[[:alpha:][:digit:]]'
  );

drop policy if exists "users create own announcement reactions" on public.admin_announcement_reactions;

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

drop policy if exists "users update own announcement reactions" on public.admin_announcement_reactions;

create policy "users update own announcement reactions" on public.admin_announcement_reactions
  for update to authenticated using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and char_length(trim(emoji)) between 1 and 32
    and trim(emoji) ~ '[^[:ascii:]]'
    and trim(emoji) !~ '[[:alpha:][:digit:]]'
  );

notify pgrst, 'reload schema';
