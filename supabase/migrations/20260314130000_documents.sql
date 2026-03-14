create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_status_idx on public.documents(status);
create index if not exists documents_created_at_idx on public.documents(created_at desc);

create or replace function public.set_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
before update on public.documents
for each row
execute procedure public.set_documents_updated_at();

alter table public.documents enable row level security;

create policy "documents_select_all_authenticated"
  on public.documents
  for select
  to authenticated
  using (true);

create policy "documents_insert_all_authenticated"
  on public.documents
  for insert
  to authenticated
  with check (true);

create policy "documents_update_all_authenticated"
  on public.documents
  for update
  to authenticated
  using (true)
  with check (true);

create policy "documents_delete_all_authenticated"
  on public.documents
  for delete
  to authenticated
  using (true);
