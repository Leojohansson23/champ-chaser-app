-- Require a shared registration code for new signups.
-- Code is stored in public.app_settings under key = 'registration_code'.

insert into public.app_settings (key, value)
values ('registration_code', '{"code":"tipset2026"}'::jsonb)
on conflict (key) do nothing;

create or replace function public.validate_registration_code_for_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_code text;
  provided_code text;
  jwt_role text;
begin
  -- Allow service-role driven inserts (SQL editor/admin maintenance scripts).
  jwt_role := current_setting('request.jwt.claim.role', true);
  if jwt_role = 'service_role' then
    return new;
  end if;

  select value->>'code'
  into expected_code
  from public.app_settings
  where key = 'registration_code';

  -- If no code is configured, do not block signups.
  if expected_code is null or btrim(expected_code) = '' then
    return new;
  end if;

  provided_code := coalesce(new.raw_user_meta_data->>'registration_code', '');

  if btrim(provided_code) <> btrim(expected_code) then
    raise exception 'Ogiltig registreringskod';
  end if;

  -- Do not keep the registration code in user metadata.
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'registration_code';

  return new;
end;
$$;

drop trigger if exists before_auth_user_validate_registration_code on auth.users;
create trigger before_auth_user_validate_registration_code
  before insert on auth.users
  for each row execute function public.validate_registration_code_for_signup();
