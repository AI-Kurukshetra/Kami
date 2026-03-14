alter table public.documents
  add column if not exists owner_id uuid;

update public.documents
set owner_id = '11111111-1111-1111-1111-111111111111'
where owner_id is null;

alter table public.documents
  alter column owner_id set not null;

create index if not exists documents_owner_id_idx on public.documents(owner_id);

drop policy if exists "documents_select_all_authenticated" on public.documents;
drop policy if exists "documents_insert_all_authenticated" on public.documents;
drop policy if exists "documents_update_all_authenticated" on public.documents;
drop policy if exists "documents_delete_all_authenticated" on public.documents;

create policy "documents_select_own"
  on public.documents
  for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "documents_insert_own"
  on public.documents
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "documents_update_own"
  on public.documents
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "documents_delete_own"
  on public.documents
  for delete
  to authenticated
  using (auth.uid() = owner_id);
