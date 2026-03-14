create table if not exists public.document_annotations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  author_user_id uuid not null,
  type text not null check (type in ('highlight', 'note', 'text', 'drawing')),
  content text,
  color text not null default '#ffe58f',
  anchor jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_annotations_document_id_created_at_idx
  on public.document_annotations(document_id, created_at desc);

create index if not exists document_annotations_author_user_id_idx
  on public.document_annotations(author_user_id);

create or replace function public.set_document_annotations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_document_annotations_updated_at on public.document_annotations;
create trigger trg_document_annotations_updated_at
before update on public.document_annotations
for each row
execute procedure public.set_document_annotations_updated_at();

alter table public.document_annotations enable row level security;

create policy "document_annotations_select_collaboration"
  on public.document_annotations
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

create policy "document_annotations_insert_owner_or_editor"
  on public.document_annotations
  for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
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

create policy "document_annotations_update_owner_or_editor"
  on public.document_annotations
  for update
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
              and dc.role = 'editor'
          )
        )
    )
  )
  with check (
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
              and dc.role = 'editor'
          )
        )
    )
  );

create policy "document_annotations_delete_owner_editor_or_author"
  on public.document_annotations
  for delete
  to authenticated
  using (
    author_user_id = auth.uid()
    or exists (
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
