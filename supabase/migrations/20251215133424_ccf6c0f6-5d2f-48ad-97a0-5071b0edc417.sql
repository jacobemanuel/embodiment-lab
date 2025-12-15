-- Add mode_specific column to study_questions for perception questions filtering
-- Values: 'text', 'avatar', 'both' (or NULL which defaults to 'both')
ALTER TABLE public.study_questions 
ADD COLUMN IF NOT EXISTS mode_specific TEXT DEFAULT 'both';

-- Add comment explaining the column
COMMENT ON COLUMN public.study_questions.mode_specific IS 'Which mode this question applies to: text, avatar, or both (default)';