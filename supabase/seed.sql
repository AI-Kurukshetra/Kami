insert into public.profiles (id, owner_id, email, display_name, first_name, last_name, phone_number)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'demo@kami.app',
    'Kami Demo',
    'Kami',
    'Demo',
    '+15550000000'
  )
on conflict (owner_id, email) do nothing;

insert into public.documents (id, owner_id, title, content, status)
values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Getting Started Blueprint', 'Initial document seeded for MVP development.', 'draft')
on conflict (id) do nothing;

insert into public.document_activity (document_id, actor_user_id, action, metadata)
select
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'created',
  '{"seeded": true}'::jsonb
where not exists (
  select 1
  from public.document_activity
  where document_id = '22222222-2222-2222-2222-222222222222'
    and action = 'created'
);
