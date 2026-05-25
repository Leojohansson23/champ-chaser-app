-- Cleanup test seed data created by seed_test_users_20_and_matches_10.sql
-- Removes test users (auth + profile related data via cascade) and TEST matches.

begin;

-- Remove all TEST matches (predictions for these matches are deleted via FK cascade)
delete from public.matches
where group_name = 'TEST';

-- Remove test users from auth; related rows are removed via on delete cascade
-- profiles, user_roles, predictions, side_bet_answers, comments, private league memberships, etc.
delete from auth.users
where email like 'test.user.%@vm-tipset.local';

commit;

-- Optional verification
-- select count(*) as users_left from auth.users where email like 'test.user.%@vm-tipset.local';
-- select count(*) as matches_left from public.matches where group_name = 'TEST';
