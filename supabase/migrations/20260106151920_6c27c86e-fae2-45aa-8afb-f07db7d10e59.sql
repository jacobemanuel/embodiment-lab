-- Add mode column to avatar_time_tracking
ALTER TABLE IF EXISTS public.avatar_time_tracking
  ADD COLUMN IF NOT EXISTS mode TEXT;

-- Populate existing page entries with mode = 'page'
UPDATE public.avatar_time_tracking
SET mode = 'page'
WHERE mode IS NULL
  AND slide_id LIKE 'page:%';