alter table if exists public.avatar_time_tracking
  add column if not exists source text default 'participant',
  add column if not exists is_imputed boolean default false;

alter table if exists public.pre_test_responses
  add column if not exists source text default 'participant',
  add column if not exists is_imputed boolean default false;

alter table if exists public.post_test_responses
  add column if not exists source text default 'participant',
  add column if not exists is_imputed boolean default false;
