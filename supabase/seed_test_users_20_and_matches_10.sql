-- Seed for local/testing environments
-- Creates 20 test users, 10 fake matches, and predictions for all test users.
-- Run in Supabase SQL Editor (service role) as a one-off script.

begin;

-- 1) Cleanup old test data (safe to re-run)
with test_users as (
  select id
  from auth.users
  where email like 'test.user.%@vm-tipset.local'
)
delete from public.predictions p
using test_users tu
where p.user_id = tu.id;

delete from public.matches
where group_name = 'TEST';

delete from public.profiles
where id in (
  select id
  from auth.users
  where email like 'test.user.%@vm-tipset.local'
);

delete from auth.users
where email like 'test.user.%@vm-tipset.local';

-- 2) Create 20 auth users (trigger will auto-create profiles + user_roles)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid as instance_id,
  gen_random_uuid() as id,
  'authenticated' as aud,
  'authenticated' as role,
  format('test.user.%s@vm-tipset.local', lpad(gs::text, 2, '0')) as email,
  '$2a$10$8A4Q8kC4PVrM53G5R4QmJuDE3d3JQQQEUWQ5xA8vYV6N2Q6sA9Kti' as encrypted_password,
  now() as email_confirmed_at,
  '{"provider":"email","providers":["email"]}'::jsonb as raw_app_meta_data,
  jsonb_build_object('username', format('Testspelare %s', lpad(gs::text, 2, '0'))) as raw_user_meta_data,
  now() as created_at,
  now() as updated_at,
  '' as confirmation_token,
  '' as email_change,
  '' as email_change_token_new,
  '' as recovery_token
from generate_series(1, 20) as gs;

-- 3) Create 10 fake matches in the near future (no results yet)
insert into public.matches (group_name, home_team, away_team, kickoff)
values
  ('TEST', 'Testland A1', 'Testland B1', now() + interval '1 day' + interval '18 hours'),
  ('TEST', 'Testland A2', 'Testland B2', now() + interval '1 day' + interval '21 hours'),
  ('TEST', 'Testland A3', 'Testland B3', now() + interval '2 day' + interval '18 hours'),
  ('TEST', 'Testland A4', 'Testland B4', now() + interval '2 day' + interval '21 hours'),
  ('TEST', 'Testland A5', 'Testland B5', now() + interval '3 day' + interval '18 hours'),
  ('TEST', 'Testland A6', 'Testland B6', now() + interval '3 day' + interval '21 hours'),
  ('TEST', 'Testland A7', 'Testland B7', now() + interval '4 day' + interval '18 hours'),
  ('TEST', 'Testland A8', 'Testland B8', now() + interval '4 day' + interval '21 hours'),
  ('TEST', 'Testland A9', 'Testland B9', now() + interval '5 day' + interval '18 hours'),
  ('TEST', 'Testland A10', 'Testland B10', now() + interval '5 day' + interval '21 hours');

-- 4) Every test user predicts all 10 test matches
insert into public.predictions (user_id, match_id, predicted_home, predicted_away)
select
  u.id as user_id,
  m.id as match_id,
  floor(random() * 5)::int as predicted_home,
  floor(random() * 5)::int as predicted_away
from auth.users u
cross join public.matches m
where u.email like 'test.user.%@vm-tipset.local'
  and m.group_name = 'TEST';

commit;

-- Optional check
-- select count(*) as users from auth.users where email like 'test.user.%@vm-tipset.local';
-- select count(*) as matches from public.matches where group_name = 'TEST';
-- select count(*) as predictions from public.predictions p join public.matches m on m.id = p.match_id where m.group_name = 'TEST';
