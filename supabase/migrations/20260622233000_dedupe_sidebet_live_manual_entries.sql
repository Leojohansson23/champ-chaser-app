with normalized as (
  select
    id,
    category,
    regexp_replace(btrim(label), '\s+', ' ', 'g') as cleaned_label,
    lower(regexp_replace(btrim(label), '\s+', ' ', 'g')) as normalized_label,
    value,
    created_at
  from public.sidebet_live_manual_entries
  where category in ('top_scorers', 'top_assists')
),
ranked as (
  select
    *,
    row_number() over (
      partition by category, normalized_label
      order by created_at, id
    ) as row_number,
    first_value(cleaned_label) over (
      partition by category, normalized_label
      order by created_at, id
    ) as keeper_label,
    sum(value) over (partition by category, normalized_label) as total_value
  from normalized
)
update public.sidebet_live_manual_entries entries
set
  label = ranked.keeper_label,
  value = ranked.total_value
from ranked
where entries.id = ranked.id
  and ranked.row_number = 1;

with normalized as (
  select
    id,
    category,
    lower(regexp_replace(btrim(label), '\s+', ' ', 'g')) as normalized_label,
    created_at
  from public.sidebet_live_manual_entries
  where category in ('top_scorers', 'top_assists')
),
ranked as (
  select
    *,
    row_number() over (
      partition by category, normalized_label
      order by created_at, id
    ) as row_number
  from normalized
)
delete from public.sidebet_live_manual_entries entries
using ranked
where entries.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists sidebet_live_manual_entries_category_label_unique
  on public.sidebet_live_manual_entries (
    category,
    lower(regexp_replace(btrim(label), '\s+', ' ', 'g'))
  )
  where category in ('top_scorers', 'top_assists');
