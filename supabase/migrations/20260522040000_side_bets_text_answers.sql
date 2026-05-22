alter table public.side_bets
  alter column options set default '{}'::text[],
  alter column options drop not null;

create or replace function public.normalize_side_bet_answer(_answer text)
returns text language sql immutable as $$
  select lower(trim(_answer))
$$;

create or replace function public.set_side_bet_answer_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bet record;
begin
  select points, correct_answer into bet from public.side_bets where id = new.side_bet_id;

  new.answer := trim(new.answer);

  if bet.correct_answer is not null
     and public.normalize_side_bet_answer(new.answer) = public.normalize_side_bet_answer(bet.correct_answer) then
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
    when public.normalize_side_bet_answer(a.answer) = public.normalize_side_bet_answer(sb.correct_answer) then sb.points
    else 0
  end
  from public.side_bets sb
  where sb.id = a.side_bet_id
    and sb.id = _side_bet_id;
end;
$$;
