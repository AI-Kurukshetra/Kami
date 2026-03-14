create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null check (type in ('document_shared', 'document_unshared')),
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_id_created_at_idx
  on public.user_notifications(user_id, created_at desc);

create index if not exists user_notifications_user_id_read_at_idx
  on public.user_notifications(user_id, read_at);

alter table public.user_notifications enable row level security;

create policy "user_notifications_select_own"
  on public.user_notifications
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_notifications_insert_own"
  on public.user_notifications
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_notifications_update_own"
  on public.user_notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_notifications_delete_own"
  on public.user_notifications
  for delete
  to authenticated
  using (user_id = auth.uid());
