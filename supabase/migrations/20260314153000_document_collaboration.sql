create table if not exists public.document_collaborators (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  unique (document_id, user_id)
);

create index if not exists document_collaborators_document_id_idx
  on public.document_collaborators(document_id);

create index if not exists document_collaborators_user_id_idx
  on public.document_collaborators(user_id);

alter table public.document_collaborators enable row level security;

-- Replace strict owner-only document policies with collaboration-aware policies.
drop policy if exists "documents_select_own" on public.documents;
drop policy if exists "documents_insert_own" on public.documents;
drop policy if exists "documents_update_own" on public.documents;
drop policy if exists "documents_delete_own" on public.documents;

create policy "documents_select_collaboration"
  on public.documents
  for select
  to authenticated
  using (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.document_collaborators dc
      where dc.document_id = documents.id
        and dc.user_id = auth.uid()
    )
  );

create policy "documents_insert_own"
  on public.documents
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "documents_update_collaboration"
  on public.documents
  for update
  to authenticated
  using (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.document_collaborators dc
      where dc.document_id = documents.id
        and dc.user_id = auth.uid()
        and dc.role = 'editor'
    )
  )
  with check (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.document_collaborators dc
      where dc.document_id = documents.id
        and dc.user_id = auth.uid()
        and dc.role = 'editor'
    )
  );

create policy "documents_delete_own"
  on public.documents
  for delete
  to authenticated
  using (auth.uid() = owner_id);

create policy "document_collaborators_select_owner_or_self"
  on public.document_collaborators
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.owner_id = auth.uid()
    )
  );

create policy "document_collaborators_mutate_owner"
  on public.document_collaborators
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.owner_id = auth.uid()
    )
  );
