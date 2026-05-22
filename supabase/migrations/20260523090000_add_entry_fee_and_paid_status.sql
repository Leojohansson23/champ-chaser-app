alter table public.profiles
  add column if not exists is_paid boolean not null default false;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'settings viewable by authenticated'
  ) then
    create policy "settings viewable by authenticated" on public.app_settings
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'admins manage settings'
  ) then
    create policy "admins manage settings" on public.app_settings
      for all to authenticated using (public.has_role(auth.uid(), 'admin'))
      with check (public.has_role(auth.uid(), 'admin'));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'admins update profiles'
  ) then
    create policy "admins update profiles" on public.profiles
      for update to authenticated using (public.has_role(auth.uid(), 'admin'))
      with check (public.has_role(auth.uid(), 'admin'));
  end if;
end $$;

insert into public.app_settings (key, value)
values ('entry_fee', '{"amount": 100}'::jsonb)
on conflict (key) do nothing;
