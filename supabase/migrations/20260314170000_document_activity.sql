create table if not exists public.document_activity (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  actor_user_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted', 'shared', 'unshared')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_activity_document_id_created_at_idx
  on public.document_activity(document_id, created_at desc);

create index if not exists document_activity_actor_user_id_idx
  on public.document_activity(actor_user_id);

alter table public.document_activity enable row level security;

create policy "document_activity_select_collaboration"
  on public.document_activity
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.documents d
      where d.id = document_id
        and (
          d.owner_id = auth.uid()
          or exists (
            select 1
            from public.document_collaborators dc
            where dc.document_id = d.id
              and dc.user_id = auth.uid()
          )
        )
    )
  );

create policy "document_activity_insert_owner_or_editor"
  on public.document_activity
  for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and exists (
      select 1
      from public.documents d
      where d.id = document_id
        and (
          d.owner_id = auth.uid()
          or exists (
            select 1
            from public.document_collaborators dc
            where dc.document_id = d.id
              and dc.user_id = auth.uid()
              and dc.role = 'editor'
          )
        )
    )
  );
