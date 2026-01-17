-- Add source and is_imputed columns for owner backfill tracking
ALTER TABLE IF EXISTS public.avatar_time_tracking
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'participant',
  ADD COLUMN IF NOT EXISTS is_imputed boolean DEFAULT false;

ALTER TABLE IF EXISTS public.pre_test_responses
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'participant',
  ADD COLUMN IF NOT EXISTS is_imputed boolean DEFAULT false;

ALTER TABLE IF EXISTS public.post_test_responses
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'participant',
  ADD COLUMN IF NOT EXISTS is_imputed boolean DEFAULT false;