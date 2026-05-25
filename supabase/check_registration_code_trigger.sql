-- Kontrollera att triggern för registreringskod finns och är aktiv
select trigger_name, event_manipulation, event_object_table, action_statement
from information_schema.triggers
where event_object_table = 'users' and trigger_name ilike '%registration_code%';

-- Kontrollera att funktionen finns
select routine_name
from information_schema.routines
where routine_name ilike '%registration_code%';
