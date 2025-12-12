-- Add modes_used column to track all modes a participant used
ALTER TABLE public.study_sessions 
ADD COLUMN modes_used text[] DEFAULT ARRAY[]::text[];

-- Update existing sessions: set modes_used from current mode
UPDATE public.study_sessions 
SET modes_used = ARRAY[mode::text]
WHERE modes_used IS NULL OR modes_used = ARRAY[]::text[];