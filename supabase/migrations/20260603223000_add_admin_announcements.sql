create table public.admin_announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  body text not null check (char_length(trim(body)) between 1 and 600),
  tone text not null default 'info' check (tone in ('info', 'fun', 'urgent')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_announcements enable row level security;

create policy "active announcements viewable by authenticated" on public.admin_announcements
  for select to authenticated using (is_active or public.has_role(auth.uid(), 'admin'));

create policy "admins manage announcements" on public.admin_announcements
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

alter publication supabase_realtime add table public.admin_announcements;
