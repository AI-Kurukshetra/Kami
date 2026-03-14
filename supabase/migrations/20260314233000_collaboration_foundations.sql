do $$
begin
  alter publication supabase_realtime add table public.documents;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.document_annotations;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.document_activity;
exception when duplicate_object then null;
end;
$$;

alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;

alter table public.user_notifications
  add constraint user_notifications_type_check
  check (type in ('document_shared', 'document_unshared', 'document_updated', 'assignment_assigned'));

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classroom_members (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('teacher', 'student')),
  created_at timestamptz not null default now(),
  unique (classroom_id, user_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  created_by_user_id uuid not null,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  provider text not null check (provider in ('google_drive', 'dropbox', 'onedrive', 'canvas', 'google_classroom')),
  status text not null default 'disconnected' check (status in ('disconnected', 'connected')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider)
);

create index if not exists classrooms_owner_id_idx on public.classrooms(owner_id);
create index if not exists classroom_members_classroom_id_idx on public.classroom_members(classroom_id);
create index if not exists classroom_members_user_id_idx on public.classroom_members(user_id);
create index if not exists assignments_classroom_id_idx on public.assignments(classroom_id);
create index if not exists assignments_created_by_user_id_idx on public.assignments(created_by_user_id);
create index if not exists integration_settings_owner_id_idx on public.integration_settings(owner_id);

create or replace function public.set_classrooms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_classrooms_updated_at on public.classrooms;
create trigger trg_classrooms_updated_at
before update on public.classrooms
for each row
execute procedure public.set_classrooms_updated_at();

create or replace function public.set_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_assignments_updated_at on public.assignments;
create trigger trg_assignments_updated_at
before update on public.assignments
for each row
execute procedure public.set_assignments_updated_at();

create or replace function public.set_integration_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_integration_settings_updated_at on public.integration_settings;
create trigger trg_integration_settings_updated_at
before update on public.integration_settings
for each row
execute procedure public.set_integration_settings_updated_at();

alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.assignments enable row level security;
alter table public.integration_settings enable row level security;

create policy "classrooms_select_owner_or_member"
  on public.classrooms
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.classroom_members cm
      where cm.classroom_id = classrooms.id
        and cm.user_id = auth.uid()
    )
  );

create policy "classrooms_insert_owner"
  on public.classrooms
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "classrooms_update_owner"
  on public.classrooms
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "classrooms_delete_owner"
  on public.classrooms
  for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "classroom_members_select_owner_or_member"
  on public.classroom_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.classrooms c
      where c.id = classroom_id
        and c.owner_id = auth.uid()
    )
  );

create policy "classroom_members_insert_owner"
  on public.classroom_members
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.classrooms c
      where c.id = classroom_id
        and c.owner_id = auth.uid()
    )
  );

create policy "classroom_members_delete_owner"
  on public.classroom_members
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.classrooms c
      where c.id = classroom_id
        and c.owner_id = auth.uid()
    )
  );

create policy "assignments_select_classroom_access"
  on public.assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.classrooms c
      where c.id = classroom_id
        and (
          c.owner_id = auth.uid()
          or exists (
            select 1
            from public.classroom_members cm
            where cm.classroom_id = c.id
              and cm.user_id = auth.uid()
          )
        )
    )
  );

create policy "assignments_insert_teacher_or_owner"
  on public.assignments
  for insert
  to authenticated
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.classrooms c
      where c.id = classroom_id
        and (
          c.owner_id = auth.uid()
          or exists (
            select 1
            from public.classroom_members cm
            where cm.classroom_id = c.id
              and cm.user_id = auth.uid()
              and cm.role = 'teacher'
          )
        )
    )
  );

create policy "assignments_update_teacher_or_owner"
  on public.assignments
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.classrooms c
      where c.id = classroom_id
        and (
          c.owner_id = auth.uid()
          or exists (
            select 1
            from public.classroom_members cm
            where cm.classroom_id = c.id
              and cm.user_id = auth.uid()
              and cm.role = 'teacher'
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.classrooms c
      where c.id = classroom_id
        and (
          c.owner_id = auth.uid()
          or exists (
            select 1
            from public.classroom_members cm
            where cm.classroom_id = c.id
              and cm.user_id = auth.uid()
              and cm.role = 'teacher'
          )
        )
    )
  );

create policy "assignments_delete_teacher_or_owner"
  on public.assignments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.classrooms c
      where c.id = classroom_id
        and (
          c.owner_id = auth.uid()
          or exists (
            select 1
            from public.classroom_members cm
            where cm.classroom_id = c.id
              and cm.user_id = auth.uid()
              and cm.role = 'teacher'
          )
        )
    )
  );

create policy "integration_settings_select_own"
  on public.integration_settings
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "integration_settings_insert_own"
  on public.integration_settings
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "integration_settings_update_own"
  on public.integration_settings
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "integration_settings_delete_own"
  on public.integration_settings
  for delete
  to authenticated
  using (owner_id = auth.uid());
