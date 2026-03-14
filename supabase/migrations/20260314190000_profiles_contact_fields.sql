alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone_number text;

update public.profiles
set first_name = coalesce(nullif(split_part(display_name, ' ', 1), ''), 'User')
where first_name is null;

update public.profiles
set last_name = coalesce(
  nullif(trim(regexp_replace(display_name, '^\S+\s*', '')), ''),
  'Profile'
)
where last_name is null;

update public.profiles
set phone_number = '+10000000000'
where phone_number is null;
