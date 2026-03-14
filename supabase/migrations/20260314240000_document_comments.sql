create table if not exists public.document_comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  author_user_id uuid not null,
  parent_comment_id uuid references public.document_comments(id) on delete cascade,
  body text not null,
  mention_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_comments_document_id_created_at_idx
  on public.document_comments(document_id, created_at asc);

create index if not exists document_comments_parent_comment_id_idx
  on public.document_comments(parent_comment_id);

create index if not exists document_comments_author_user_id_idx
  on public.document_comments(author_user_id);

create or replace function public.set_document_comments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_document_comments_updated_at on public.document_comments;
create trigger trg_document_comments_updated_at
before update on public.document_comments
for each row
execute procedure public.set_document_comments_updated_at();

alter table public.document_comments enable row level security;

create policy "document_comments_select_collaboration"
  on public.document_comments
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

create policy "document_comments_insert_collaboration"
  on public.document_comments
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
          )
        )
    )
  );

create policy "document_comments_update_author_or_owner_or_editor"
  on public.document_comments
  for update
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
  )
  with check (
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

create policy "document_comments_delete_author_or_owner_or_editor"
  on public.document_comments
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

do $$
begin
  alter publication supabase_realtime add table public.document_comments;
exception when duplicate_object then null;
end;
$$;
