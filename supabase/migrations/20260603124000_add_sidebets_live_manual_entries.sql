create table public.sidebet_live_manual_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('top_scorers', 'top_assists', 'red_cards')),
  label text not null,
  value int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sidebet_live_manual_entries_category_idx
  on public.sidebet_live_manual_entries(category, value desc);

alter table public.sidebet_live_manual_entries enable row level security;

create policy "manual live entries viewable by authenticated"
  on public.sidebet_live_manual_entries
  for select
  to authenticated
  using (true);

create policy "admins manage manual live entries"
  on public.sidebet_live_manual_entries
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.set_sidebet_live_manual_entries_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sidebet_live_manual_entries_set_updated_at
  before update on public.sidebet_live_manual_entries
  for each row execute function public.set_sidebet_live_manual_entries_updated_at();

alter publication supabase_realtime add table public.sidebet_live_manual_entries;
