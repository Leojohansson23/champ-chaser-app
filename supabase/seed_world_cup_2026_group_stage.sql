-- FIFA World Cup 2026 group stage seed.
-- Source cross-check: FIFA official schedule and WorldCupHub schedule, last checked 2026-05-22.
-- Kickoff times are stored as UTC. Source times were Eastern Time during June 2026 (UTC-4).
-- Run this manually in Supabase SQL editor when you want to populate matches.

insert into public.matches (group_name, home_team, away_team, kickoff)
select v.group_name, v.home_team, v.away_team, v.kickoff::timestamptz
from (values
  ('A', 'Mexico', 'South Africa', '2026-06-11T20:00:00Z'),
  ('A', 'South Korea', 'Czechia', '2026-06-12T03:00:00Z'),
  ('B', 'Canada', 'Bosnia & Herzegovina', '2026-06-12T20:00:00Z'),
  ('D', 'United States', 'Paraguay', '2026-06-13T02:00:00Z'),
  ('B', 'Qatar', 'Switzerland', '2026-06-13T20:00:00Z'),
  ('C', 'Brazil', 'Morocco', '2026-06-13T23:00:00Z'),
  ('E', 'Ivory Coast', 'Ecuador', '2026-06-14T00:00:00Z'),
  ('C', 'Haiti', 'Scotland', '2026-06-14T02:00:00Z'),
  ('F', 'Sweden', 'Tunisia', '2026-06-14T03:00:00Z'),
  ('D', 'Australia', 'Turkiye', '2026-06-14T05:00:00Z'),
  ('E', 'Germany', 'Curacao', '2026-06-14T18:00:00Z'),
  ('F', 'Netherlands', 'Japan', '2026-06-14T21:00:00Z'),
  ('H', 'Spain', 'Cape Verde', '2026-06-15T17:00:00Z'),
  ('G', 'Belgium', 'Egypt', '2026-06-15T20:00:00Z'),
  ('H', 'Saudi Arabia', 'Uruguay', '2026-06-15T23:00:00Z'),
  ('G', 'Iran', 'New Zealand', '2026-06-16T02:00:00Z'),
  ('J', 'Argentina', 'Algeria', '2026-06-16T02:00:00Z'),
  ('J', 'Austria', 'Jordan', '2026-06-16T05:00:00Z'),
  ('K', 'Portugal', 'DR Congo', '2026-06-16T18:00:00Z'),
  ('I', 'France', 'Senegal', '2026-06-16T20:00:00Z'),
  ('L', 'England', 'Croatia', '2026-06-16T21:00:00Z'),
  ('I', 'Iraq', 'Norway', '2026-06-16T23:00:00Z'),
  ('L', 'Ghana', 'Panama', '2026-06-17T00:00:00Z'),
  ('K', 'Uzbekistan', 'Colombia', '2026-06-17T03:00:00Z'),
  ('A', 'Czechia', 'South Africa', '2026-06-18T17:00:00Z'),
  ('B', 'Switzerland', 'Bosnia & Herzegovina', '2026-06-18T20:00:00Z'),
  ('B', 'Canada', 'Qatar', '2026-06-18T23:00:00Z'),
  ('A', 'Mexico', 'South Korea', '2026-06-19T02:00:00Z'),
  ('D', 'United States', 'Australia', '2026-06-19T20:00:00Z'),
  ('C', 'Scotland', 'Morocco', '2026-06-19T23:00:00Z'),
  ('E', 'Ecuador', 'Curacao', '2026-06-20T01:00:00Z'),
  ('C', 'Brazil', 'Haiti', '2026-06-20T02:00:00Z'),
  ('D', 'Turkiye', 'Paraguay', '2026-06-20T02:00:00Z'),
  ('F', 'Netherlands', 'Sweden', '2026-06-20T18:00:00Z'),
  ('E', 'Germany', 'Ivory Coast', '2026-06-20T21:00:00Z'),
  ('F', 'Tunisia', 'Japan', '2026-06-21T02:00:00Z'),
  ('G', 'New Zealand', 'Egypt', '2026-06-21T02:00:00Z'),
  ('H', 'Spain', 'Saudi Arabia', '2026-06-21T17:00:00Z'),
  ('G', 'Belgium', 'Iran', '2026-06-21T20:00:00Z'),
  ('H', 'Uruguay', 'Cape Verde', '2026-06-21T23:00:00Z'),
  ('J', 'Argentina', 'Austria', '2026-06-22T18:00:00Z'),
  ('I', 'France', 'Iraq', '2026-06-22T22:00:00Z'),
  ('L', 'Panama', 'Croatia', '2026-06-23T00:00:00Z'),
  ('I', 'Norway', 'Senegal', '2026-06-23T01:00:00Z'),
  ('K', 'Colombia', 'DR Congo', '2026-06-23T03:00:00Z'),
  ('K', 'Portugal', 'Uzbekistan', '2026-06-23T18:00:00Z'),
  ('L', 'England', 'Ghana', '2026-06-23T21:00:00Z'),
  ('J', 'Jordan', 'Algeria', '2026-06-24T00:00:00Z'),
  ('B', 'Switzerland', 'Canada', '2026-06-24T20:00:00Z'),
  ('B', 'Bosnia & Herzegovina', 'Qatar', '2026-06-24T20:00:00Z'),
  ('C', 'Scotland', 'Brazil', '2026-06-24T23:00:00Z'),
  ('C', 'Morocco', 'Haiti', '2026-06-24T23:00:00Z'),
  ('F', 'Japan', 'Sweden', '2026-06-25T00:00:00Z'),
  ('F', 'Tunisia', 'Netherlands', '2026-06-25T00:00:00Z'),
  ('A', 'Czechia', 'Mexico', '2026-06-25T02:00:00Z'),
  ('A', 'South Africa', 'South Korea', '2026-06-25T02:00:00Z'),
  ('D', 'Turkiye', 'United States', '2026-06-25T03:00:00Z'),
  ('D', 'Paraguay', 'Australia', '2026-06-25T03:00:00Z'),
  ('E', 'Ecuador', 'Germany', '2026-06-25T21:00:00Z'),
  ('E', 'Curacao', 'Ivory Coast', '2026-06-25T21:00:00Z'),
  ('H', 'Cape Verde', 'Saudi Arabia', '2026-06-26T01:00:00Z'),
  ('H', 'Uruguay', 'Spain', '2026-06-26T01:00:00Z'),
  ('G', 'Egypt', 'Iran', '2026-06-26T04:00:00Z'),
  ('G', 'New Zealand', 'Belgium', '2026-06-26T04:00:00Z'),
  ('I', 'Norway', 'France', '2026-06-26T20:00:00Z'),
  ('I', 'Senegal', 'Iraq', '2026-06-26T20:00:00Z'),
  ('K', 'Colombia', 'Portugal', '2026-06-27T00:30:00Z'),
  ('K', 'DR Congo', 'Uzbekistan', '2026-06-27T00:30:00Z'),
  ('J', 'Algeria', 'Austria', '2026-06-27T03:00:00Z'),
  ('J', 'Jordan', 'Argentina', '2026-06-27T03:00:00Z'),
  ('L', 'Panama', 'England', '2026-06-27T22:00:00Z'),
  ('L', 'Croatia', 'Ghana', '2026-06-27T22:00:00Z')
) as v(group_name, home_team, away_team, kickoff)
where not exists (
  select 1
  from public.matches m
  where m.group_name = v.group_name
    and m.home_team = v.home_team
    and m.away_team = v.away_team
    and m.kickoff = v.kickoff::timestamptz
);
