alter table if exists public.avatar_time_tracking
  add column if not exists mode text;

update public.avatar_time_tracking
set mode = 'page'
where mode is null
  and slide_id like 'page:%';
