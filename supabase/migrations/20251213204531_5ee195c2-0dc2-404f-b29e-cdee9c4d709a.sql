-- Add column for suspicious activity flags
ALTER TABLE public.study_sessions 
ADD COLUMN IF NOT EXISTS suspicious_flags jsonb DEFAULT '[]'::jsonb;

-- Add suspicion score for filtering
ALTER TABLE public.study_sessions 
ADD COLUMN IF NOT EXISTS suspicion_score integer DEFAULT 0;

-- Comment
COMMENT ON COLUMN public.study_sessions.suspicious_flags IS 'Array of bot detection flags, e.g., ["fast_answers", "page_too_quick"]';
COMMENT ON COLUMN public.study_sessions.suspicion_score IS 'Score from bot detection (0-100), higher = more suspicious';