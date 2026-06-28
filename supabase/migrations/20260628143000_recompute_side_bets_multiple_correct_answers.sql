create or replace function public.side_bet_correct_answers(_answer text)
returns text[] language sql immutable as $$
  select coalesce(
    array_agg(public.normalize_side_bet_answer(answer_part))
      filter (where public.normalize_side_bet_answer(answer_part) <> ''),
    '{}'::text[]
  )
  from regexp_split_to_table(coalesce(_answer, ''), E'[,;|\\n\\r]+') as answer_part
$$;

create or replace function public.side_bet_answer_is_correct(_answer text, _correct_answer text)
returns boolean language sql immutable as $$
  select public.normalize_side_bet_answer(_answer) = any(public.side_bet_correct_answers(_correct_answer))
$$;

create or replace function public.set_side_bet_answer_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bet record;
begin
  select points, correct_answer into bet from public.side_bets where id = new.side_bet_id;

  new.answer := trim(new.answer);

  if bet.correct_answer is not null
     and public.side_bet_answer_is_correct(new.answer, bet.correct_answer) then
    new.points := bet.points;
  else
    new.points := 0;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.recompute_side_bet_points(_side_bet_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.side_bet_answers a
  set points = case
    when public.side_bet_answer_is_correct(a.answer, sb.correct_answer) then sb.points
    else 0
  end
  from public.side_bets sb
  where sb.id = a.side_bet_id
    and sb.id = _side_bet_id;
end;
$$;

do $$
declare
  side_bet record;
begin
  for side_bet in select id from public.side_bets loop
    perform public.recompute_side_bet_points(side_bet.id);
  end loop;
end;
$$;
