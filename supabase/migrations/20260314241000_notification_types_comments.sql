alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;

alter table public.user_notifications
  add constraint user_notifications_type_check
  check (
    type in (
      'document_shared',
      'document_unshared',
      'document_updated',
      'assignment_assigned',
      'comment_mentioned',
      'comment_reply'
    )
  );
