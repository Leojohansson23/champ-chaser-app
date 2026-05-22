create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "settings viewable by authenticated" on public.app_settings
  for select to authenticated using (true);

create policy "admins manage settings" on public.app_settings
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

insert into public.app_settings (key, value)
values ('prize_pot', '{"amount": 0}'::jsonb)
on conflict (key) do nothing;

alter publication supabase_realtime add table public.app_settings;
