create table if not exists public.document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  uploader_user_id uuid not null,
  file_name text not null,
  file_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists document_files_document_id_idx
  on public.document_files(document_id, created_at desc);

create index if not exists document_files_uploader_user_id_idx
  on public.document_files(uploader_user_id);

alter table public.document_files enable row level security;

create policy "document_files_select_collaboration"
  on public.document_files
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

create policy "document_files_insert_owner_or_editor"
  on public.document_files
  for insert
  to authenticated
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
    and uploader_user_id = auth.uid()
  );

create policy "document_files_delete_owner_or_uploader"
  on public.document_files
  for delete
  to authenticated
  using (
    uploader_user_id = auth.uid()
    or exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.owner_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-files',
  'document-files',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain'
  ]::text[]
)
on conflict (id) do nothing;
