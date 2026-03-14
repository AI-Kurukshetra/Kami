alter table public.profiles
  add column if not exists owner_id uuid;

update public.profiles
set owner_id = id
where owner_id is null;

alter table public.profiles
  alter column owner_id set not null;

create index if not exists profiles_owner_id_idx on public.profiles(owner_id);

alter table public.profiles drop constraint if exists profiles_email_key;

alter table public.profiles
  add constraint profiles_owner_email_key unique (owner_id, email);

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = owner_id);
